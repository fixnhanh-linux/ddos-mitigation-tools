"""Trang loi IPMI: Traefik gap 502/503/504 tu BMC -> hoi agent -> agent ping + thu cong + thu TLS
toi BMC roi tra trang bao ro nguyen nhan (thay cho chu "Bad Gateway")."""

import html
import platform
import socket
import ssl
import subprocess
import threading
import time

from gw_common import now_iso, upstream_host_port

CACHE_SECONDS = 15  # trang BMC tai nhieu file cung luc -> chi chan doan 1 lan / 15s / BMC
_cache = {}
_lock = threading.Lock()


def _ping(host, timeout=1):
    win = platform.system() == "Windows"
    cmd = ["ping", "-n", "1", "-w", str(timeout * 1000), host] if win else ["ping", "-c", "1", "-W", str(timeout), host]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 2)
    except (OSError, subprocess.SubprocessError):
        return None  # khong co lenh ping
    if r.returncode != 0:
        return False
    return "ttl=" in r.stdout.lower() or not win


def _tcp(host, port, timeout=3):
    t0 = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, round((time.monotonic() - t0) * 1000), ""
    except socket.timeout:
        return False, None, "không phản hồi (timeout)"
    except ConnectionRefusedError:
        return False, None, "bị từ chối (cổng đóng)"
    except OSError as e:
        return False, None, str(e)


def _tls(host, port, legacy, timeout=5):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    if legacy:
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1
            ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
        except (ValueError, ssl.SSLError):
            pass
    try:
        with socket.create_connection((host, port), timeout=timeout) as raw, \
                ctx.wrap_socket(raw, server_hostname=host) as s:
            return True, s.version() or ""
    except (OSError, ssl.SSLError) as e:
        return False, str(e)[:160]


def diagnose(url, legacy):
    host, port = upstream_host_port(url)
    if not host:
        return {"code": "bad", "host": "", "port": None}
    ping = _ping(host)
    up, ms, err = _tcp(host, port)
    d = {"host": host, "port": port, "ping": ping, "tcp": up, "ms": ms, "tcp_error": err, "checked": now_iso()}
    if not up:
        d["code"] = "down" if ping is not True else "port"
        return d
    if url.startswith("https"):
        ok, info = _tls(host, port, legacy)
        d["tls"], d["tls_info"] = ok, info
        if not ok:
            d["code"] = "tls"
            return d
    d["code"] = "drop"
    return d


def cached(port, kind, url, legacy):
    key = (port, kind)
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < CACHE_SECONDS:
            return hit[1]
    d = diagnose(url, legacy)
    with _lock:
        _cache[key] = (time.time(), d)
    return d


MESSAGES = {
    "down": ("Không kết nối được IPMI / BMC",
             "IP của BMC không phản hồi: không ping được và không mở được cổng. "
             "Thường do server/BMC mất điện, rút cáp mạng IPMI, sai IP, hoặc server proxy không có đường tới mạng này.",
             ["Kiểm tra server còn điện, cáp mạng cổng IPMI.",
              "Kiểm tra IP BMC trên web quản trị có đúng không.",
              "Trên server proxy thử: ping {host}"]),
    "port": ("BMC có mạng nhưng web IPMI không mở",
             "Ping được BMC nhưng cổng {port} {tcp_error}. Dịch vụ web của BMC có thể bị treo hoặc BMC đang khởi động lại.",
             ["Đợi 2-5 phút (BMC đang khởi động lại) rồi tải lại trang.",
              "Reset BMC: ipmitool -I lanplus -H {host} -U <user> -P <pass> mc reset cold",
              "Kiểm tra lại cổng trong Địa chỉ BMC (vd https://{host}:443)."]),
    "tls": ("Lỗi bắt tay TLS với BMC",
            "BMC mở cổng nhưng không bắt tay HTTPS được ({tls_info}). Thường gặp với BMC đời cũ chỉ có TLS 1.0 / thuật toán cũ.",
            ["Trên web quản trị: BMC này → bật \"BMC đời cũ (TLS cũ)\" → Lưu → Áp dụng.",
             "BMC chỉ hỗ trợ DHE: nâng firmware BMC."]),
    "drop": ("BMC đóng kết nối giữa chừng",
             "BMC đang có mạng và HTTPS bình thường (TLS {tls_info}, {ms} ms), nhưng vừa đóng kết nối không trả lời. "
             "Thường do BMC quá tải hoặc đã đủ số phiên đăng nhập.",
             ["Tải lại trang sau vài giây.",
              "Đăng xuất các phiên BMC khác / đóng tab BMC cũ.",
              "Nếu lặp lại liên tục: reset BMC (Maintenance → BMC Reset)."]),
    "bad": ("Cấu hình BMC sai", "Địa chỉ BMC không hợp lệ.", ["Sửa Địa chỉ BMC trên web quản trị."]),
}


