"""Thanh phan dung chung cho controller va agent: file, kiem tra du lieu, mat khau, YAML, HTTP."""

import base64
import copy
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import secrets
import ssl
import struct
import subprocess
import time
import urllib.error
import urllib.request

VERSION = "2.0.0"
MARK = "# Managed by bmcproxy"

RE_HOST = (r"(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
           r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)")
RE_UPSTREAM = re.compile(r"^(https?)://(" + RE_HOST + r")(?::(\d{1,5}))?/?$")
RE_URL = re.compile(r"^https?://" + RE_HOST + r"(?::\d{1,5})?(?:/[A-Za-z0-9._~/-]*)?$")
RE_PATH = re.compile(r"^(?:[A-Za-z]:)?/[A-Za-z0-9._/~-]+$")
RE_DOMAIN = re.compile(r"^" + RE_HOST + r"$")
RE_SITE_KEY = re.compile(r"^[a-z0-9-]{1,32}$")
RE_TARGET = re.compile(r"^[A-Za-z0-9._:/@-]{0,200}$")
RE_USER = re.compile(r"^[A-Za-z0-9._-]{1,32}$")
RE_HEADER_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
RE_IP = re.compile(r"^[0-9a-fA-F:.]{2,45}$")
LOG_LEVELS = ("DEBUG", "INFO", "WARN", "ERROR")
ROLES = ("admin", "operator", "viewer")

BMC_DEFAULTS = {
    "site": "",
    "port": None,
    "upstream": "",
    "console_port": None,
    "console_upstream": "",
    "auth": True,
    "console_auth": True,
    "expected_target": "",
    "legacy_tls": False,
    "jsesp_cache": False,
    "host_header": "client",
    "enabled": True,
    "note": "",
    # Console Java: chuyen tiep TCP tho {proxy: cong tren proxy, bmc: cong tren BMC}
    "tcp_ports": [],
    "tcp_allow_ips": [],
    "jnlp_rewrite": True,
    # Duong dan file .jnlp tren BMC (vd viewer.jnlp, Java/jviewer.jnlp, cgi/url_redirect.cgi...)
    "jnlp_path": "",
    # Console Java tren web: agent chay JViewer trong container (Docker) tren server proxy, xem qua noVNC
    "java_web": False,
    # So ket noi toi da toi BMC (0 = khong gioi han). BMC yeu (AMI/QCT): 4
    "max_conns": 0,
}

KVM_PATH = "/__kvm"          # duong dan noVNC tren cong web cua BMC
KVM_CTL_PATH = "/__kvmctl"   # trang cho / trang thai (agent tra loi)
KVM_PORT_BASE = 40000        # container lang nghe 127.0.0.1:(40000 + cong BMC)
KVM_MAX_BMC_PORT = 65535 - KVM_PORT_BASE


def kvm_local_port(port):
    return KVM_PORT_BASE + int(port)


LIMIT_PORT_BASE = 20000      # bo gioi han ket noi cua agent nghe 127.0.0.1:(20000 + cong BMC)
LIMIT_MAX_BMC_PORT = 19999


def limit_local_port(port):
    return LIMIT_PORT_BASE + int(port)

# Cai dat ap dung cho moi site (site co the ghi de mot so khoa)
SETTINGS_DEFAULTS = {
    "auth_url": "https://test.longvan.net:7443/cloud-service/proxy-service/auth-token",
    "auth_cache_seconds": 900,
    "auth_verify_tls": False,
    "auth_timeout": 10,
    "cert_file": "/etc/traefik/certs/longvan.net.cer",
    "key_file": "/etc/traefik/certs/longvan.net.key",
    "access_log": "/var/log/traefik/access.log",
    "log_level": "INFO",
    "cert_warn_days": 30,
}
OVERRIDABLE = ("auth_url", "cert_file", "key_file", "access_log", "log_level")


class ValidationError(Exception):
    pass


# --------------------------------------------------------------------------- #
# File
# --------------------------------------------------------------------------- #

def now_iso():
    return dt.datetime.now().replace(microsecond=0).isoformat()


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return copy.deepcopy(default)


