"""Console Java tren web (khong tai .jnlp ve may nguoi dung).

Khi nguoi dung bam "Launch Java Console" tren trang BMC:
  1. Traefik chuyen file .jnlp toi agent (nhu che do sua .jnlp),
  2. agent tai .jnlp tu BMC (IP noi bo), ghi vao <kvm_dir>/<cong>/viewer.jnlp,
  3. chay container bmcgw-kvm (Java 8 + man hinh ao + noVNC) lang nghe 127.0.0.1:(40000+cong),
  4. tra ve trang "Dang mo console..." -> tu chuyen sang /__kvm/vnc.html (Traefik -> container).
Java chay ngay tren server proxy nen ket noi thang toi BMC, khong can mo cong TCP ra ngoai.
"""

import html
import json
import os
import re
import secrets
import socket
import string
import subprocess
import sys
import threading
import time

from gw_common import KVM_CTL_PATH, KVM_PATH, kvm_local_port, now_iso, upstream_host_port

CONFIG = {
    "docker_cmd": ["docker"],
    "kvm_image": "bmcgw-kvm:1",
    "kvm_dir": "/var/lib/bmcproxy/kvm",
    "kvm_max_hours": 4,
    "kvm_memory": "1g",
    "kvm_start_wait": 30,
}

_state = {}
_locks = {}
_glock = threading.Lock()


def configure(cfg):
    for k in CONFIG:
        if k in cfg:
            CONFIG[k] = cfg[k]


def container_name(port):
    return f"bmcgw-kvm-{port}"


def _lock(port):
    with _glock:
        return _locks.setdefault(port, threading.Lock())


def _set(port, state, error="", gen=None):
    with _glock:
        cur = _state.get(port) or {}
        if gen is not None and cur.get("gen") != gen:
            return  # da co lan bam moi hon
        _state[port] = {**cur, "state": state, "error": error, "since": now_iso(),
                        "gen": cur.get("gen", 0) if gen is None else gen}


def _listening(port, timeout=0.5):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def _docker(args, timeout=60):
    return subprocess.run(list(CONFIG["docker_cmd"]) + args, capture_output=True, text=True, timeout=timeout)


def status(port):
    with _glock:
        st = dict(_state.get(port) or {"state": "none", "error": ""})
    if st["state"] == "ready" and not _listening(kvm_local_port(port)):
        st["state"] = "stopped"
    return st


def stop(port):
    try:
        _docker(["rm", "-f", container_name(port)], 30)
    except (OSError, subprocess.SubprocessError):
        pass
    _set(port, "stopped")


def _start(bmc, jnlp_text, gen, password):
    port = bmc["port"]
    lp = kvm_local_port(port)
    name = container_name(port)
    with _lock(port):
        try:
            d = os.path.join(CONFIG["kvm_dir"], str(port))
            os.makedirs(d, mode=0o700, exist_ok=True)
            with open(os.path.join(d, "viewer.jnlp"), "w", encoding="utf-8") as f:
                f.write(jnlp_text)
            _docker(["rm", "-f", name], 30)
            r = _docker(["run", "-d", "--rm", "--name", name, "--label", "bmcproxy=kvm",
                         "-p", f"127.0.0.1:{lp}:6080", "-v", f"{os.path.abspath(d)}:/kvm:ro",
                         "-e", f"KVM_MAX_SECONDS={int(float(CONFIG['kvm_max_hours']) * 3600)}",
                         "-e", f"KVM_VNC_PASSWORD={password}",
                         "--memory", str(CONFIG["kvm_memory"]), "--shm-size", "64m",
                         CONFIG["kvm_image"]], 120)
            if r.returncode != 0:
                err = (r.stderr or r.stdout).strip()
                if re.search(r"Unable to find image|No such image|pull access denied", err, re.I):
                    err = f"Server chưa có image {CONFIG['kvm_image']} - chạy: sudo bash install.sh kvm"
                raise RuntimeError(err[-400:] or "docker run lỗi")
            end = time.time() + float(CONFIG["kvm_start_wait"])
            while time.time() < end:
                if _listening(lp):
                    _set(port, "ready", gen=gen)
                    return
                time.sleep(0.3)
            logs = _docker(["logs", "--tail", "15", name], 20)
            raise RuntimeError("container không mở được noVNC: " + (logs.stdout + logs.stderr).strip()[-400:])
        except FileNotFoundError:
            err = "Server chưa cài Docker (lệnh docker không có)"
        except (OSError, subprocess.SubprocessError, RuntimeError) as e:
            err = str(e)
        sys.stderr.write(f"kvm {port}: {err}\n")
        _set(port, "error", err, gen=gen)