RACADM_HOSTCHECK = "racadm set iDRAC.WebServer.HostHeaderCheck Disabled"


def is_reject(status, body):
    """BMC (iDRAC 9) tu choi request di qua proxy: 400 'Bad Request ... ErrorDocument' hoac JSON QueryNotSupported."""
    head = body[:4096]
    if b"QueryNotSupported" in head:
        return "query"
    if status == 400 and b"Bad Request" in head:
        return "host400"
    return ""


def reject_page(bmc, status, why):
    """Trang huong dan khi iDRAC tu choi truy cap qua proxy (Host Header Check / cookie qua lon)."""
    port = bmc["port"] if bmc else ""
    note = html.escape((bmc or {}).get("note") or "")
    host_ip = (bmc or {}).get("host_header") == "upstream"
    title = ("iDRAC báo QueryNotSupported khi đi qua proxy" if why == "query"
             else "BMC trả 400 Bad Request khi đi qua proxy")
    hostfix = ("" if host_ip else
               "<li><b>Trên web quản trị</b>: BMC " + str(port) + " → Tương thích BMC → <b>Host header = IP của BMC "
               "(iDRAC 9)</b> → Lưu → <b>Áp dụng</b> (nhiều máy: tick chọn → <b>Host = IP BMC</b>).</li>")
    steps = (hostfix +
             "<li><b>Trên iDRAC</b> (SSH vào iDRAC): <code>" + RACADM_HOSTCHECK + "</code> - hoặc web iDRAC → "
             "iDRAC Settings → Services → Web Server → Host Header Check = Disabled.</li>"
             "<li>Vẫn lỗi: cookie của tên miền proxy quá lớn (mọi BMC cùng tên miền). Mở cửa sổ ẩn danh "
             "(Ctrl+Shift+N) hoặc xoá cookie của tên miền này rồi thử lại.</li>")
    desc = ("iDRAC 9 bật <b>Host Header Check</b>: chỉ nhận truy cập có Host là IP / tên của chính nó, "
            "không nhận tên miền proxy" + (" (BMC này đã đặt Host = IP, nên nhiều khả năng do cookie quá lớn)" if host_ip else "")
            + ". BMC vẫn hoạt động bình thường - vào thẳng IP thì được.")
    body = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>BMC {port} từ chối truy cập qua proxy</title>
