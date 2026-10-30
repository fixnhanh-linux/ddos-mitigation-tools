"""Agent chay tren tung server Traefik.

- Dinh ky goi controller (chieu agent -> controller, HTTPS + token) de bao trang thai
  va nhan ban cau hinh (release) cua site minh.
- Ap dung release: ghi file Traefik, tat file nginx cu, restart neu them/bot cong,
  kiem tra router + cong, loi thi tu khoi phuc.
- Chay forwardAuth ngay tren may: controller chet thi site van chay voi cau hinh gan nhat.
"""

import datetime as dt
import difflib
import os
import re
import shutil
import socket
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

from gw_auth import AuthGateway, start_auth_server
from gw_limit import LimitManager
from gw_common import (BMC_DEFAULTS, BUILD, SETTINGS_DEFAULTS, bmc_ports, VERSION, ValidationError, cert_info, http_json, validate_dashboard,
                       is_managed, now_iso, read_json, read_text, run_cmd, upstream_host_port,
                       validate_bmc_fields, validate_settings_values, write_json, write_text_atomic)
from gw_nginx import DISABLED_SUFFIX, nginx_ports, scan_nginx_dir
from gw_render import active_bmcs, entry_ports, expected_routers, render_files

MAX_BACKUPS = 30

AGENT_DEFAULTS = {
    "site": "",
    "controller_url": "",
    "token": "",
    "verify_tls": True,
    "poll_interval": 10,
    "auth_listen_host": "127.0.0.1",
    "auth_listen_port": 9444,
    "traefik_static_file": "/etc/traefik/traefik.yml",
    "traefik_dynamic_dir": "/etc/traefik/dynamic",
    "traefik_restart_cmd": ["systemctl", "restart", "traefik"],
    "traefik_stop_cmd": ["systemctl", "stop", "traefik"],
    "traefik_api": "http://127.0.0.1:18080",
    "entrypoint_host": "",
    "verify_wait": 15,
    "verify_ports": True,
    # Cong moi bi chuong trinh khac giu: True = bo rieng BMC do, ap dung phan con lai (thu lai sau);
    # False = huy ca lan ap dung nhu ban cu
    "skip_busy_ports": True,
    "port_owner_cmd": ["ss", "-ltnpH"],   # xem chuong trinh nao dang giu cong (bao len web)
    "nginx_conf_dir": "/etc/nginx/conf.d",
    "nginx_test_cmd": ["nginx", "-t"],
    "nginx_reload_cmd": ["systemctl", "reload", "nginx"],
    "data_dir": "agent-data",
    "health_interval": 60,
    "health_timeout": 3,
    # Console Java tren web (BMC bat "java_web"): container Docker chay JViewer + noVNC
    "docker_cmd": ["docker"],
    "kvm_image": "bmcgw-kvm:1",
    "kvm_dir": "",            # de trong = <data_dir>/kvm
    "kvm_max_hours": 4,
    "kvm_memory": "1g",
    # Xem log tu web (Site -> Server)
    "log_cmds": {
        "agent": ["journalctl", "-u", "bmcproxy-agent", "-n", "80", "--no-pager", "-o", "short-iso"],
        "traefik": ["journalctl", "-u", "traefik", "-n", "80", "--no-pager", "-o", "short-iso"],
    },
}


def sysinfo():
    """Thong tin server gon (doc /proc tren Linux, khong can thu vien)."""
    import platform
    import shutil
    out = {"os": platform.platform(terse=True), "cpus": os.cpu_count(), "python": platform.python_version()}
    try:
        for line in open("/etc/os-release", encoding="utf-8"):
            if line.startswith("PRETTY_NAME="):
                out["os"] = line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    try:
        out["load"] = [float(x) for x in open("/proc/loadavg").read().split()[:3]]
    except (OSError, ValueError):
        pass
    try:
        mem = {}
        for line in open("/proc/meminfo"):
            k, v = line.split(":", 1)
            mem[k] = int(v.split()[0])
        out["mem_total_mb"] = mem["MemTotal"] // 1024
        out["mem_used_pct"] = round(100 * (1 - mem.get("MemAvailable", mem["MemFree"]) / mem["MemTotal"]))
    except (OSError, ValueError, KeyError, ZeroDivisionError):
        pass
    try:
        out["uptime_s"] = int(float(open("/proc/uptime").read().split()[0]))
    except (OSError, ValueError):
        pass
    try:
        du = shutil.disk_usage("/")
        out["disk_total_gb"] = round(du.total / 2 ** 30, 1)
        out["disk_used_pct"] = round(100 * du.used / du.total)
    except OSError:
        pass
    return out


def log(msg):
    print(f"{now_iso()} {msg}", flush=True)


def load_agent_config(path):
    cfg = {**AGENT_DEFAULTS, **read_json(path, {})}
    base = os.path.dirname(os.path.abspath(path))
    if not os.path.isabs(cfg["data_dir"]):
        cfg["data_dir"] = os.path.join(base, cfg["data_dir"])
    for k in ("site", "controller_url", "token"):
        if not cfg[k]:
            sys.exit(f"agent: thiếu '{k}' trong {path}")
    cfg["controller_url"] = cfg["controller_url"].rstrip("/")
    os.makedirs(os.path.join(cfg["data_dir"], "backups"), exist_ok=True)
    if not cfg["kvm_dir"]:
        cfg["kvm_dir"] = os.path.join(cfg["data_dir"], "kvm")
    return cfg


