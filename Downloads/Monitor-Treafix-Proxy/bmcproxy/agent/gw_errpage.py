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


def page(bmc, status, kind="web"):
    """Tra ve (ma HTTP, header, bytes). Traefik giu nguyen ma loi goc (502/503/504)."""
    if not bmc:
        body = "<h1>Bad Gateway</h1>".encode()
        return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, body
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
    body = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>IPMI lỗi - BMC {bmc['port']}</title>
<style>body{{font:15px system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;display:grid;place-items:center;min-height:100vh}}
.b{{max-width:620px;padding:28px;margin:16px;background:#111c33;border:1px solid #1e2b47;border-radius:14px}}
h1{{font-size:21px;margin:0 0 6px;color:#fca5a5}}.s{{color:#94a3b8;font-size:13px}}p{{line-height:1.55}}
table{{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}}td{{padding:7px 10px;border-top:1px solid #1e2b47}}
.ok{{color:#4ade80}}.bad{{color:#f87171}}li{{margin:5px 0}}code{{color:#7dd3fc}}
button{{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:14px;cursor:pointer}}</style></head>
<body><div class="b"><div class="s">IPMI / BMC {bmc['port']}{' · ' + note if note else ''} · HTTP {html.escape(str(status))}</div>
<h1>{html.escape(title)}</h1><p>{desc}</p><table>{rows}</table>
<b>Cách xử lý</b><ol>{steps}</ol>
<button onclick="location.reload()">Thử lại</button>
<p class="s">Kiểm tra lúc {html.escape(d.get('checked', ''))} từ server proxy.</p></div></body></html>"""
    return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, body.encode("utf-8")