def read_text(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def write_text_atomic(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp-bmcproxy"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    try:
        os.chmod(tmp, mode)
    except OSError:
        pass
    os.replace(tmp, path)


def write_json(path, data, mode=0o644):
    write_text_atomic(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n", mode)


def is_managed(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.readline().startswith(MARK)
    except OSError:
        return False


def run_cmd(cmd, timeout=120):
    if not cmd:
        return True, "(bỏ qua - chưa cấu hình lệnh)"
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    return p.returncode == 0, (p.stdout + p.stderr).strip() or "(xong)"


def cert_not_after(path):
    try:
        info = ssl._ssl._test_decode_cert(path)
        return dt.datetime.strptime(info["notAfter"], "%b %d %H:%M:%S %Y %Z")
    except Exception:
        pass
    try:
        p = subprocess.run(["openssl", "x509", "-in", path, "-noout", "-enddate"],
                           capture_output=True, text=True, timeout=10)
        return dt.datetime.strptime(p.stdout.strip().split("=", 1)[1], "%b %d %H:%M:%S %Y %Z")
    except Exception:
        return None


def cert_info(path):
    exp = cert_not_after(path)
    if exp is None:
        return {"ok": False, "file": path}
    return {"ok": True, "file": path, "expires": exp.strftime("%d/%m/%Y"),
            "days": (exp - dt.datetime.utcnow()).days}


# --------------------------------------------------------------------------- #
# Mat khau / token
# --------------------------------------------------------------------------- #

def hash_password(password, salt=None, iterations=200_000):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
    return {"salt": salt, "iterations": iterations, "hash": digest}


def check_password(record, password):
    if not record or "salt" not in record:
        return False
    calc = hash_password(password, record["salt"], record["iterations"])["hash"]
    return hmac.compare_digest(calc, record["hash"])


# ------------------------------------------------------------ 2FA (TOTP, RFC 6238)
def totp_new_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def totp_code(secret, at=None, step=30, digits=6):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    h = hmac.new(key, struct.pack(">Q", int((at or time.time()) // step)), hashlib.sha1).digest()
    o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** digits).zfill(digits)


def totp_check(secret, code, window=1):
    """Cho phep lech +-1 buoc (30 giay) do dong ho dien thoai lech."""
    code = re.sub(r"\s", "", str(code or ""))
    if not secret or not re.fullmatch(r"\d{6}", code):
        return False
    now = time.time()
    return any(hmac.compare_digest(totp_code(secret, now + i * 30), code) for i in range(-window, window + 1))


def totp_uri(secret, account, issuer="Treafix Proxy BB"):
    from urllib.parse import quote
    return (f"otpauth://totp/{quote(issuer)}:{quote(account)}?secret={secret}"
            f"&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30")


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


# --------------------------------------------------------------------------- #
# Kiem tra du lieu
# --------------------------------------------------------------------------- #

def clean_text(s, n=200):
    return re.sub(r"[\x00-\x1f\x7f]", " ", str(s or "")).strip()[:n]


def to_port(v, field, allow_none=False):
    if v in (None, "") and allow_none:
        return None
    try:
        p = int(v)
    except (TypeError, ValueError):
        raise ValidationError(f"{field}: phải là số")
    if not 1 <= p <= 65535:
        raise ValidationError(f"{field}: ngoài khoảng 1-65535")
    return p


def check_upstream(v, field):
    v = str(v or "").strip().rstrip("/")
    m = RE_UPSTREAM.match(v)
    if not m:
        raise ValidationError(f"{field}: dạng https://10.3.7.147:8005")
    if m.group(3):
        to_port(m.group(3), field)
    return v


def upstream_host_port(url):
    m = RE_UPSTREAM.match(url or "")
    if not m:
        return None, None
    port = int(m.group(3)) if m.group(3) else (443 if m.group(1) == "https" else 80)
    return m.group(2), port


def validate_bmc_fields(raw):
    """Kiem tra mot BMC (khong kiem tra trung cong - viec cua controller)."""
    b = dict(BMC_DEFAULTS)
    for k in BMC_DEFAULTS:
        if k in raw:
            b[k] = raw[k]
    b["site"] = str(b["site"] or "").strip()
    if not RE_SITE_KEY.match(b["site"]):
        raise ValidationError("Chưa chọn site hợp lệ")
    b["port"] = to_port(b["port"], "Cổng")
    b["upstream"] = check_upstream(b["upstream"], "Địa chỉ BMC")
    b["console_port"] = to_port(b["console_port"], "Cổng console", allow_none=True)
    if b["console_port"]:
        if not b["console_upstream"]:
            host, _ = upstream_host_port(b["upstream"])
            b["console_upstream"] = f"https://{host}:{b['console_port']}"
        b["console_upstream"] = check_upstream(b["console_upstream"], "Địa chỉ console")
        if b["console_port"] == b["port"]:
            raise ValidationError("Cổng console trùng cổng web")
    else:
        b["console_upstream"] = ""
    for k in ("auth", "console_auth", "legacy_tls", "jsesp_cache", "enabled"):
        b[k] = bool(b[k])
    if b["host_header"] not in ("client", "upstream"):
        raise ValidationError("Host header không hợp lệ")
    b["expected_target"] = str(b["expected_target"] or "").strip()
    if not RE_TARGET.match(b["expected_target"]):
        raise ValidationError("Target chỉ được chứa chữ, số và . _ : / @ -")
    b["note"] = clean_text(b["note"])
    b["tcp_ports"] = parse_tcp_ports(b["tcp_ports"])
    b["tcp_allow_ips"] = parse_ip_list(b["tcp_allow_ips"], "IP được dùng console Java")
    b["jnlp_rewrite"] = bool(b["jnlp_rewrite"])
    b["jnlp_path"] = str(b.get("jnlp_path") or "").strip()[:200]
    b["java_web"] = bool(b["java_web"])
    try:
        b["max_conns"] = int(b["max_conns"] or 0)
    except (TypeError, ValueError):
        raise ValidationError("Số kết nối tối đa phải là số")
    if not 0 <= b["max_conns"] <= 32:
        raise ValidationError("Số kết nối tối đa từ 0 (không giới hạn) đến 32")
    if b["max_conns"] and b["port"] > LIMIT_MAX_BMC_PORT:
        raise ValidationError(f"Giới hạn kết nối cần cổng web ≤ {LIMIT_MAX_BMC_PORT}")
    if b["java_web"]:
        if b["port"] > KVM_MAX_BMC_PORT:
            raise ValidationError(f"Console Java trên web cần cổng web ≤ {KVM_MAX_BMC_PORT}")
    used = {b["port"]} | ({b["console_port"]} if b["console_port"] else set())
    for t in b["tcp_ports"]:
        if t["proxy"] in used:
            raise ValidationError(f"Cổng TCP {t['proxy']} trùng cổng web/console của chính BMC này")
    return b


def parse_tcp_ports(v):
    """'17578:7578, 15120:5120' hoac [{proxy, bmc}], [5900], ['6080:6080'] -> danh sach {proxy, bmc} da sap xep."""
    items = []
    if isinstance(v, str):
        for part in re.split(r"[,;\s]+", v.strip()):
            if not part:
                continue
            m = re.match(r"^(\d{1,5})\s*(?::|->|=|>)\s*(\d{1,5})$", part)
            if m:
                items.append({"proxy": m.group(1), "bmc": m.group(2)})
            elif re.match(r"^\d{1,5}$", part):
                items.append({"proxy": part, "bmc": part})
            else:
                raise ValidationError(f"Cổng TCP '{part}' phải dạng cổng_proxy:cổng_BMC, vd 17578:7578")
    elif isinstance(v, list):
        for it in v:
            if isinstance(it, dict):
                items.append(it)
            elif isinstance(it, (int, str)):
                s = str(it).strip()
                m = re.match(r"^(\d{1,5})\s*(?::|->|=|>)\s*(\d{1,5})$", s)
                if m:
                    items.append({"proxy": m.group(1), "bmc": m.group(2)})
                elif re.match(r"^\d{1,5}$", s):
                    items.append({"proxy": s, "bmc": s})
                else:
                    raise ValidationError(f"Cổng TCP '{s}' không hợp lệ")
            else:
                raise ValidationError("Cổng TCP không hợp lệ")
    elif v:
        raise ValidationError("Cổng TCP không hợp lệ")
    out, seen = [], set()
    for it in items:
        p_raw = it.get("proxy") if it.get("proxy") is not None else it.get("port")
        b_raw = it.get("bmc") if it.get("bmc") is not None else (it.get("port") if it.get("port") is not None else it.get("proxy"))
        p, bp = to_port(p_raw, "Cổng TCP (proxy)"), to_port(b_raw, "Cổng TCP (BMC)")
        if p in seen:
            raise ValidationError(f"Cổng TCP {p} bị khai 2 lần")
        seen.add(p)
        out.append({"proxy": p, "bmc": bp})
    if len(out) > 12:
        raise ValidationError("Tối đa 12 cổng TCP cho mỗi BMC")
    return sorted(out, key=lambda x: x["proxy"])


def parse_ip_list(v, field):
    if isinstance(v, str):
        v = [x for x in re.split(r"[,;\s]+", v.strip()) if x]
    out = []
    for ip in v or []:
        ip = str(ip).strip()
        if not RE_CIDR.match(ip):
            raise ValidationError(f"{field}: '{ip}' không hợp lệ (vd 113.161.1.2 hoặc 10.10.0.0/24)")
        out.append(ip)
    return out


def bmc_ports(b):
    """Moi cong ma BMC chiem tren proxy (web, console, TCP Java)."""
    ports = {b["port"]}
    if b.get("console_port"):
        ports.add(b["console_port"])
    try:  # du lieu cu / sua tay co the la [5900] hoac ["6080:6080"] -> chuan hoa truoc
        tcp = parse_tcp_ports(b.get("tcp_ports") or [])
    except ValidationError:
        tcp = []
    for t in tcp:
        ports.add(t["proxy"])
    return ports


def validate_settings_values(raw, partial=False):
    """Kiem tra cai dat. partial=True: chi kiem tra cac khoa co mat (dung cho ghi de site)."""
    out = {} if partial else dict(SETTINGS_DEFAULTS)
    for k in SETTINGS_DEFAULTS:
        if k not in raw or (partial and raw[k] in (None, "")):
            continue
        v = raw[k]
        if k == "auth_url":
            v = str(v).strip()
            if not RE_URL.match(v):
                raise ValidationError("URL xác thực không hợp lệ")
        elif k in ("cert_file", "key_file", "access_log"):
            v = str(v).strip()
            if not RE_PATH.match(v):
                raise ValidationError(f"{k}: phải là đường dẫn tuyệt đối, không dấu cách")
        elif k == "log_level":
            if v not in LOG_LEVELS:
                raise ValidationError("Mức log không hợp lệ")
        elif k == "auth_verify_tls":
            v = bool(v)
        else:
            try:
                v = int(v)
            except (TypeError, ValueError):
                raise ValidationError(f"{k}: phải là số")
            limits = {"auth_cache_seconds": (0, 86400), "auth_timeout": (1, 60),
                      "cert_warn_days": (1, 365)}[k]
            v = max(limits[0], min(limits[1], v))
        out[k] = v
    return out


# --------------------------------------------------------------------------- #
# YAML (tu viet, du cho dict/list/scalar)
# --------------------------------------------------------------------------- #

def _yaml_scalar(v):
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return json.dumps(str(v), ensure_ascii=False)


def _yaml_key(k):
    return k if re.match(r"^[A-Za-z0-9_.-]+$", k) else json.dumps(k, ensure_ascii=False)


def yaml_lines(obj, indent=0):
    pad = " " * indent
    lines = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = _yaml_key(str(k))
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{pad}{key}:")
                lines.extend(yaml_lines(v, indent + 2))
            elif isinstance(v, dict):
                lines.append(f"{pad}{key}: {{}}")
            elif isinstance(v, list):
                lines.append(f"{pad}{key}: []")
            else:
                lines.append(f"{pad}{key}: {_yaml_scalar(v)}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)) and item:
                sub = yaml_lines(item, indent + 2)
                sub[0] = pad + "- " + sub[0].lstrip()
                lines.extend(sub)
            else:
                lines.append(f"{pad}- {_yaml_scalar(item)}")
    return lines


def to_yaml(obj, header):
    return "\n".join([MARK + " - KHONG sua tay, moi thay doi se bi ghi de"] +
                     [f"# {h}" for h in header] + yaml_lines(obj)) + "\n"


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #

def ssl_context(verify):
    ctx = ssl.create_default_context()
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def http_json(url, method="GET", data=None, headers=None, timeout=10, verify=True):
    """Goi HTTP tra ve (status, json|None). Loi mang -> raise OSError."""
    body = None
    hdrs = {"Accept": "application/json", **(headers or {})}
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
    ctx = ssl_context(verify) if url.startswith("https") else None
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            raw = r.read()
            status = r.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        status = e.code
    try:
        return status, json.loads(raw.decode("utf-8")) if raw else None
    except ValueError:
        return status, None


# --------------------------------------------------------------------------- #
# Mat khau basicAuth cho Traefik (dinh dang Apache MD5 "$apr1$", Traefik ho tro)
# --------------------------------------------------------------------------- #

_ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
RE_APR1 = re.compile(r"^\$apr1\$[./0-9A-Za-z]{1,8}\$[./0-9A-Za-z]{22}$")


def apr1_hash(password, salt=None):
    """Tuong duong `openssl passwd -apr1`."""
    salt = (salt or "".join(secrets.choice(_ITOA64) for _ in range(8)))[:8]
    pw, sb, magic = password.encode(), salt.encode(), b"$apr1$"
    ctx = pw + magic + sb
    final = hashlib.md5(pw + sb + pw).digest()
    for i in range(len(pw), 0, -16):
        ctx += final[:min(16, i)]
    i = len(pw)
    while i:
        ctx += b"\x00" if i & 1 else pw[:1]
        i >>= 1
    final = hashlib.md5(ctx).digest()
    for i in range(1000):
        c = (pw if i & 1 else final)
        if i % 3:
            c += sb
        if i % 7:
            c += pw
        c += (final if i & 1 else pw)
        final = hashlib.md5(c).digest()

    def to64(v, n):
        out = ""
        for _ in range(n):
            out += _ITOA64[v & 0x3F]
            v >>= 6
        return out

    f = final
    enc = (to64((f[0] << 16) | (f[6] << 8) | f[12], 4) + to64((f[1] << 16) | (f[7] << 8) | f[13], 4)
           + to64((f[2] << 16) | (f[8] << 8) | f[14], 4) + to64((f[3] << 16) | (f[9] << 8) | f[15], 4)
           + to64((f[4] << 16) | (f[10] << 8) | f[5], 4) + to64(f[11], 2))
    return f"$apr1${salt}${enc}"


RE_CIDR = re.compile(r"^[0-9a-fA-F:.]{2,45}(?:/\d{1,3})?$")
DASHBOARD_DEFAULTS = {"enabled": False, "port": 18443, "allow_ips": [], "users": {}}


def validate_dashboard(raw):
    """Kiem tra cau hinh dashboard Traefik cua site (users: {ten: hash apr1})."""
    d = {**DASHBOARD_DEFAULTS, **(raw or {})}
    d["enabled"] = bool(d["enabled"])
    d["port"] = to_port(d["port"], "Cổng dashboard")
    ips = [str(x).strip() for x in d["allow_ips"] or [] if str(x).strip()]
    for ip in ips:
        if not RE_CIDR.match(ip):
            raise ValidationError(f"IP/dải mạng '{ip}' không hợp lệ (vd 113.161.1.2 hoặc 10.10.0.0/24)")
    d["allow_ips"] = ips
    users = {}
    for name, h in dict(d["users"] or {}).items():
        if not RE_USER.match(str(name)) or not RE_APR1.match(str(h)):
            raise ValidationError("Tài khoản dashboard không hợp lệ")
        users[str(name)] = str(h)
    d["users"] = users
    if d["enabled"] and (not ips or not users):
        raise ValidationError("Bật dashboard cần ít nhất 1 IP được phép và 1 tài khoản")
    return d
