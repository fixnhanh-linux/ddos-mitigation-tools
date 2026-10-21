"""Console Java qua proxy: tai file .jnlp tu BMC va sua lai cho chay duoc qua Traefik.

File .jnlp do BMC tao ra ghi IP noi bo (10.x) va cac cong TCP cua BMC (KVM 7578/5900,
media 5120/5123...). Khach o ngoai khong toi duoc nhung dia chi do. Agent:
  1. tai .jnlp tu BMC (mang theo cookie phien BMC cua trinh duyet),
  2. thay IP noi bo -> ten mien proxy, cong BMC -> cong proxy (theo bang tcp_ports),
  3. bo thuoc tinh href cua <jnlp> de Java Web Start khong tai lai ban goc tu BMC.
"""

import gzip
import http.client
import re
import ssl
import time
import urllib.error
import urllib.request

from gw_common import limit_local_port, ssl_context, upstream_host_port

FORWARD_HEADERS = ("Cookie", "User-Agent", "Accept", "Accept-Language", "Referer", "Authorization")
MAX_JNLP = 512 * 1024


RE_EMPTY_HOST = re.compile(r"(https?://)(?:\(null\)|null)?(?=[:/\"'<\s])", re.I)


def fix_empty_host(text, host):
    """AMI ghep dia chi tu tham so EXTRNIP; thieu tham so -> 'https://(null):443' hoac 'https://:443'."""
    text = RE_EMPTY_HOST.sub(lambda m: m.group(1) + host, text)
    return re.sub(r"(<argument>\s*)\(null\)(\s*</argument>)", lambda m: m.group(1) + host + m.group(2), text, flags=re.I)


def add_extrnip(path, value):
    """Them / thay tham so EXTRNIP=<value> (trang launch cua AMI gui ten may dang mo)."""
    if re.search(r"(?i)[?&]EXTRNIP=", path):
        return re.sub(r"(?i)([?&]EXTRNIP=)[^&]*", lambda m: m.group(1) + value, path)
    return path + ("&" if "?" in path else "?") + "EXTRNIP=" + value


def rewrite_jnlp(text, bmc_host, bmc_web_port, proxy_host, proxy_web_port, port_map):
    """port_map: {cong BMC: cong proxy} (cac cong TCP cua console Java)."""
    mapping = dict(port_map)
    mapping.setdefault(bmc_web_port, proxy_web_port)
    hosts = [h for h in {bmc_host, bmc_host.lower()} if h]
    # AMI ghep ten mien dang mo + cong web cua chinh BMC (vd https://ten-mien:443) -> cung phai doi cong
    url_hosts = hosts + [h for h in {proxy_host, (proxy_host or "").lower()} if h and h not in hosts]

    # 1. URL tro ve BMC (codebase, href jar...) -> https://ten-mien-proxy:cong-proxy
    for h in url_hosts:
        url_re = re.compile(r"(https?://)" + re.escape(h) + r"(?::(\d+))?", re.I)

        def url_sub(m):
            scheme = m.group(1)
            port = int(m.group(2)) if m.group(2) else (443 if scheme.lower() == "https://" else 80)
            if port not in mapping and port in (80, 443):  # web BMC (http/https mac dinh) -> cong web proxy
                return f"https://{proxy_host}:{proxy_web_port}"
            return f"{scheme}{proxy_host}:{mapping.get(port, port)}"
        text = url_re.sub(url_sub, text)

    # 2. IP / ten BMC con lai (trong tham so) -> ten mien proxy
    for h in hosts:
        text = re.sub(r"(?<![\w.-])" + re.escape(h) + r"(?![\w.-])", proxy_host, text)

    # 3. Cong trong <argument>: dang "7578" hoac "kmport=5900" / "port:5900"
    def arg_sub(m):
        inner = m.group(2)
        s = inner.strip()
        if s.isdigit() and int(s) in mapping:
            return m.group(1) + inner.replace(s, str(mapping[int(s)])) + m.group(3)

        def kv(mm):
            n = int(mm.group(2))
            return mm.group(1) + str(mapping[n]) if n in mapping else mm.group(0)
        return m.group(1) + re.sub(r"([=:])(\d{2,5})\b", kv, inner) + m.group(3)
    text = re.sub(r"(<argument>)(.*?)(</argument>)", arg_sub, text, flags=re.S | re.I)

    # 4. Bo href cua <jnlp> (Java Web Start se tai lai .jnlp goc tu BMC, khong co cookie)
    text = re.sub(r'(<jnlp\b[^>]*?)\s+href\s*=\s*"[^"]*"', r"\1", text, count=1, flags=re.I)
    return text


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def _ctx(legacy):
    ctx = ssl_context(False)
    if legacy:
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1
            ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
        except (ValueError, ssl.SSLError):
            pass
    return ctx