<style>body{{font:15px system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;display:grid;place-items:center;min-height:100vh}}
.b{{max-width:640px;padding:28px;margin:16px;background:#111c33;border:1px solid #1e2b47;border-radius:14px}}
h1{{font-size:21px;margin:0 0 6px;color:#fcd34d}}.s{{color:#94a3b8;font-size:13px}}p{{line-height:1.55}}
li{{margin:7px 0;line-height:1.5}}code{{color:#7dd3fc;word-break:break-all}}
button{{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:14px;cursor:pointer}}</style></head>
<body><div class="b"><div class="s">IPMI / BMC {port}{' · ' + note if note else ''} · HTTP {html.escape(str(status))}</div>
<h1>{html.escape(title)}</h1><p>{desc}</p>
<b>Cách xử lý</b><ol>{steps}</ol>
<button onclick="location.reload()">Thử lại</button></div></body></html>"""
    return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, body.encode("utf-8")


def page(bmc, status, kind="web", maint=None):
    """Tra ve (ma HTTP, header, bytes). Traefik giu nguyen ma loi goc (502/503/504)."""
    if not bmc:
        body = "<h1>Bad Gateway</h1>".encode()
        return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, body
    if kind == "reject":  # BMC tra 400 o trang chu (middleware errors 400 cua router trang chu)
        return reject_page(bmc, status, "host400")
    url = bmc["console_upstream"] if kind == "console" and bmc.get("console_upstream") else bmc["upstream"]
    d = cached(bmc["port"], kind, url, bmc.get("legacy_tls"))
    title, desc, steps = MESSAGES[d["code"]]
    fill = {k: html.escape(str(d.get(k) if d.get(k) is not None else "")) for k in
            ("host", "port", "tcp_error", "tls_info", "ms")}
    desc = desc.format(**fill)
    raw = {k: "" if d.get(k) is None else d.get(k) for k in ("host", "port", "tcp_error", "tls_info", "ms")}
    steps = "".join(f"<li>{html.escape(s.format(**raw))}</li>" for s in steps)

    def mark(v):
        return '<b class="ok">OK</b>' if v is True else '<b class="bad">LỖI</b>' if v is False else '<b>-</b>'
    rows = (f"<tr><td>Ping {fill['host']}</td><td>{mark(d.get('ping'))}</td></tr>"
            f"<tr><td>Cổng {fill['port']}</td><td>{mark(d.get('tcp'))} {fill['tcp_error']}</td></tr>"
            + (f"<tr><td>HTTPS / TLS</td><td>{mark(d.get('tls'))} {fill['tls_info']}</td></tr>" if "tls" in d else ""))
    note = html.escape(bmc.get("note") or "")
    maint_html = ""
    if maint:  # dang trong lich bao tri: bao ro cho nguoi dung, khong phai su co
        maint_html = ('<div style="background:#422006;border:1px solid #a16207;color:#fde68a;border-radius:10px;'
                      'padding:10px 14px;margin:0 0 14px">🔧 <b>Đang bảo trì</b> đến ' + html.escape(maint.get("end", ""))
                      + (" · " + html.escape(maint["note"]) if maint.get("note") else "")
                      + ". BMC có thể tạm không truy cập được.</div>")
    body = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>IPMI lỗi - BMC {bmc['port']}</title>
<style>body{{font:15px system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;display:grid;place-items:center;min-height:100vh}}
.b{{max-width:620px;padding:28px;margin:16px;background:#111c33;border:1px solid #1e2b47;border-radius:14px}}
h1{{font-size:21px;margin:0 0 6px;color:#fca5a5}}.s{{color:#94a3b8;font-size:13px}}p{{line-height:1.55}}
table{{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}}td{{padding:7px 10px;border-top:1px solid #1e2b47}}
.ok{{color:#4ade80}}.bad{{color:#f87171}}li{{margin:5px 0}}code{{color:#7dd3fc}}
button{{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:14px;cursor:pointer}}</style></head>
<body><div class="b">{maint_html}<div class="s">IPMI / BMC {bmc['port']}{' · ' + note if note else ''} · HTTP {html.escape(str(status))}</div>
<h1>{html.escape(title)}</h1><p>{desc}</p><table>{rows}</table>
<b>Cách xử lý</b><ol>{steps}</ol>
<button onclick="location.reload()">Thử lại</button>
<p class="s">Kiểm tra lúc {html.escape(d.get('checked', ''))} từ server proxy.</p></div></body></html>"""
    return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, body.encode("utf-8")


# --------------------------------------------------------------------------- do loai BMC
# Web nhap IP -> agent (o cung mang BMC) thu cong web, doc trang chu / Redfish / chung chi -> doan mau (gw_templates)
DETECT_WEB_PORTS = [(443, "https"), (8443, "https"), (80, "http")]
DETECT_EXTRA_PORTS = [5900, 5901, 7578, 5120, 5123, 17990, 2068, 623]
# (mau, hang, cac chuoi nhan dien - chu thuong). Thu tu = uu tien.
DETECT_RULES = [
    ("idrac", "Dell", ("idrac", "dell inc", "integrated dell remote access")),
    ("ilo4-5", "HPE", ("integrated lights-out", "ilo 4", "ilo 5", "hewlett", '"hpe"')),
    ("lenovo", "Lenovo", ("xclarity", "lenovo", "integrated management module")),
    ("cisco-c220", "Cisco", ("cisco integrated management", "cimc", "cisco systems")),
    ("supermicro", "Supermicro", ("supermicro", "super micro", "/cgi/login.cgi")),
    ("qct-ami-java", "QCT / AMI", ("megarac", "american megatrends", "quanta", "qct", '"ami"', "<title>tyan</title>",
                                   "asrock rack")),
]
# Khong thay ten hang: dau hieu rieng (lay tu BMC that qua proxy)
DETECT_WEAK = [
    ("idrac9", "Dell", "/restgui"),                 # iDRAC 9: / -> /restgui/start.html
    ("idrac7-8", "Dell", "/start.html"),            # iDRAC 7/8: / -> /start.html
    ("qct-ami-java", "QCT / AMI", "ast2300"),       # chip ASPEED (BMC AMI doi cu)
    ("qct-ami-java", "QCT / AMI", "ast2400"),
    ("qct-ami-java", "QCT / AMI", "ast2500"),
    ("idrac9", "Dell", "errordocument"),            # Apache cua iDRAC tra 400 khi Host Header Check chan
]


def _http_get(host, port, scheme, path, legacy, timeout=5):
    """GET 1 trang (khong kiem chung chi). Tra ve (status, headers, body[:64K], cert DER) hoac None."""
    import http.client
    try:
        if scheme == "https":
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            if legacy:
                try:
                    ctx.minimum_version = ssl.TLSVersion.TLSv1
                    ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
                except (ValueError, ssl.SSLError):
                    pass
            c = http.client.HTTPSConnection(host, port, timeout=timeout, context=ctx)
        else:
            c = http.client.HTTPConnection(host, port, timeout=timeout)
        c.request("GET", path, headers={"User-Agent": "bmcproxy-detect", "Accept": "*/*"})
        r = c.getresponse()
        cert = c.sock.getpeercert(binary_form=True) or b"" if scheme == "https" and c.sock else b""
        body = r.read(65536)
        c.close()
        return r.status, {k.lower(): v for k, v in r.getheaders()}, body, cert
    except (OSError, ssl.SSLError, http.client.HTTPException):
        return None


def detect_bmc(ip):
    """Doan loai BMC theo IP: cong web, TLS cu, tieu de trang, Redfish, chung chi."""
    import json
    import re
    out = {"ip": ip, "at": now_iso(), "ping": _ping(ip), "evidence": [], "open_ports": []}
    web = None
    for port, scheme in DETECT_WEB_PORTS:
        up, ms, _ = _tcp(ip, port, timeout=2)
        if not up:
            continue
        out["open_ports"].append(port)
        if web:
            continue
        legacy, info = False, ""
        if scheme == "https":
            ok, info = _tls(ip, port, False)
            if not ok:
                ok, info = _tls(ip, port, True)
                legacy = ok
            if not ok:
                continue
        web = {"port": port, "scheme": scheme, "tls": info, "legacy_tls": legacy, "ms": ms}
    if not web:
        out["error"] = ("IP không phản hồi (không ping được, không mở cổng web)" if out["ping"] is False
                        else "Không thấy cổng web (443 / 8443 / 80) mở trên IP này")
        return out
    out["web"] = web

    def get(path):
        return _http_get(ip, web["port"], web["scheme"], path, web["legacy_tls"])

    texts = []
    home = get("/")
    if home and home[0] in (301, 302, 303, 307, 308):  # theo 1 lan chuyen huong trong cung BMC (lay tieu de trang that)
        m = re.match(r"^(?:https?://[^/]+)?(/\S*)$", home[1].get("location", ""))
        nxt = get(m.group(1)) if m else None
        if nxt:
            texts.append(nxt[2].decode("utf-8", "replace"))
            out["evidence_redirect"] = m.group(1)[:80]
    if home:
        _, headers, body, cert = home
        text = body.decode("utf-8", "replace")
        m = re.search(r"<title[^>]*>(.*?)</title>", " ".join(texts[:1]) + text, re.I | re.S)
        out["title"] = html.unescape(m.group(1)).strip()[:120] if m else ""
        out["server"] = headers.get("server", "")[:80]
        texts += [text, out["server"], headers.get("location", "")]
        # chuoi ASCII trong chung chi (to chuc / ten may) - vd "Dell Inc.", "Super Micro Computer"
        texts += [s.decode("ascii") for s in re.findall(rb"[ -~]{4,}", cert)[:40]]
    rf = get("/redfish/v1/")
    if rf and rf[0] == 200:
        try:
            j = json.loads(rf[2].decode("utf-8", "replace"))
            out["redfish"] = {k: j.get(k) for k in ("Vendor", "Product", "RedfishVersion") if j.get(k)}
            texts.append(json.dumps(j))
        except ValueError:
            pass
    blob = " ".join(t for t in texts if t).lower()
    tpl = vendor = None
    for key, name, marks in DETECT_RULES:
        hit = [s for s in marks if s in blob]
        if hit:
            tpl, vendor = key, name
            out["evidence"] += ['thấy "%s"' % s.strip('"') for s in hit[:3]]
            break
    if not tpl:
        for key, name, mark in DETECT_WEAK:
            if mark in blob:
                tpl, vendor = key, name
                out["evidence"].append(f'thấy "{mark}"')
                break
    if tpl == "idrac":
        rg = get("/restgui/start.html")
        if (rg and rg[0] == 200) or "/restgui" in blob:
            tpl = "idrac9"
            out["evidence"].append("có /restgui (giao diện iDRAC 9)")
        elif web["legacy_tls"] or re.search(r"idrac\s?6", blob):
            tpl = "idrac6"
            out["evidence"].append("chỉ bắt tay được TLS cũ" if web["legacy_tls"] else 'thấy "iDRAC 6"')
        else:
            tpl = "idrac7-8"
    if web["legacy_tls"]:
        out["evidence"].append(f"cần TLS cũ ({web['tls']})")
    out["template"], out["vendor"] = tpl, vendor
    out["confidence"] = "cao" if tpl and len(out["evidence"]) >= 2 else "trung bình" if tpl else "không rõ"
    for p in DETECT_EXTRA_PORTS:
        if _tcp(ip, p, timeout=1)[0]:
            out["open_ports"].append(p)
    return out