def launch(bmc, path, client_headers, client_host):
    """Tra ve (ma HTTP, {header}, bytes) cho trinh duyet."""
    from gw_java import MAX_JNLP, add_extrnip, fetch_raw, fix_empty_host, is_jnlp, proxy_host_of, rewrite_jnlp
    host, web_port = upstream_host_port(bmc["upstream"])
    # AMI: trang launch gui EXTRNIP=<ten mien dang mo> -> BMC ghi vao .jnlp. Java chay tren proxy nen dung IP BMC.
    if re.search(r"(?i)\.jnlp", path.split("?", 1)[0]):  # thieu EXTRNIP -> BMC ghi https://(null)
        path = add_extrnip(path, host)
    status_code, headers, body = fetch_raw(bmc, path, client_headers, client_host)
    if not is_jnlp(status_code, body):
        return status_code, headers, body  # vd chuyen ve trang dang nhap BMC
    text = fix_empty_host(body[:MAX_JNLP].decode("utf-8", errors="replace"), host)
    ph = proxy_host_of(client_host)
    if ph and ph.lower() != host.lower():  # BMC lay Host cua trinh duyet -> doi nguoc ve IP BMC
        text = rewrite_jnlp(text, ph, bmc["port"], host, web_port, {})
    port = bmc["port"]
    # Moi lan Launch: mat khau VNC ngau nhien (8 ky tu - gioi han cua VNC) + cookie chu phien.
    # Chi trinh duyet da bam Launch nhan duoc mat khau -> nguoi khac mo /__kvm/ khong vao duoc console.
    password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    owner = secrets.token_urlsafe(24)
    with _glock:
        gen = (_state.get(port) or {}).get("gen", 0) + 1
        _state[port] = {"state": "starting", "error": "", "since": now_iso(), "gen": gen,
                        "password": password, "owner": owner}
    threading.Thread(target=_start, args=(bmc, text, gen, password), daemon=True).start()
    cookies = [v for k, v in headers.items() if k == "Set-Cookie"]
    cookies.append(f"{owner_cookie(port)}={owner}; Path=/; Secure; HttpOnly; SameSite=Strict")
    out = {"Set-Cookie": cookies, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}
    download = None
    if bmc.get("tcp_ports"):
        download = path + ("&" if "?" in path else "?") + "__bmcgw=download"
    with _glock:
        _state[port]["download"] = download
    return 200, out, launch_page(port, download).encode("utf-8")


def owner_cookie(port):
    return f"bmcgw_kvm_{port}"


def _cookie(header, name):
    for part in (header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == name:
            return v
    return ""


def status_response(port, cookie_header=""):
    st = status(port)
    owner, password = st.pop("owner", ""), st.pop("password", "")
    st.pop("gen", None)
    st.pop("download", None)
    if st["state"] == "ready":
        if owner and secrets.compare_digest(_cookie(cookie_header, owner_cookie(port)), owner):
            st["viewer"] = viewer_url(password)
        else:
            st["state"], st["error"] = "error", "Console này đang mở cho trình duyệt khác. Bấm Launch lại trên trang BMC."
    return 200, {"Content-Type": "application/json", "Cache-Control": "no-store"}, json.dumps(st).encode()


def wait_response(bmc):
    download = (_state.get(bmc["port"]) or {}).get("download")
    return 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}, \
        launch_page(bmc["port"], download).encode("utf-8")


def viewer_url(password=""):
    p = KVM_PATH.lstrip("/")
    return (f"{KVM_PATH}/vnc.html?autoconnect=1&resize=scale&reconnect=1&reconnect_delay=2000"
            f"&show_dot=1&path={p}/websockify" + (f"&password={password}" if password else ""))


def launch_page(port, download):
    status_url = json.dumps(KVM_CTL_PATH + "/status")
    wait_url = json.dumps(KVM_CTL_PATH + "/wait")
    dl = (f'<p class="s">Hoặc <a href="{html.escape(download)}">tải file .jnlp</a> để mở bằng Java trên máy.</p>'
          if download else "")
    return f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Console Java - BMC {port}</title>
<style>body{{font:15px system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;
min-height:100vh;margin:0}}.b{{max-width:520px;padding:28px;text-align:center}}.sp{{width:34px;height:34px;
border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;margin:0 auto 18px;animation:r 1s linear infinite}}
@keyframes r{{to{{transform:rotate(360deg)}}}}.s{{color:#94a3b8;font-size:13px}}.e{{color:#fca5a5;white-space:pre-wrap;
text-align:left;background:#1e293b;padding:12px;border-radius:8px;font:12px ui-monospace,monospace}}
a{{color:#38bdf8}}</style></head><body><div class="b"><div class="sp" id="sp"></div>
<h2 id="t">Đang mở console Java…</h2><p class="s" id="m">Server proxy đang chạy trình xem Java của BMC {port}
(thường mất 5–20 giây).</p><div id="err"></div>{dl}</div>
<script>
// Trang launch cua BMC co the goi .jnlp trong iframe an roi tu dong cua so -> chuyen ca cua so sang trang cho
try{{if(window.top!==window){{window.top.location.replace({wait_url});}}}}catch(e){{}}
var t0=Date.now();
function poll(){{if(window.top!==window)return;fetch({status_url},{{cache:"no-store",credentials:"same-origin"}}).then(function(r){{return r.json()}})
.then(function(s){{if(s.state==="ready"&&s.viewer){{location.replace(s.viewer);return}}
if(s.state==="error"){{document.getElementById("sp").style.display="none";
document.getElementById("t").textContent="Không mở được console Java";
var e=document.createElement("div");e.className="e";e.textContent=s.error;document.getElementById("err").appendChild(e);return}}
if(Date.now()-t0>90000){{document.getElementById("m").textContent="Quá lâu - tải lại trang BMC và bấm Launch lại.";return}}
setTimeout(poll,1000)}}).catch(function(){{setTimeout(poll,1500)}})}}
poll();
</script></body></html>"""