def port_listening(port, host="", timeout=1.0):
    try:
        with socket.create_connection((host or "127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def port_bindable(port, host=""):
    """Thu mo cong giong Traefik (":<cong>" = moi IPv4 + IPv6). False neu bat ky IP nao
    da bi chuong trinh khac giu (vd docker-proxy 10.0.9.239:5945)."""
    targets = [(socket.AF_INET, host)] if host and ":" not in host else \
        [(socket.AF_INET6, host)] if host else [(socket.AF_INET, "0.0.0.0"), (socket.AF_INET6, "::")]
    for fam, addr in targets:
        try:
            s = socket.socket(fam, socket.SOCK_STREAM)
        except OSError:
            continue  # may khong co IPv6
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # Go/Traefik cung dat co nay
            if fam == socket.AF_INET6 and not host:
                try:
                    s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
                except OSError:
                    pass
            s.bind((addr, port))
            s.listen(1)
        except OSError:
            return False
        finally:
            s.close()
    return True


def nginx_summary(out, ok):
    """Dua dong loi that ([emerg]/[error]) len dau, gom cac canh bao [warn] thanh 1 dong."""
    lines = (out or "").splitlines()
    warns = [ln for ln in lines if "[warn]" in ln]
    errors = [ln for ln in lines if "[emerg]" in ln or "[error]" in ln or "[crit]" in ln]
    rest = [ln for ln in lines if ln not in warns and ln not in errors]
    parts = []
    if errors:
        parts += ["LỖI:"] + errors
    elif not ok:
        parts += ["LỖI (không rõ dòng):"] + rest[-5:]
    parts += [ln for ln in rest if "successful" in ln or "syntax is ok" in ln]
    if warns:
        parts.append(f"(bỏ qua {len(warns)} cảnh báo [warn], vd: {warns[0][:120]})")
    return "\n".join(parts) or out


def _diff(old, new, a, b):
    return "".join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), a, b))