def proxy_host_of(client_host):
    """'ten-mien:8001' -> 'ten-mien' (giu nguyen IPv6 trong [])."""
    client_host = client_host or ""
    if client_host.startswith("["):
        return client_host.split("]")[0] + "]"
    return client_host.rsplit(":", 1)[0]


def fetch_raw(bmc, path, client_headers, client_host, timeout=20):
    """Tai .jnlp tu BMC (chua sua). Tra ve (ma HTTP, {header gui lai trinh duyet}, bytes)."""
    host, bport = upstream_host_port(bmc["upstream"])
    scheme = bmc["upstream"].split("://", 1)[0]
    base = bmc["upstream"].rstrip("/")
    if int(bmc.get("max_conns") or 0) > 0:
        # Di qua bo gioi han ket noi cua agent (nhu Traefik), khong mo them ket noi thu N+1 lam BMC dong ngang
        base = f"{scheme}://127.0.0.1:{limit_local_port(bmc['port'])}"
    url = base + (path if path.startswith("/") else "/" + path)
    headers = {k: client_headers[k] for k in FORWARD_HEADERS if client_headers.get(k)}
    headers["Accept-Encoding"] = "identity"
    if bmc.get("host_header", "client") == "client" and client_host:
        headers["Host"] = client_host
    else:
        headers["Host"] = host if bport == (443 if scheme == "https" else 80) else f"{host}:{bport}"
    ctx = _ctx(bmc.get("legacy_tls")) if url.startswith("https") else None
    # Khong tu di theo chuyen huong (vd BMC bat dang nhap -> /login.html): tra ve trinh duyet
    opener = urllib.request.build_opener(_NoRedirect, urllib.request.HTTPSHandler(context=ctx))
    for attempt in range(3):  # BMC yeu hay dong ngang ket noi -> thu lai
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with opener.open(req, timeout=timeout) as r:
                status, rh, body = r.status, r.headers, r.read(MAX_JNLP + 1)
            break
        except urllib.error.HTTPError as e:
            status, rh, body = e.code, e.headers, e.read(MAX_JNLP + 1)
            break
        except (http.client.RemoteDisconnected, ConnectionResetError, ConnectionAbortedError):
            if attempt == 2:
                raise
            time.sleep(0.7 * (attempt + 1))
    if body[:2] == b"\x1f\x8b":
        try:
            body = gzip.decompress(body)
        except OSError:
            pass
    out_headers = {"Cache-Control": "no-store"}
    for k in ("Content-Type", "Content-Disposition", "Set-Cookie"):
        if rh.get(k):
            out_headers[k] = rh.get(k)
    loc = rh.get("Location")
    if loc:  # chuyen huong ve IP noi bo -> doi thanh ten mien + cong proxy
        out_headers["Location"] = re.sub(r"^https?://" + re.escape(host) + r"(?::\d+)?",
                                         f"https://{client_host}", loc) if client_host else loc
    return status, out_headers, body


def is_jnlp(status, body):
    return status == 200 and b"<jnlp" in body[:MAX_JNLP].lower()


def fetch_jnlp(bmc, path, client_headers, client_host, timeout=20):
    """Tra ve (ma HTTP, {header}, noi dung bytes) da sua san sang gui cho trinh duyet."""
    host, web_port = upstream_host_port(bmc["upstream"])
    if re.search(r"(?i)\.jnlp", path.split("?", 1)[0]):  # AMI: thieu EXTRNIP -> .jnlp ghi (null)
        if not re.search(r"(?i)[?&]EXTRNIP=", path):
            path = add_extrnip(path, proxy_host_of(client_host) or host)
    status, out_headers, body = fetch_raw(bmc, path, client_headers, client_host, timeout)
    if is_jnlp(status, body):
        text = fix_empty_host(body[:MAX_JNLP].decode("utf-8", errors="replace"), host)
        port_map = {t["bmc"]: t["proxy"] for t in bmc.get("tcp_ports") or []}
        text = rewrite_jnlp(text, host, web_port, proxy_host_of(client_host), bmc["port"], port_map)
        body = text.encode("utf-8")
        out_headers["Content-Type"] = "application/x-java-jnlp-file"
        if "Content-Disposition" not in out_headers:
            m = re.search(r"([A-Za-z0-9._-]+\.jnlp)", path.split("?")[0], re.I)
            if m:
                name = m.group(1)
            else:
                name = re.sub(r"[^A-Za-z0-9._-]", "", path.split("?")[0].rsplit("/", 1)[-1]) or "viewer.jnlp"
                if not name.lower().endswith(".jnlp"):
                    name = "viewer.jnlp"
            out_headers["Content-Disposition"] = f'attachment; filename="{name}"'
    return status, out_headers, body