class Agent:
    def __init__(self, cfg):
        self.cfg = cfg
        self.dir = cfg["data_dir"]
        self.lock = threading.RLock()
        self.release = read_json(self._p("release.json"), None)   # ban dang chay
        self.active = self.release                                 # ban forwardAuth dang dung
        self.legacy = read_json(self._p("legacy.json"), {"files": []})["files"]
        self.attempt = read_json(self._p("attempt.json"), {})
        self.gateway = AuthGateway(lambda: self.active)
        self.health = {}
        self.limits = LimitManager()
        self.extra = {}             # ket qua lenh tu web (log, kiem tra BMC...) - gui 1 lan roi xoa
        self.extra_lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=16)
        self.controller_ok = None
        self.last_contact = None
        self.skipped = read_json(self._p("skipped.json"), [])     # BMC bi bo qua o lan ap dung gan nhat

    def _p(self, name):
        return os.path.join(self.dir, name)

    # ------------------------------------------------------------ thong tin
    def params(self):
        c = self.cfg
        return {"dynamic_dir": c["traefik_dynamic_dir"], "auth_host": c["auth_listen_host"],
                "auth_port": c["auth_listen_port"], "api": c["traefik_api"],
                "entrypoint_host": c["entrypoint_host"]}

    def reserved_ports(self):
        out = [self.cfg["auth_listen_port"]]
        api = urllib.parse.urlparse(self.cfg.get("traefik_api") or "")
        if api.port:
            out.append(api.port)
        return out

    def legacy_active(self):
        ndir = self.cfg.get("nginx_conf_dir") or ""
        return [f for f in self.legacy if ndir and os.path.isfile(os.path.join(ndir, f))]

    def traefik_routers(self):
        api = (self.cfg.get("traefik_api") or "").rstrip("/")
        if not api:
            return None
        try:
            status, data = http_json(f"{api}/api/http/routers?per_page=10000", timeout=2)
        except OSError:
            return None
        if status != 200 or not isinstance(data, list):
            return None
        out = {}
        for r in data:
            name = r.get("name", "")
            if name.endswith("@file") and name.startswith("bmc-"):
                out[name[:-5]] = {"status": r.get("status"),
                                  "error": "; ".join(r.get("error") or []),
                                  "rule": r.get("rule"), "entryPoints": r.get("entryPoints")}
        return out

    def traefik_summary(self):
        api = (self.cfg.get("traefik_api") or "").rstrip("/")
        out = {"reachable": False, "api": api}
        if not api:
            return out
        try:
            _, ver = http_json(f"{api}/api/version", timeout=2)
            _, eps = http_json(f"{api}/api/entrypoints", timeout=2)
        except OSError as e:
            out["error"] = str(e)
            return out
        routers = self.traefik_routers()
        out.update(reachable=routers is not None, version=(ver or {}).get("Version"),
                   entrypoints=len(eps or []),
                   routers=[{"name": n, **r} for n, r in sorted((routers or {}).items())])
        return out

    def local_warnings(self):
        w = []
        rel = self.release
        if rel:
            c = cert_info(rel["settings"]["cert_file"])
            warn_days = rel["settings"].get("cert_warn_days", SETTINGS_DEFAULTS["cert_warn_days"])
            if not c["ok"]:
                w.append({"level": "warn", "text": f"Không đọc được chứng chỉ {c['file']}"})
            elif c["days"] < warn_days:
                w.append({"level": "danger" if c["days"] < 7 else "warn",
                          "text": f"Chứng chỉ hết hạn sau {c['days']} ngày ({c['expires']})"})
            ours = set(entry_ports(rel))
            legacy = set(self.legacy)
            for port, fname in sorted(nginx_ports(self.cfg.get("nginx_conf_dir")).items()):
                if port in ours and fname not in legacy:
                    w.append({"level": "danger",
                              "text": f"Cổng {port} đang bị nginx ({fname}) dùng"})
        for x in self.skipped or []:
            w.append({"level": "danger", "text": f"BMC {x['port']} chưa chạy: cổng {x.get('owner') or x.get('busy')} "
                                                 "đang bị chương trình khác dùng - tắt chương trình đó rồi bấm Thử lại"})
        if self.legacy_active():
            w.append({"level": "info",
                      "text": f"Còn {len(self.legacy_active())} file nginx cũ, sẽ tắt ở lần áp dụng tới"})
        return w

    # ------------------------------------------------------------ suc khoe BMC
    @staticmethod
    def probe(url, timeout):
        host, port = upstream_host_port(url)
        if not host:
            return {"up": False, "ms": None}
        t0 = time.monotonic()
        try:
            with socket.create_connection((host, port), timeout=timeout):
                pass
            return {"up": True, "ms": round((time.monotonic() - t0) * 1000)}
        except OSError:
            return {"up": False, "ms": None}

    def check_health(self):
        t = self.cfg["health_timeout"]
        jobs = {}
        for b in active_bmcs(self.active):
            jobs[(b["port"], "web")] = self.pool.submit(self.probe, b["upstream"], t)
            if b["console_port"]:
                jobs[(b["port"], "console")] = self.pool.submit(self.probe, b["console_upstream"], t)
        result = {}
        for (port, kind), fut in jobs.items():
            result.setdefault(port, {"checked": now_iso()})[kind] = fut.result()
        self.health = result

    def health_loop(self):
        while True:
            try:
                self.check_health()
            except Exception as e:
                log(f"health check error: {e}")
            time.sleep(self.cfg["health_interval"])

    # ------------------------------------------------------------ controller
    def call(self, method, path, data=None, timeout=15):
        return http_json(f"{self.cfg['controller_url']}/agent/v1/{path}", method, data,
                         headers={"Authorization": f"Bearer {self.cfg['token']}",
                                  "X-Agent-Site": self.cfg["site"]},
                         timeout=timeout, verify=self.cfg["verify_tls"])

    def heartbeat(self):
        return {
            "site": self.cfg["site"], "version": VERSION, "build": BUILD, "hostname": socket.gethostname(),
            "params": self.params(), "reserved_ports": self.reserved_ports(),
            "applied_rev": (self.release or {}).get("rev"),
            "attempt": self.attempt, "health": {str(k): v for k, v in self.health.items()},
            "limits": self.limits.stats(),
            "auth_stats": {str(k): v for k, v in self.gateway.get_stats().items()},
            "traefik": self.traefik_summary(), "warnings": self.local_warnings(),
            "legacy_active": self.legacy_active(), "time": now_iso(),
            "sysinfo": sysinfo(),
        }

    def sync_once(self):
        hb = self.heartbeat()
        with self.extra_lock:
            sent = dict(self.extra)
        hb.update(sent)
        access = self.gateway.pop_access()  # lan mo BMC / console (gui 1 lan, loi thi gui lai)
        if access:
            hb["access"] = access
        denied = self.gateway.pop_denied()  # lan bi chan (gom theo IP + cong + ly do)
        if denied:
            hb["denied"] = denied
        autoban = self.gateway.shield.pop_events()  # IP tu chan vi do mat khau -> web tao quy tac chan
        if autoban:
            hb["autoban"] = autoban
        hb["security_rev"] = self.gateway.shield.rev
        try:
            status, resp = self.call("POST", "sync", hb)
        except OSError as e:
            self.gateway.requeue_access(access)
            self.gateway.requeue_denied(denied)
            self.gateway.shield.requeue_events(autoban)
            if self.controller_ok is not False:
                log(f"không kết nối được controller: {e}")
            self.controller_ok = False
            return
        if status != 200 or not isinstance(resp, dict):
            self.gateway.requeue_access(access)
            self.gateway.requeue_denied(denied)
            self.gateway.shield.requeue_events(autoban)
            log(f"controller trả lỗi {status}: {resp}")
            self.controller_ok = False
            return
        if "guests" in resp:
            self.gateway.set_guests(resp["guests"])
        if "maint" in resp:
            self.gateway.set_maint(resp["maint"])
        if "ip_rules" in resp:
            self.gateway.set_ip_rules(resp["ip_rules"])
        if isinstance(resp.get("security"), dict):  # chi gui khi cau hinh bao ve doi (security_rev khac)
            self.gateway.shield.set_config(resp["security"])
            log(f"đã nhận cấu hình bảo vệ {resp['security'].get('rev', '')}")
        if self.controller_ok is not True:
            log("đã kết nối controller")
        self.controller_ok = True
        self.last_contact = now_iso()
        if status == 200:
            with self.extra_lock:
                for k, v in sent.items():
                    if self.extra.get(k) is v:
                        del self.extra[k]
        for cmd in resp.get("commands") or []:
            threading.Thread(target=self.run_command, args=(cmd,), daemon=True).start()
        target = resp.get("target")
        if not target:
            return
        key = (target.get("rev"), target.get("attempt"))
        if key == (self.attempt.get("rev"), self.attempt.get("attempt")):
            return
        release = resp.get("release")
        if release:
            self.last_release = release  # de "Kiem tra BMC" dung duoc ca khi chua ap dung thanh cong
        if not release or release.get("rev") != target.get("rev"):
            return
        log(f"áp dụng bản {target['rev']} (lần {target['attempt']})")
        try:
            result = self.apply_release(release)
        except Exception as e:  # ghi nhan that bai de khong thu lai lien tuc moi 10 giay
            result = {"ok": False, "log": [{"step": "Lỗi bất ngờ", "ok": False,
                                            "output": f"{type(e).__name__}: {e}"}]}
        self.attempt = {"rev": target["rev"], "attempt": target["attempt"], "ok": result["ok"],
                        "log": result["log"], "at": now_iso(), "skipped": result.get("skipped") or []}
        write_json(self._p("attempt.json"), self.attempt)
        log(f"kết quả: {'thành công' if result['ok'] else 'LỖI - đã khôi phục'}")
        try:
            self.call("POST", "report", self.attempt)
        except OSError as e:
            log(f"không gửi được kết quả: {e}")

    def run_command(self, cmd):
        name = cmd.get("name") if isinstance(cmd, dict) else cmd
        if name == "recheck":
            self.check_health()
        elif name == "clear_cache":
            log(f"đã xoá {self.gateway.clear_cache()} mục cache xác thực")
        elif name == "import":
            self.do_import()
        elif name == "logs":
            self.collect_logs()
        elif name == "diagnose":
            self.diagnose_bmcs(cmd.get("bmcs") if isinstance(cmd, dict) else None)
        elif name == "detect":
            import gw_errpage
            ip = str(cmd.get("ip", "")) if isinstance(cmd, dict) else ""
            try:
                r = gw_errpage.detect_bmc(ip)
            except Exception as e:  # khong de 1 IP la lam hong vong lap lenh
                r = {"ip": ip, "at": now_iso(), "error": f"lỗi khi dò: {e}"}
            self.put_extra("detect", {**r, "req": cmd.get("req", "")})
        elif name == "restart_traefik":
            with self.lock:  # khong chen giua luc dang ap dung cau hinh
                ok, out = run_cmd(self.cfg["traefik_restart_cmd"])
            log(f"web yêu cầu restart Traefik: {'OK' if ok else 'LỖI'} {out[-200:]}")
            self.put_extra("action", {"name": name, "ok": ok, "output": out[-2000:], "at": now_iso()})
        elif name == "update_agent":
            with self.lock:  # khong chen giua luc dang ap dung cau hinh
                self.update_agent(cmd if isinstance(cmd, dict) else {})
        elif name == "restart_agent":
            log("web yêu cầu restart agent - thoát để systemd chạy lại")
            self.put_extra("action", {"name": name, "ok": True, "output": "agent đang khởi động lại", "at": now_iso()})
            threading.Timer(4, lambda: os._exit(3)).start()   # cho kip gui ket qua o lan sync sau

    def update_agent(self, cmd):
        """Tai goi agent moi tu web (kiem SHA-256), thu import, sao luu ban cu, chep de roi khoi dong lai."""
        import hashlib
        import tempfile
        import urllib.request
        import zipfile
        from gw_common import ssl_context

        def done(ok, out):
            log(f"cập nhật agent: {'OK' if ok else 'LỖI'} {out}")
            self.put_extra("action", {"name": "update_agent", "ok": ok, "output": out, "at": now_iso(),
                                      "from": BUILD, "to": cmd.get("build", "")})

        app_dir = os.path.dirname(os.path.abspath(__file__))
        if os.path.isdir(os.path.join(os.path.dirname(app_dir), "controller")):
            return done(False, "agent đang chạy từ thư mục mã nguồn - không tự cập nhật")
        if not re.fullmatch(r"[0-9a-f]{64}", str(cmd.get("sha256", ""))):
            return done(False, "lệnh thiếu mã SHA-256 của gói")
        url = f"{self.cfg['controller_url']}/agent/v1/package"
        req = urllib.request.Request(url, data=b"{}", method="POST", headers={
            "Authorization": f"Bearer {self.cfg['token']}", "X-Agent-Site": self.cfg["site"],
            "Content-Type": "application/json"})
        ctx = ssl_context(self.cfg["verify_tls"]) if url.startswith("https") else None
        try:
            with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
                data = r.read(30 * 1024 * 1024 + 1)
        except OSError as e:
            return done(False, f"không tải được gói từ web: {e}")
        if hashlib.sha256(data).hexdigest() != cmd["sha256"]:
            return done(False, "SHA-256 của gói tải về không khớp - bỏ qua")
        tmp = tempfile.mkdtemp(prefix="agent-update-", dir=self.dir)
        try:
            zpath = os.path.join(tmp, "agent.zip")
            with open(zpath, "wb") as f:
                f.write(data)
            with zipfile.ZipFile(zpath) as z:
                names = z.namelist()
                if any(n.startswith("/") or ".." in n.split("/") or not n.startswith("bmc-gateway-agent/") for n in names):
                    return done(False, "gói có đường dẫn lạ - bỏ qua")
                z.extractall(tmp)
            src = os.path.join(tmp, "bmc-gateway-agent")
            for need in ("bmcproxy.py", "gw_agent.py", "gw_auth.py", "gw_common.py"):
                if not os.path.isfile(os.path.join(src, need)):
                    return done(False, f"gói thiếu {need}")
            ok, out = run_cmd([sys.executable, "-c", "import sys; sys.path.insert(0, sys.argv[1]); "
                               "import gw_agent, gw_auth, gw_render, gw_limit, gw_nginx, gw_errpage, gw_java, gw_kvm", src],
                              timeout=60)
            if not ok:
                return done(False, f"bản mới chạy thử lỗi, giữ bản cũ: {out[-600:]}")
            bdir = os.path.join(self.dir, "agent-backup-" + dt.datetime.now().strftime("%Y%m%d-%H%M%S"))
            os.makedirs(bdir)
            for n in os.listdir(app_dir):
                p = os.path.join(app_dir, n)
                if os.path.isfile(p) and (n.endswith(".py") or n in ("BUILD", "VERSION")):
                    shutil.copy2(p, bdir)
            if os.path.isdir(os.path.join(app_dir, "kvm")):
                shutil.copytree(os.path.join(app_dir, "kvm"), os.path.join(bdir, "kvm"))
            for n in os.listdir(src):
                p = os.path.join(src, n)
                if os.path.isfile(p) and (n.endswith(".py") or n in ("BUILD", "VERSION")):
                    shutil.copy2(p, os.path.join(app_dir, n + ".new"))
                    os.replace(os.path.join(app_dir, n + ".new"), os.path.join(app_dir, n))
            if os.path.isdir(os.path.join(src, "kvm")):
                shutil.rmtree(os.path.join(app_dir, "kvm"), ignore_errors=True)
                shutil.copytree(os.path.join(src, "kvm"), os.path.join(app_dir, "kvm"))
            olds = sorted(d for d in os.listdir(self.dir) if d.startswith("agent-backup-"))
            for d in olds[:-3]:
                shutil.rmtree(os.path.join(self.dir, d), ignore_errors=True)
        except (OSError, zipfile.BadZipFile) as e:
            return done(False, f"lỗi khi cài bản mới: {e}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        done(True, f"đã cập nhật {BUILD} → {cmd.get('build') or '?'} (bản cũ lưu ở {bdir}), đang khởi động lại agent")
        threading.Timer(4, lambda: os._exit(3)).start()   # systemd (Restart=always) chay ban moi

    def put_extra(self, key, value):
        with self.extra_lock:
            self.extra[key] = value

    def collect_logs(self):
        out = {"at": now_iso()}
        for k, cmd in (self.cfg.get("log_cmds") or {}).items():
            if not cmd:
                continue
            ok, text = run_cmd(cmd, timeout=20)
            out[k] = text[-20000:] if text else ("(không có log)" if ok else "(lỗi đọc log)")
        self.put_extra("logs", out)

    def diagnose_bmcs(self, given=None):
        """Ping / thu cong / thu TLS moi BMC cua site (giong trang loi IPMI)."""
        import gw_errpage
        bmcs = [b for b in given if b.get("enabled", True) and b.get("upstream")] if given else             (active_bmcs(self.active) or active_bmcs(getattr(self, "last_release", None)))
        futs = [(b, self.pool.submit(gw_errpage.diagnose, b["upstream"], b.get("legacy_tls"))) for b in bmcs]
        rows = []
        for b, f in futs:
            try:
                d = f.result(timeout=30)
            except Exception as e:
                d = {"code": "bad", "tcp_error": str(e)}
            rows.append({"port": b["port"], "note": b.get("note", ""), "upstream": b["upstream"],
                         "legacy_tls": bool(b.get("legacy_tls")), **{k: d.get(k) for k in (
                             "code", "host", "ping", "tcp", "ms", "tcp_error", "tls", "tls_info")}})
        self.put_extra("diag", {"at": now_iso(), "rows": sorted(rows, key=lambda r: r["port"])})

    def do_import(self):
        found, skipped = scan_nginx_dir(self.cfg.get("nginx_conf_dir") or "")
        try:
            status, resp = self.call("POST", "import", {"items": found, "skipped": skipped})
        except OSError as e:
            log(f"gửi kết quả nhập nginx lỗi: {e}")
            return
        if status == 200 and isinstance(resp, dict):
            with self.lock:
                self.legacy = sorted(set(self.legacy) | set(resp.get("accepted", [])))
                write_json(self._p("legacy.json"), {"files": self.legacy})
            log(f"nhập nginx: {len(resp.get('accepted', []))} BMC")

    # ------------------------------------------------------------ ap dung
    def validate_release(self, rel):
        if not isinstance(rel, dict) or rel.get("site") != self.cfg["site"]:
            raise ValidationError("Release không thuộc site này")
        settings = validate_settings_values(rel.get("settings") or {})
        bmcs, seen = [], set()
        reserved = set(self.reserved_ports())
        for raw in rel.get("bmcs") or []:
            b = validate_bmc_fields(raw)
            if b["site"] != self.cfg["site"]:
                raise ValidationError(f"BMC {b['port']} không thuộc site này")
            ports = bmc_ports(b)
            if b["enabled"] and (ports & seen or ports & reserved):
                raise ValidationError(f"Cổng trùng: {sorted(ports & (seen | reserved))}")
            if b["enabled"]:
                seen |= ports
            bmcs.append(b)
        out = {**rel, "settings": settings, "bmcs": bmcs}
        if rel.get("dashboard"):
            dash = validate_dashboard(rel["dashboard"])
            if dash["enabled"] and dash["port"] in (seen | reserved):
                raise ValidationError(f"Cổng dashboard {dash['port']} trùng cổng khác")
            out["dashboard"] = dash
        return out

    def plan(self, rel):
        c = self.cfg
        static, dyn = render_files(rel, self.params())
        changes = []
        sp = c["traefik_static_file"]
        old = read_text(sp) if os.path.isfile(sp) else ""
        if old != static:
            changes.append({"area": "static", "file": "traefik.yml",
                            "kind": "modify" if old else "add",
                            "diff": _diff(old, static, "a/traefik.yml", "b/traefik.yml")})
        ddir = c["traefik_dynamic_dir"]
        existing = set(os.listdir(ddir)) if os.path.isdir(ddir) else set()
        for name, content in sorted(dyn.items()):
            path = os.path.join(ddir, name)
            o = read_text(path) if name in existing else ""
            if o != content:
                changes.append({"area": "dynamic", "file": name, "kind": "modify" if o else "add",
                                "diff": _diff(o, content, f"a/{name}", f"b/{name}")})
        for name in sorted(existing - set(dyn)):
            path = os.path.join(ddir, name)
            if os.path.isfile(path) and is_managed(path):
                changes.append({"area": "dynamic", "file": name, "kind": "delete", "diff": ""})
        for name in self.legacy_active():
            changes.append({"area": "nginx", "file": name, "kind": "disable", "diff": ""})
        return changes, static, dyn

    def snapshot(self, label):
        c = self.cfg
        bdir = os.path.join(self.dir, "backups")
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
        dest = os.path.join(bdir, f"{stamp}-{label}")
        os.makedirs(os.path.join(dest, "dynamic"))
        if os.path.isfile(c["traefik_static_file"]):
            shutil.copy2(c["traefik_static_file"], os.path.join(dest, "traefik.yml"))
        ddir = c["traefik_dynamic_dir"]
        if os.path.isdir(ddir):
            for f in os.listdir(ddir):
                p = os.path.join(ddir, f)
                if os.path.isfile(p) and is_managed(p):
                    shutil.copy2(p, os.path.join(dest, "dynamic", f))
        write_json(os.path.join(dest, "release.json"), self.release)
        backups = sorted(os.listdir(bdir))
        for old in backups[:-MAX_BACKUPS]:
            shutil.rmtree(os.path.join(bdir, old), ignore_errors=True)
        return dest

    def restore_files(self, bpath):
        c = self.cfg
        src = os.path.join(bpath, "traefik.yml")
        if os.path.isfile(src):
            shutil.copy2(src, c["traefik_static_file"])
        elif os.path.isfile(c["traefik_static_file"]) and is_managed(c["traefik_static_file"]):
            os.remove(c["traefik_static_file"])
        ddir = c["traefik_dynamic_dir"]
        os.makedirs(ddir, exist_ok=True)
        keep = set(os.listdir(os.path.join(bpath, "dynamic")))
        for f in os.listdir(ddir):
            p = os.path.join(ddir, f)
            if os.path.isfile(p) and is_managed(p) and f not in keep:
                os.remove(p)
        for f in keep:
            shutil.copy2(os.path.join(bpath, "dynamic", f), os.path.join(ddir, f))

    def set_nginx(self, names, enabled):
        ndir = self.cfg["nginx_conf_dir"]
        for n in names:
            on, off = os.path.join(ndir, n), os.path.join(ndir, n + DISABLED_SUFFIX)
            if enabled and os.path.isfile(off):
                os.replace(off, on)
            elif not enabled and os.path.isfile(on):
                os.replace(on, off)

    @staticmethod
    def bmc_ports_of(b):
        b = {**BMC_DEFAULTS, **b}
        ports = [b["port"]] + ([b["console_port"]] if b.get("console_port") else [])
        return ports + [t["proxy"] for t in b.get("tcp_ports") or []]

    def port_owners(self, ports):
        """{cong: "Xvnc (pid 1234)"} - doc tu ss -ltnp (de nguoi dung biet tat chuong trinh nao)."""
        ok, out = run_cmd(self.cfg.get("port_owner_cmd") or [], timeout=10)
        res = {}
        if not ok or not out:
            return res
        # LISTEN 0 4096 0.0.0.0:5901 0.0.0.0:* users:(("Xvnc",pid=1234,fd=6))
        for line in out.splitlines():
            cols = line.split()
            if len(cols) < 5:
                continue
            local = cols[3].rsplit(":", 1)
            if len(local) != 2 or not local[1].isdigit() or int(local[1]) not in ports:
                continue
            procs = re.findall(r'"([^"]+)",pid=(\d+)', line)
            who = ", ".join(sorted({f"{n} (pid {p})" for n, p in procs})) or "không rõ (cần chạy agent bằng root)"
            res.setdefault(int(local[1]), who)
        return res

    def busy_new_ports(self, rel, old_static):
        """Traefik se dung han neu khong mo duoc mot entryPoint -> kiem tra truoc khi restart."""
        old = {int(p) for p in re.findall(r'address: "[^"]*:(\d+)"', old_static or "")}
        host = self.cfg.get("entrypoint_host")
        return [p for p in entry_ports(rel)
                if p not in old and (port_listening(p, host, 0.5) or not port_bindable(p, host))]

    def verify(self, rel, restarted):
        c = self.cfg
        if not c.get("traefik_api"):
            return True, "(bỏ qua - chưa cấu hình traefik_api)"
        want = expected_routers(rel)
        deadline = time.monotonic() + c["verify_wait"]
        problems = ["Traefik chưa phản hồi"]
        while time.monotonic() < deadline:
            time.sleep(1.5)
            routers = self.traefik_routers()
            if routers is None:
                problems = ["Không gọi được API Traefik"]
                continue
            problems = []
            for n in want:
                r = routers.get(n)
                if not r:
                    problems.append(f"{n}: Traefik chưa nạp")
                elif r["status"] != "enabled" or r["error"]:
                    problems.append(f"{n}: {r['status']} {r['error']}".strip())
            if c.get("verify_ports") and restarted and not problems:
                for p in entry_ports(rel):
                    if not port_listening(p, c.get("entrypoint_host")):
                        problems.append(f"Cổng {p} chưa mở")
            if not problems:
                return True, f"Traefik đã nạp {len(want)} router, tất cả hoạt động"
        return False, "\n".join(problems[:50])

    def apply_release(self, rel):
        c = self.cfg
        with self.lock:
            try:
                rel = self.validate_release(rel)
            except ValidationError as e:
                return {"ok": False, "log": [{"step": "Kiểm tra dữ liệu", "ok": False,
                                              "output": str(e)}]}
            changes, static, dyn = self.plan(rel)
            log_ = []
            if not changes:
                self.release = self.active = rel
                write_json(self._p("release.json"), rel)
                return {"ok": True, "log": [{"step": "Kế hoạch", "ok": True,
                                             "output": "Không có thay đổi trên server"}]}
            bpath = self.snapshot("apply")
            log_.append({"step": "Sao lưu", "ok": True, "output": os.path.basename(bpath)})
            static_changed = any(x["area"] == "static" for x in changes)
            to_disable = [x["file"] for x in changes if x["area"] == "nginx"]
            sp = c["traefik_static_file"]
            old_static = read_text(sp) if os.path.isfile(sp) else ""
            previous_active = self.active
            self.active = rel  # forwardAuth biet BMC moi ngay khi Traefik nap
            for err in self.limits.sync(previous_active, rel):  # bo gioi han ket noi phai co truoc Traefik
                log_.append({"step": "Giới hạn kết nối", "ok": False, "output": err})
            restarted, ok = False, True
            skipped = []
            ddir = c["traefik_dynamic_dir"]
            try:
                os.makedirs(ddir, exist_ok=True)
                for x in changes:
                    if x["area"] != "dynamic":
                        continue
                    path = os.path.join(ddir, x["file"])
                    if x["kind"] == "delete":
                        os.remove(path)
                    else:
                        write_text_atomic(path, dyn[x["file"]])
                if static_changed:
                    write_text_atomic(sp, static)
                n = sum(x["area"] == "dynamic" for x in changes)
                log_.append({"step": "Ghi config", "ok": True,
                             "output": f"{n} file dynamic" + (", traefik.yml" if static_changed else "")})
                nginx_map = nginx_ports(c.get("nginx_conf_dir")) if to_disable else {}  # cong -> file (truoc khi tat)
                if to_disable:
                    self.set_nginx(to_disable, False)
                    ok, out = run_cmd(c["nginx_test_cmd"])
                    log_.append({"step": "nginx -t", "ok": ok, "output": nginx_summary(out, ok)})
                    if ok:
                        ok, out = run_cmd(c["nginx_reload_cmd"])
                        log_.append({"step": f"Tắt {len(to_disable)} file nginx cũ", "ok": ok,
                                     "output": out})
                if ok and static_changed:
                    if to_disable:
                        time.sleep(1)
                    busy = self.busy_new_ports(rel, old_static)
                    if busy and c.get("skip_busy_ports", True):
                        owners = self.port_owners(set(busy))
                        drop = [b for b in rel["bmcs"] if set(self.bmc_ports_of(b)) & set(busy)]
                        keep = [b for b in rel["bmcs"] if b not in drop]
                        if drop:
                            # Ap dung phan con lai: viet lai config khong co cac BMC nay roi kiem tra lai
                            rel = {**rel, "bmcs": keep}
                            self.active = rel
                            changes2, static, dyn = self.plan(rel)
                            for x in changes2:
                                if x["area"] != "dynamic":
                                    continue
                                path = os.path.join(ddir, x["file"])
                                if x["kind"] == "delete":
                                    if os.path.exists(path):
                                        os.remove(path)
                                else:
                                    write_text_atomic(path, dyn[x["file"]])
                            write_text_atomic(sp, static)
                            static_changed = static != old_static
                            skipped = []
                            for b in drop:
                                ps = sorted(set(self.bmc_ports_of(b)) & set(busy))
                                skipped.append({"port": b["port"], "note": b.get("note", ""), "busy": ps,
                                                "owner": "; ".join(f"{p}: {owners.get(p, 'không rõ')}" for p in ps)})
                            log_.append({"step": f"Bỏ qua {len(skipped)} BMC (cổng đang bị chương trình khác dùng)",
                                         "ok": True, "warn": True, "output": "\n".join(
                                             f"BMC {x['port']}{' · ' + x['note'] if x['note'] else ''}: cổng {x['owner']}"
                                             for x in skipped)
                                         + "\nCác BMC khác vẫn áp dụng. Tắt chương trình đang giữ cổng (hoặc đổi cổng BMC) rồi bấm Thử lại."})
                            # BMC bi bo qua truoc day chay bang nginx: bat lai file nginx cua no (neu file do chi
                            # nghe cong cua BMC bi bo qua) de BMC khong mat han; lan ap dung sau se tat lai
                            dropped = {p for b in drop for p in self.bmc_ports_of(b)}
                            kept_ports = set(entry_ports(rel))
                            back = sorted({f for p, f in nginx_map.items() if p in dropped and f in to_disable
                                           and not ({q for q, g in nginx_map.items() if g == f} & kept_ports)})
                            if back:
                                self.set_nginx(back, True)
                                to_disable = [f for f in to_disable if f not in back]
                                ok2, out2 = run_cmd(c["nginx_reload_cmd"])
                                log_.append({"step": f"Giữ lại {len(back)} file nginx của BMC bị bỏ qua", "ok": ok2,
                                             "warn": True, "output": ", ".join(back) + ("\n" + out2 if out2 else "")})
                            busy = self.busy_new_ports(rel, old_static) if static_changed else []
                    if busy:
                        ok = False
                        owners = self.port_owners(set(busy))
                        log_.append({"step": "Kiểm tra cổng trống", "ok": False,
                                     "output": "Cổng đang bị chương trình khác dùng: "
                                               + ", ".join(f"{p} ({owners.get(p, 'không rõ')})" for p in busy)
                                               + ". Không restart Traefik để tránh làm sập mọi BMC."})
                if ok and (static_changed or to_disable):
                    ok, out = run_cmd(c["traefik_restart_cmd"])
                    restarted = True
                    log_.append({"step": "Restart Traefik", "ok": ok, "output": out})
                if ok:
                    ok, out = self.verify(rel, restarted)
                    log_.append({"step": "Kiểm tra Traefik", "ok": ok, "output": out})
            except Exception as e:  # loi bat ngo van phai khoi phuc
                ok = False
                log_.append({"step": "Lỗi bất ngờ", "ok": False, "output": f"{type(e).__name__}: {e}"})

            if ok:
                self.release = rel
                write_json(self._p("release.json"), rel)
                self.skipped = skipped
                write_json(self._p("skipped.json"), skipped)
                self.limits.sync(rel)
                gone = set(to_disable)
                self.legacy = [f for f in self.legacy if f not in gone]
                write_json(self._p("legacy.json"), {"files": self.legacy})
            else:
                self.active = previous_active
                self.restore_files(bpath)
                self.limits.sync(previous_active)
                out = [f"Đã khôi phục config Traefik ({os.path.basename(bpath)})"]
                if to_disable:
                    self.set_nginx(to_disable, True)
                if restarted and os.path.isfile(sp):
                    out.append("restart Traefik: " + run_cmd(c["traefik_restart_cmd"])[1])
                elif restarted:
                    # Truoc do server chua co cau hinh Traefik: dung han, khong chay voi cau hinh mac dinh
                    out.append("dừng Traefik: " + run_cmd(c["traefik_stop_cmd"])[1])
                if to_disable:
                    out.append("bật lại nginx: " + run_cmd(c["nginx_reload_cmd"])[1])
                log_.append({"step": "Khôi phục", "ok": True, "output": "\n".join(out)})
            return {"ok": ok, "log": log_, "skipped": skipped if ok else []}

    # ------------------------------------------------------------ chay
    def run(self, once=False):
        c = self.cfg
        if once:
            self.check_health()
            self.sync_once()
            return
        import gw_kvm
        gw_kvm.configure(c)
        for err in self.limits.sync(self.active):
            log(err)
        start_auth_server(self.gateway, c["auth_listen_host"], c["auth_listen_port"])
        log(f"agent site={c['site']} forwardAuth http://{c['auth_listen_host']}:{c['auth_listen_port']}"
            f" controller={c['controller_url']}")
        threading.Thread(target=self.health_loop, daemon=True).start()
        while True:
            try:
                self.sync_once()
            except Exception as e:
                import traceback
                traceback.print_exc()
                log(f"sync error: {e}")
            time.sleep(c["poll_interval"])
