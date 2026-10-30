"""Controller: giao dien web + API quan ly BMC cua nhieu site, va API cho agent.

Controller KHONG ghi config Traefik. No giu 'ban mong muon' cua tung site; khi bam Ap dung,
no phat hanh mot release. Agent cua site do keo release ve, ap dung, bao ket qua.
"""

import datetime as dt
import difflib
import hmac
import http.server
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import sys
import threading
import time
import traceback
import urllib.parse

import gw_ldap
import gw_notify
from gw_auth import ThreadingServer
from gw_common import (BMC_DEFAULTS, bmc_ports, parse_tcp_ports, DASHBOARD_DEFAULTS, OVERRIDABLE, apr1_hash, validate_dashboard, RE_DOMAIN, RE_IP, RE_SITE_KEY, RE_USER, ROLES, PERMS, ROLE_PERMS, user_perms,
                       SETTINGS_DEFAULTS, VERSION, GUEST_PATH, ValidationError, cert_info, check_password, totp_check, totp_new_secret, totp_uri,
                       clean_text, hash_password, hash_token, now_iso, read_json, to_port,
                       validate_bmc_fields, validate_settings_values, write_json)
from gw_templates import (BUILTIN_TEMPLATES, RE_IPHOST, all_templates, apply_template, export_csv, parse_rows,
                          row_to_bmc, validate_template)
from gw_render import DEFAULT_PARAMS, release_rev, render_bmc, render_files

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
# Goi agent de lenh cai 1 dong tai ve (install.sh web chep vao day)
AGENT_PKG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent-package")
INSTALL_TTL = 3600          # ma cai agent het han sau 1 gio
INSTALL_PKG_WINDOW = 900    # sau khi dung ma: 15 phut de tai goi
# Cap nhat agent ban cu (chua co lenh update_agent) bang 1 dong tren server: khong doi token / agent.json
UPDATE_SCRIPT = '#!/usr/bin/env bash\n# Treafix Proxy BB - cap nhat agent site __SITE__ (tao boi web luc __NOW__). Giu agent.json, token, Traefik. Ma dung 1 lan.\nset -euo pipefail\nWEB="__WEB__"\nCODE="__CODE__"\nsay() { printf \'\\n\\033[1;36m==> %s\\033[0m\\n\' "$*"; }\ndie() { printf \'\\n\\033[1;31mLOI: %s\\033[0m\\n\' "$*" >&2; exit 1; }\n[ "$(id -u)" = 0 ] || die "Chạy bằng root: curl -fsSk $WEB/install/... | sudo bash"\ncommand -v python3 >/dev/null || die "Thiếu python3"\nsay "Tải gói agent từ web"\ncd /home\ncurl -fsSk --max-time 120 -o bmc-gateway-agent.zip "$WEB/install/$CODE/agent.zip" \\\n  || die "Không tải được gói agent (mã hết hạn? - tạo lệnh mới trên web: Site → Cập nhật agent)"\nrm -rf /home/bmc-gateway-agent\npython3 -m zipfile -e bmc-gateway-agent.zip /home\n[ -f /home/bmc-gateway-agent/install.sh ] || die "Gói agent không đúng"\nsay "Cài đè agent (giữ agent.json + cấu hình Traefik, không restart Traefik)"\nbash /home/bmc-gateway-agent/install.sh agent || die "Cài chưa xong - xem lỗi ở trên, chạy lại: sudo bash /home/bmc-gateway-agent/install.sh agent"\necho\necho "Xong. Trên web, thẻ site __SITE__ hiện bản agent mới trong ~10 giây; lần sau chỉ cần bấm Cập nhật agent."\n'
INSTALL_SCRIPT = '#!/usr/bin/env bash\n# Treafix Proxy BB - cai agent cho site __SITE__ (tao boi web luc __NOW__). Ma cai chi dung 1 lan.\nset -euo pipefail\nWEB="__WEB__"\nCODE="__CODE__"\nsay() { printf \'\\n\\033[1;36m==> %s\\033[0m\\n\' "$*"; }\ndie() { printf \'\\n\\033[1;31mLOI: %s\\033[0m\\n\' "$*" >&2; exit 1; }\n[ "$(id -u)" = 0 ] || die "Chạy bằng root: curl -fsSk $WEB/install/... | sudo bash"\ncommand -v python3 >/dev/null || die "Thiếu python3 (Ubuntu 22.04 có sẵn)"\ncommand -v curl >/dev/null || die "Thiếu curl: apt install -y curl"\n\nsay "Tải gói agent từ web"\ncd /home\ncurl -fsSk --max-time 120 -o bmc-gateway-agent.zip "$WEB/install/$CODE/agent.zip" \\\n  || die "Không tải được gói agent (mã cài hết hạn? - tạo lệnh mới trên web: Site → Cài agent)"\nrm -rf /home/bmc-gateway-agent\npython3 -m zipfile -e bmc-gateway-agent.zip /home\n[ -f /home/bmc-gateway-agent/install.sh ] || die "Gói agent không đúng"\n\nsay "Ghi /root/agent.json (site __SITE__, token mới)"\n( umask 077; cat > /root/agent.json <<\'JSON\'\n__AGENT_JSON__\nJSON\n)\nif curl -fs -o /dev/null --max-time 8 "$WEB/"; then VERIFY=true; else VERIFY=false; fi\npython3 - /root/agent.json "$VERIFY" <<\'PY\'\nimport json, sys\np, v = sys.argv[1], sys.argv[2] == "true"\nc = json.load(open(p)); c["verify_tls"] = v\njson.dump(c, open(p, "w"), indent=1)\nprint("    OK verify_tls =", v, "(web dùng chứng chỉ tự ký)" if not v else "")\nPY\n\nsay "Cài Traefik + agent"\nFORCE_AGENT_JSON=1 AGENT_JSON=/root/agent.json bash /home/bmc-gateway-agent/install.sh agent || {\n  echo\n  echo "Cài chưa xong. Sửa lỗi ở trên (vd thiếu chứng chỉ: CERT=/duong/dan.cer KEY=/duong/dan.key) rồi chạy lại:"\n  echo "    sudo FORCE_AGENT_JSON=1 bash /home/bmc-gateway-agent/install.sh agent"\n  exit 1\n}\necho\necho "Xong. Trên web, site __SITE__ chuyển chấm xanh trong ~10 giây."\necho "Tuỳ chọn - console Java trên web:  sudo bash /home/bmc-gateway-agent/install.sh kvm"\n'
SESSION_TTL = 12 * 3600          # phien thuong (cookie mat khi dong trinh duyet)
REMEMBER_TTL = 30 * 24 * 3600   # "Ghi nho dang nhap"
MAX_BACKUPS = 50
AUDIT_MAX_BYTES = 20 * 1024 * 1024   # audit.log qua 20 MB -> audit.log.1 ... giu 5 file
AUDIT_KEEP = 5
ACCOUNT_MAX_FAILS = 10               # sai 10 lan lien tiep (tu moi IP) -> khoa tai khoan 15 phut
ACCOUNT_LOCK_SECONDS = 900
LDAP_RECHECK_SECONDS = 3600          # tai khoan AD: hoi lai AD moi 1 gio (tat / ra khoi nhom -> dang xuat)

CONTROLLER_DEFAULTS = {
    "listen_host": "0.0.0.0",
    "listen_port": 9443,
    "tls_cert": "",
    "tls_key": "",
    "data_dir": "data",
    "backup_dir": "backups",
    "zabbix_token": "",
    "agent_offline_after": 45,
    # Link web bi mat, vd "/k7Qm2xP9aB": "/" va "/api/" tra 404, chi "/<chuoi>/" vao duoc giao dien.
    # Agent (/agent/v1/), lenh cai agent (/install/) va /api/zabbix van o goc.
    "web_path": "",
    # Luu du lieu vao MySQL (tuy chon). Trong = file JSON trong data_dir. Xem gw_db.py
    "db": {},
    # Web chay sau reverse proxy (nginx / Traefik) -> lay IP that cua nguoi dung tu header proxy ghi vao.
    # Chi tin header khi yeu cau den TU cac dia chi nay (IP hoac dai CIDR). [] = khong tin, luon dung IP ket noi.
    "trusted_proxies": ["127.0.0.1", "::1"],
    # "X-Forwarded-For" (lay IP ngoai cung ben phai khong thuoc proxy tin cay) hoac "X-Real-IP"
    "real_ip_header": "X-Forwarded-For",
}


def _ip_obj(v):
    v = str(v or "").strip()
    if v.startswith("[") and "]" in v:          # [2001:db8::1]:443
        v = v[1:v.index("]")]
    elif v.count(":") == 1:                      # 1.2.3.4:5678
        v = v.split(":", 1)[0]
    try:
        return ipaddress.ip_address(v)
    except ValueError:
        return None


def is_trusted_proxy(ip, trusted):
    a = _ip_obj(ip)
    if not a:
        return False
    for t in trusted or []:
        try:
            if a in ipaddress.ip_network(str(t), strict=False):
                return True
        except ValueError:
            continue
    return False


def real_client_ip(peer, headers, cfg):
    """IP that cua nguoi goi. Chi doc header khi ket noi den tu proxy tin cay (khong de nguoi dung gia mao)."""
    trusted = cfg.get("trusted_proxies") or []
    if not is_trusted_proxy(peer, trusted):
        return peer
    if str(cfg.get("real_ip_header", "")).lower() == "x-real-ip":
        a = _ip_obj(headers.get("X-Real-IP"))
        return str(a) if a else peer
    # X-Forwarded-For: client, proxy1, proxy2 -> moi proxy NOI THEM o cuoi. Phan ben trai do nguoi dung tu gui
    # duoc, nen di tu phai sang trai, bo qua proxy tin cay, lay dia chi dau tien con lai.
    chain = [x.strip() for x in ",".join(headers.get_all("X-Forwarded-For") or []).split(",") if x.strip()]
    for x in reversed(chain):
        a = _ip_obj(x)
        if not a:
            break
        if not is_trusted_proxy(str(a), trusted):
            return str(a)
    return peer

STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "application/javascript; charset=utf-8"),
    "/app.css": ("app.css", "text/css; charset=utf-8"),
}
# Che do dev (python3 bmcproxy.py dev): trinh duyet tu tai lai khi sua file web, server tu khoi dong lai khi sua .py
DEV = os.environ.get("BMCPROXY_DEV") == "1"
DEV_BOOT = str(time.time())
DEV_RELOAD_JS = b"""(function () {
  var last = null;
  function tick() {
    fetch("__dev/version", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
      if (last && v.boot !== last.boot) return location.reload();
      if (last && v.css !== last.css) {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
          l.href = l.href.replace(/[?].*$/, "") + "?v=" + v.css;
        });
      }
      if (last && v.page !== last.page) return location.reload();
      last = v;
    }).catch(function () {}).then(function () { setTimeout(tick, 700); });
  }
  tick();
})();
"""


_web_ver = {"key": None}


def web_version():
    """Ma noi dung app.js / app.css (doi khi cap nhat web) -> gan vao link tai file, trinh duyet khong dung ban cu."""
    names = ("app.js", "app.css")
    try:
        key = tuple(os.stat(os.path.join(WEB_DIR, n)).st_mtime_ns for n in names)
    except OSError:
        return {"app.js": "", "app.css": "", "v": ""}
    if _web_ver["key"] != key:
        import hashlib
        hs = {}
        for n in names:
            with open(os.path.join(WEB_DIR, n), "rb") as f:
                hs[n] = hashlib.sha256(f.read()).hexdigest()[:10]
        _web_ver.update(key=key, val={**hs, "v": hs["app.js"] + hs["app.css"]})
    return _web_ver["val"]


def dev_version():
    def mt(name):
        try:
            return str(os.stat(os.path.join(WEB_DIR, name)).st_mtime_ns)
        except OSError:
            return ""
    return {"boot": DEV_BOOT, "css": mt("app.css"), "page": mt("index.html") + "-" + mt("app.js")}


BMC_META = ("imported_from", "imported_auth", "imported_console_auth", "template", "updated_at", "updated_by",
            "tags", "expires")


def bmc_expired(b, today=None):
    exp = b.get("expires") or ""
    return bool(exp) and exp < (today or dt.date.today().isoformat())


def parse_tags(v):
    if isinstance(v, str):
        v = re.split(r"[,;]+", v)
    out = []
    for t in v or []:
        t = clean_text(str(t), 32).strip()
        if t and t.lower() not in (x.lower() for x in out):
            out.append(t)
    if len(out) > 12:
        raise ValidationError("Tối đa 12 nhãn cho mỗi BMC")
    return out


def load_controller_config(path):
    cfg = {**CONTROLLER_DEFAULTS, **read_json(path, {})}
    wp = str(cfg.get("web_path") or "").strip()
    if wp and not re.fullmatch(r"/[A-Za-z0-9_-]{6,64}/?", wp):
        sys.exit("config.json: web_path phải dạng /chuoi-ngau-nhien (6-64 ký tự chữ, số, - _)")
    cfg["web_path"] = wp.rstrip("/")
    base = os.path.dirname(os.path.abspath(path))
    for k in ("data_dir", "backup_dir"):
        if not os.path.isabs(cfg[k]):
            cfg[k] = os.path.join(base, cfg[k])
    os.makedirs(cfg["backup_dir"], exist_ok=True)
    os.makedirs(os.path.join(cfg["data_dir"], "releases"), exist_ok=True)
    return cfg


def bmc_key(b):
    return (b["site"], b["port"])


def _diff(old, new, a, b):
    return "".join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), a, b))


# =========================================================================== #
# Du lieu
# =========================================================================== #

# Yeu cau HTTP dang xu ly tren luong nay -> nhat ky tu ghi IP + trinh duyet cua nguoi thao tac
REQ = threading.local()


def short_agent(ua):
    """User-Agent -> 'Chrome · Windows' (gon de hien tren nhat ky)."""
    ua = ua or ""
    if not ua:
        return ""
    if ua.startswith("Python-urllib") or "bmcproxy" in ua.lower():
        return "agent"
    if ua.startswith("curl/"):
        return "curl"
    browser = next((n for k, n in (("Edg/", "Edge"), ("OPR/", "Opera"), ("Firefox/", "Firefox"), ("Chrome/", "Chrome"),
                                   ("Safari/", "Safari")) if k in ua), "")
    osn = next((n for k, n in (("Windows", "Windows"), ("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"),
                               ("Mac OS X", "macOS"), ("Linux", "Linux")) if k in ua), "")
    return " · ".join(x for x in (browser, osn) if x) or ua[:40]


def tail_lines(path, n, block=65536):
    """n dong cuoi cua file ma khong doc ca file (audit.log co the lon)."""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            pos, data = f.tell(), b""
            while pos > 0 and data.count(b"\n") <= n:
                step = min(block, pos)
                pos -= step
                f.seek(pos)
                data = f.read(step) + data
    except FileNotFoundError:
        return []
    return [ln.decode("utf-8", "replace") for ln in data.splitlines()[-n:] if ln.strip()]


def read_backup_dir(path):
    """Thu muc sao luu (meta.json + bmc/settings/sites.json) -> {"meta", "docs"} | None."""
    meta = read_json(os.path.join(path, "meta.json"), None)
    if meta is None:
        return None
    return {"meta": meta, "docs": {n: read_json(os.path.join(path, n), None) for n in
                                   ("bmc.json", "settings.json", "sites.json") if os.path.isfile(os.path.join(path, n))}}


_PKG_CACHE = {}


def agent_pkg_info():
    """Goi agent nam trong goi web -> {"path", "sha256", "build"} (cache theo mtime)."""
    import hashlib
    import zipfile
    try:
        pk = sorted(f for f in os.listdir(AGENT_PKG_DIR) if f.startswith("bmc-gateway-agent") and f.endswith(".zip"))
    except OSError:
        return None
    if not pk:
        return None
    path = os.path.join(AGENT_PKG_DIR, pk[-1])
    mt = os.path.getmtime(path)
    hit = _PKG_CACHE.get(path)
    if hit and hit[0] == mt:
        return hit[1]
    with open(path, "rb") as f:
        data = f.read()
    build = ""
    try:
        with zipfile.ZipFile(path) as z:
            build = z.read("bmc-gateway-agent/BUILD").decode("utf-8", "replace").strip()
    except (KeyError, zipfile.BadZipFile, OSError):
        pass
    info = {"path": path, "sha256": hashlib.sha256(data).hexdigest(), "build": build or "?", "size": len(data)}
    _PKG_CACHE[path] = (mt, info)
    return info


DENY_REASONS = ("no-login", "session", "target", "disabled", "blocked")


def ip_in(ip, cidr):
    try:
        return ipaddress.ip_address(ip) in ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return False


class Store:
    FILES = ("bmc.json", "settings.json", "sites.json", "users.json", "state.json", "templates.json", "auth.json",
             "notify.json", "guests.json", "maint.json", "iprules.json")

    def __init__(self, cfg):
        self.cfg = cfg
        self.dir = cfg["data_dir"]
        self.lock = threading.RLock()
        self.mtimes = {}
        self.db = None
        self.db_versions = None
        self.db_error = ""
        if (cfg.get("db") or {}).get("type"):
            from gw_db import DocDB
            self.db = DocDB(cfg["db"])
            self.db.init_schema()
            self._import_json_to_db()
        self.refresh()
        self.migrate()

    # ------------------------------------------------------------ MySQL
    def _import_json_to_db(self):
        """Lan dau bat MySQL: chuyen file JSON + audit.log hien co len DB (chi khi DB con trong)."""
        self._import_blobs_to_db()
        if self.db.versions():
            return
        n = 0
        for name in self.FILES:
            if os.path.isfile(self._p(name)):
                self.db.save(name, read_json(self._p(name), {}))
                n += 1
        a = 0
        try:
            with open(self._p("audit.log"), encoding="utf-8") as f:
                for ln in f.readlines()[-20000:]:
                    try:
                        self.db.audit_add(json.loads(ln))
                        a += 1
                    except (ValueError, KeyError):
                        pass
        except FileNotFoundError:
            pass
        if n or a:
            print(f"đã chuyển {n} file dữ liệu + {a} dòng nhật ký từ JSON sang {self.db.describe()}", flush=True)

    def _import_blobs_to_db(self):
        """Ban cau hinh da phat hanh, ban sao luu, phien dang nhap tu file -> bang blob (1 lan)."""
        if self.db.blob_counts():
            return
        n = {"release": 0, "backup": 0, "session": 0}
        rdir = self._p("releases")
        for site in sorted(os.listdir(rdir)) if os.path.isdir(rdir) else []:
            for f in sorted(os.listdir(os.path.join(rdir, site))):
                rel = read_json(os.path.join(rdir, site, f), None) if f.endswith(".json") else None
                if rel is not None:
                    self.db.blob_put("release", f"{site}/{f[:-5]}", rel)
                    n["release"] += 1
        bdir = self.cfg["backup_dir"]
        for d in sorted(os.listdir(bdir)) if os.path.isdir(bdir) else []:
            snap = read_backup_dir(os.path.join(bdir, d))
            if snap:
                self.db.blob_put("backup", d, snap)
                n["backup"] += 1
        sess = read_json(self._p("sessions.json"), {})
        if sess:
            self.db.blob_put("session", "all", sess)
            n["session"] = len(sess)
        if any(n.values()):
            print(f"đã chuyển lên {self.db.describe()}: {n['release']} bản cấu hình, {n['backup']} bản sao lưu, "
                  f"{n['session']} phiên đăng nhập", flush=True)

    # ------------------------------------------------------------ blob: DB (neu bat) + file ban sao
    def blob_put(self, kind, name, obj, path=None, mode=0o644):
        if path:
            write_json(path, obj, mode)
        if self.db:
            try:
                self.db.blob_put(kind, name, obj)
                self.db_error = ""
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"

    def blob_get(self, kind, name, path=None, default=None):
        if self.db:
            try:
                v = self.db.blob_get(kind, name)
                if v is not None:
                    return v
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"
        return read_json(path, default) if path else default

    def storage_info(self):
        out = {"kind": "json", "describe": f"file JSON ({self.dir})", "error": self.db_error}
        if self.db:
            out["kind"], out["describe"] = self.db.kind, self.db.describe()
            try:
                out["docs"] = len(self.db.versions())
                out["audit"] = self.db.audit_count()
                out["blobs"] = self.db.blob_counts()
                out["tls"] = bool((self.cfg.get("db") or {}).get("ssl"))
            except Exception as e:
                out["error"] = f"{type(e).__name__}: {e}"
        return out

    def _apply_docs(self, docs):
        self.bmcs = docs.get("bmc.json", {"bmcs": []}).get("bmcs", [])
        raw_settings = docs.get("settings.json", {})
        self.settings = {**SETTINGS_DEFAULTS,
                         **{k: v for k, v in raw_settings.items() if k in SETTINGS_DEFAULTS}}
        self._legacy_sites = raw_settings.get("sites")
        self.sites = docs.get("sites.json", {})
        self.users = docs.get("users.json", {})
        self.state = docs.get("state.json", {})
        self.templates = docs.get("templates.json", {})
        self.auth = docs.get("auth.json", {})  # dang nhap AD / LDAP (rieng, khong anh huong ban cau hinh site)
        self.notify = docs.get("notify.json", {})  # canh bao Telegram / email
        self.guests = docs.get("guests.json", {})  # link tam cho khach: id -> {...}
        self.maint = docs.get("maint.json", {})    # lich bao tri: id -> {site, port (0 = ca site), start, end, note}
        self.iprules = docs.get("iprules.json", {})  # chan / cho phep IP: id -> {site, port (0 = ca site), cidr, action, exp, note}

    def _p(self, *name):
        return os.path.join(self.dir, *name)

    def _mtime(self, name):
        try:
            return os.stat(self._p(name)).st_mtime_ns
        except OSError:
            return None

    def refresh(self):
        if self.db:
            return self._refresh_db()
        with self.lock:
            cur = {n: self._mtime(n) for n in self.FILES}
            if cur == self.mtimes:
                return
            self.bmcs = read_json(self._p("bmc.json"), {"bmcs": []}).get("bmcs", [])
            raw_settings = read_json(self._p("settings.json"), {})
            self.settings = {**SETTINGS_DEFAULTS,
                             **{k: v for k, v in raw_settings.items() if k in SETTINGS_DEFAULTS}}
            self._legacy_sites = raw_settings.get("sites")
            self.sites = read_json(self._p("sites.json"), {})
            self.users = read_json(self._p("users.json"), {})
            self.state = read_json(self._p("state.json"), {})
            self.templates = read_json(self._p("templates.json"), {})
            self.auth = read_json(self._p("auth.json"), {})
            self.notify = read_json(self._p("notify.json"), {})
            self.guests = read_json(self._p("guests.json"), {})
            self.maint = read_json(self._p("maint.json"), {})
            self.iprules = read_json(self._p("iprules.json"), {})
            self.mtimes = cur

    def _refresh_db(self):
        with self.lock:
            try:
                vers = self.db.versions()
                if vers == self.db_versions:
                    self.db_error = ""
                    return
                rows = self.db.load_all()
                self._apply_docs({k: v[0] for k, v in rows.items()})
                self.db_versions = {k: v[1] for k, v in rows.items()}
                self.db_error = ""
                for name, (obj, _) in rows.items():  # ban sao JSON cho Sao luu / du phong
                    if name in self.FILES:
                        write_json(self._p(name), obj, 0o600 if name in ("users.json", "sites.json", "auth.json", "notify.json", "guests.json") else 0o644)
            except Exception as e:  # mat MySQL: dung du lieu dang co trong bo nho
                self.db_error = f"{type(e).__name__}: {e}"
                if not hasattr(self, "bmcs"):
                    raise

    def migrate(self):
        """Chuyen du lieu ban 1 site (settings.sites, user khong co role) sang ban nhieu site."""
        with self.lock:
            changed = False
            if isinstance(self._legacy_sites, dict) and not self.sites:
                for k, domain in self._legacy_sites.items():
                    self.sites[k] = new_site_record(k, k.upper(), domain)
                self.save("sites.json")
                self.save("settings.json")
                changed = True
            for u in self.users.values():
                if "role" not in u:
                    u["role"], u["sites"] = "admin", []
                    changed = True
            if changed:
                self.save("users.json")

    def save(self, name):
        data = {"bmc.json": lambda: {"bmcs": sorted(self.bmcs, key=bmc_key)},
                "settings.json": lambda: self.settings,
                "sites.json": lambda: self.sites,
                "users.json": lambda: self.users,
                "state.json": lambda: self.state,
                "templates.json": lambda: self.templates,
                "auth.json": lambda: self.auth,
                "notify.json": lambda: self.notify,
                "guests.json": lambda: self.guests,
                "maint.json": lambda: self.maint,
                "iprules.json": lambda: self.iprules}[name]()
        write_json(self._p(name), data, 0o600 if name in ("users.json", "sites.json", "auth.json", "notify.json", "guests.json") else 0o644)
        self.mtimes[name] = self._mtime(name)
        if self.db:
            try:
                ver = self.db.save(name, data)
                if self.db_versions is not None:
                    self.db_versions[name] = ver
                self.db_error = ""
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"
                raise ValidationError(f"Không ghi được MySQL ({self.db_error}). Dữ liệu đã lưu tạm vào file JSON.")

    def audit(self, user, action, detail="", site="", ip=None):
        rec = {"ts": now_iso(), "user": user, "action": action, "site": site, "detail": detail,
               "ip": getattr(REQ, "ip", "") if ip is None else ip, "ua": getattr(REQ, "ua", "")}
        self.append_log("audit.log", [rec])
        if self.db:
            try:
                self.db.audit_add(rec)
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"

    def append_log(self, name, recs):
        """Ghi them dong JSON vao data/<name>; qua AUDIT_MAX_BYTES thi xoay vong <name>.1 ... .AUDIT_KEEP."""
        with self.lock:
            path = self._p(name)
            with open(path, "a", encoding="utf-8") as f:
                for rec in recs:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                big = f.tell() > AUDIT_MAX_BYTES
            if big:
                try:
                    for i in range(AUDIT_KEEP - 1, 0, -1):
                        if os.path.exists(f"{path}.{i}"):
                            os.replace(f"{path}.{i}", f"{path}.{i + 1}")
                    os.replace(path, f"{path}.1")
                except OSError as e:  # Windows: file dang mo o luong khac -> lan ghi sau thu lai
                    sys.stderr.write(f"không xoay vòng được {name}: {e}\n")

    def read_log(self, name, limit, keep=None):
        lines = tail_lines(self._p(name), limit * (4 if keep else 1))
        if len(lines) < limit:  # vua xoay vong: lay them o file cu
            lines = tail_lines(self._p(name + ".1"), limit - len(lines)) + lines
        out = []
        for ln in reversed(lines):
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            if keep is None or keep(r):
                out.append(r)
                if len(out) >= limit:
                    break
        return out

    # ------------------------------------------------------------ lan bi chan (agent gom theo IP + cong + ly do)
    def denied_add(self, site, items):
        rows = []
        for x in (items or [])[:3000]:
            if not isinstance(x, dict):
                continue
            try:
                port, count = int(x.get("port")), max(1, int(x.get("count") or 1))
            except (TypeError, ValueError):
                continue
            reason = str(x.get("reason", ""))
            rows.append({"ts": str(x.get("last", ""))[:32] or now_iso(), "first": str(x.get("first", ""))[:32],
                         "site": site, "port": port, "ip": str(x.get("ip", ""))[:64], "count": count,
                         "reason": reason if reason in DENY_REASONS else "other", "path": str(x.get("path", ""))[:160]})
        if rows:
            self.append_log("denied.log", rows)

    def read_denied(self, limit=20000, site="", days=7):
        since = (dt.datetime.now() - dt.timedelta(days=days)).isoformat()
        return self.read_log("denied.log", limit, lambda r: r.get("ts", "") >= since and (not site or r.get("site") == site))

    # ------------------------------------------------------------ lan mo BMC / console (agent gui ve)
    def access_add(self, site, items):
        rows = []
        for x in (items or [])[:3000]:
            if not isinstance(x, dict):
                continue
            try:
                port = int(x.get("port"))
            except (TypeError, ValueError):
                continue
            kind = str(x.get("kind", "web"))
            rows.append({"ts": str(x.get("ts", ""))[:32] or now_iso(), "site": site, "port": port,
                         "ip": str(x.get("ip", ""))[:64], "user": str(x.get("user", ""))[:80],
                         "kind": kind if kind in ("web", "console", "guest-open") else "web",
                         "path": str(x.get("path", ""))[:160]})
        if not rows:
            return
        self.append_log("access.log", rows)
        if self.db:
            try:
                self.db.access_add(rows)
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"

    def read_access(self, limit=1000, site="", port=0):
        if self.db:
            try:
                return self.db.access_read(limit, site, port)
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"
        return self.read_log("access.log", limit,
                             (lambda r: (not site or r.get("site") == site) and (not port or r.get("port") == port))
                             if site or port else None)

    def read_audit(self, limit=500):
        if self.db:
            try:
                return self.db.audit_read(limit)
            except Exception as e:
                self.db_error = f"{type(e).__name__}: {e}"
        return self.read_log("audit.log", limit)

    # ------------------------------------------------------------ site
    def site_settings(self, site):
        return {**self.settings, **self.sites[site].get("overrides", {})}

    def site_bmcs(self, site):
        today = dt.date.today().isoformat()
        out = []
        for b in self.bmcs:
            if b["site"] != site:
                continue
            r = {k: b[k] for k in BMC_DEFAULTS if k in b}
            if r.get("tcp_ports") and not all(isinstance(t, dict) for t in r["tcp_ports"]):
                try:  # du lieu cu / sua tay ([5900], ["6080:6080"]) -> dang chuan cho agent
                    r["tcp_ports"] = parse_tcp_ports(r["tcp_ports"])
                except ValidationError:
                    r["tcp_ports"] = []
            if bmc_expired(b, today):  # het han su dung -> tat o lan Ap dung sau
                r["enabled"] = False
            out.append(r)
        return sorted(out, key=lambda b: b["port"])

    def desired(self, site):
        s = self.sites[site]
        settings = self.site_settings(site)
        bmcs = self.site_bmcs(site)
        dash = {**DASHBOARD_DEFAULTS, **(s.get("dashboard") or {})}
        rel = {"site": site, "domain": s["domain"], "settings": settings, "bmcs": bmcs,
               "rev": release_rev(s["domain"], settings, bmcs, dash)}
        if dash["enabled"]:
            rel["dashboard"] = dash
        return rel

    def load_release(self, site, rev):
        if not rev or not re.match(r"^[0-9a-f]{12}$", rev):
            return None
        return self.blob_get("release", f"{site}/{rev}", self._p("releases", site, f"{rev}.json"))

    def get_bmc(self, site, port):
        for b in self.bmcs:
            if b["site"] == site and b["port"] == port:
                return b
        return None


def new_site_record(key, label, domain):
    return {"label": label, "domain": domain, "allowed_ips": [], "token_hash": "",
            "token_hint": "", "overrides": {}, "created_at": now_iso()}


# =========================================================================== #
# Ung dung
# =========================================================================== #

class App:
    def __init__(self, store):
        self.store = store
        self.notifier = gw_notify.Notifier(lambda: self.store.notify, self.notify_snapshot, self._notify_result)
        self.hb = {}            # site -> heartbeat moi nhat (bo nho)
        self.commands = {}      # site -> [lenh cho agent]
        self.extra = {}         # site -> {"logs"|"diag"|"action": ket qua agent gui ve}
        self.install_codes = {}  # hash(ma cai) -> {site, exp, by, used_at, ip}
        # hash(ma phien) -> (user, het han, ip, luc tao, ghi nho). Luu ra data/sessions.json (chi ban bam)
        self.sessions = self._load_sessions()
        self.fails = {}         # ip -> (so lan sai, het han)
        self.acct_fails = {}    # tai khoan -> (so lan sai, het han)
        self.ldap_checked = {}  # tai khoan AD -> luc kiem tra lai gan nhat
        self.slock = threading.Lock()
        self.started = now_iso()

    # ------------------------------------------------------------ phien
    def _sessions_path(self):
        return self.store._p("sessions.json")

    def _load_sessions(self):
        now = time.time()
        raw = self.store.blob_get("session", "all", os.path.join(self.store.dir, "sessions.json"), {})
        return {h: tuple(v) for h, v in raw.items() if isinstance(v, list) and len(v) >= 5 and v[1] > now}

    def _save_sessions(self):
        """Goi khi da giu slock. Web khoi dong lai van con phien (nhat la phien Ghi nho)."""
        now = time.time()
        for h in [h for h, s in self.sessions.items() if s[1] < now]:
            del self.sessions[h]
        try:
            self.store.blob_put("session", "all", {h: list(s) for h, s in self.sessions.items()},
                                self._sessions_path(), 0o600)
        except OSError as e:
            sys.stderr.write(f"không lưu được sessions.json: {e}\n")

    def new_session(self, user, ip="", remember=False):
        token = secrets.token_urlsafe(32)
        with self.slock:
            self.sessions[hash_token(token)] = (user, time.time() + (REMEMBER_TTL if remember else SESSION_TTL),
                                                ip, now_iso(), bool(remember))
            self._save_sessions()
        return token

    def user_sessions(self, name):
        now = time.time()
        with self.slock:
            return [{"ip": s[2], "since": s[3], "remember": bool(s[4])} for s in self.sessions.values()
                    if s[0] == name and s[1] > now]

    @staticmethod
    def blocked_reason(rec):
        """Tai khoan bi khoa / het han -> ly do (chuoi), con dung duoc -> ""."""
        if rec.get("disabled"):
            return "Tài khoản đã bị khoá. Liên hệ quản trị viên."
        exp = rec.get("expires") or ""
        if exp and exp < dt.date.today().isoformat():
            return f"Tài khoản đã hết hạn ({exp}). Liên hệ quản trị viên."
        return ""

    def session_user(self, token):
        if not token:
            return None
        h = hash_token(token)
        with self.slock:
            s = self.sessions.get(h)
            if not s:
                return None
            if s[1] < time.time():
                del self.sessions[h]
                self._save_sessions()
                return None
        rec = self.store.users.get(s[0])
        if not rec or self.blocked_reason(rec):
            return None
        if rec.get("source") == "ldap":
            self._ldap_recheck(s[0])
        return s[0]

    def _ldap_recheck(self, name):
        """Moi LDAP_RECHECK_SECONDS hoi lai AD (chay nen, can tai khoan dich vu). Bi tat / xoa / ra khoi
        nhom -> dang xuat moi phien. AD khong tra loi -> giu phien (lan sau thu lai)."""
        lc = self.store.auth.get("ldap") or {}
        now = time.time()
        with self.slock:
            if not (lc.get("enabled") and lc.get("bind_dn") and gw_ldap.available()):
                return
            if now - self.ldap_checked.get(name, 0) < LDAP_RECHECK_SECONDS:
                return
            self.ldap_checked[name] = now

        def run():
            st = self.store
            try:
                info = gw_ldap.lookup(lc, name)
                if info is None:
                    why = "không còn / đã bị tắt trên AD"
                else:
                    with st.lock:
                        rec = st.users.get(name)
                        if not rec:
                            return
                        try:
                            role, sites = gw_ldap.decide(lc, info, rec)
                        except gw_ldap.LdapError:
                            role = None
                        if role is not None:
                            sites = [x for x in sites if x in st.sites]
                            if (rec.get("role"), rec.get("sites") or []) != (role, sites):
                                rec.update(role=role, sites=sites, ldap_groups=info["groups"][:60])
                                st.save("users.json")
                                st.audit("AD", "user-edit", f"{name}: nhóm AD đổi → {role}")
                            return
                    why = "không còn thuộc nhóm AD nào được phép"
                self.drop_user_sessions(name)
                st.audit("AD", "user-logout", f"{name}: {why} - đăng xuất mọi phiên")
            except gw_ldap.LdapError as e:
                sys.stderr.write(f"AD: kiểm tra lại {name} lỗi: {e}\n")
            except Exception:  # khong de luong nen lam sap web
                traceback.print_exc()

        threading.Thread(target=run, daemon=True, name=f"ldap-recheck-{name}").start()

    def drop_session(self, token):
        with self.slock:
            if token and self.sessions.pop(hash_token(token), None):
                self._save_sessions()

    def drop_user_sessions(self, name, keep_token=None):
        """Xoa moi phien cua tai khoan (tru phien keep_token - phien dang dung de doi mat khau)."""
        keep = hash_token(keep_token) if keep_token else None
        with self.slock:
            for t in [t for t, s in self.sessions.items() if s[0] == name and t != keep]:
                del self.sessions[t]
            self._save_sessions()

    def login_allowed(self, ip):
        with self.slock:
            n, until = self.fails.get(ip, (0, 0))
            return not (n >= 5 and until > time.time())

    def login_failed(self, ip, name=""):
        """-> True neu lan sai nay lam khoa tai khoan."""
        now = time.time()
        with self.slock:
            if len(self.fails) > 5000 or len(self.acct_fails) > 5000:  # don ban ghi het han
                for d in (self.fails, self.acct_fails):
                    for k in [k for k, v in d.items() if v[1] < now]:
                        del d[k]
            n, _ = self.fails.get(ip, (0, 0))
            self.fails[ip] = (n + 1, now + 300)
            if not name:
                return False
            n, until = self.acct_fails.get(name, (0, 0))
            n = n + 1 if until > now else 1
            self.acct_fails[name] = (n, now + ACCOUNT_LOCK_SECONDS)
            return n == ACCOUNT_MAX_FAILS

    def account_locked(self, name):
        with self.slock:
            n, until = self.acct_fails.get(name, (0, 0))
            return n >= ACCOUNT_MAX_FAILS and until > time.time()

    def login_ok(self, ip, name=""):
        with self.slock:
            self.fails.pop(ip, None)
            self.acct_fails.pop(name, None)

    # ------------------------------------------------------------ quyen
    def user(self, name):
        u = self.store.users[name]
        return {"name": name, "role": u.get("role", "viewer"), "sites": u.get("sites") or [], "perms": user_perms(u),
                "full_name": u.get("full_name", ""), "must_change": bool(u.get("must_change")),
                "totp": bool(u.get("totp_secret")), "source": u.get("source", "local"),
                "bmc_tags": u.get("bmc_tags") or [], "bmc_list": u.get("bmc_list") or []}

    @staticmethod
    def can_view(u, site):
        if u["role"] == "customer":
            return False
        return u["role"] == "admin" or not u["sites"] or site in u["sites"]

    def can(self, u, perm, site=None):
        """Quyen chi tiet (PERMS); site=None: co quyen nay o it nhat 1 site trong pham vi."""
        if u["role"] == "admin":
            return True
        if u["role"] == "customer" or perm not in u.get("perms", ()):
            return False
        return site is None or self.can_view(u, site)

    def need(self, u, perm, site=None):
        if not self.can(u, perm, site):
            raise PermissionError(f"Bạn không có quyền {PERMS[perm]}" + (f" ở site {site}" if site else ""))

    @staticmethod
    def need_admin(u):
        if u["role"] != "admin":
            raise PermissionError("Chỉ quản trị viên được làm việc này")

    def visible_sites(self, u):
        return [k for k in sorted(self.store.sites) if self.can_view(u, k)]

    # ------------------------------------------------------------ thong ke Tong quan
    def stats(self, u, days=7):
        st = self.store
        today = dt.date.today()
        dates = [(today - dt.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
        by_day = {d: {"date": d, "web": 0, "console": 0, "guest": 0} for d in dates}
        bmc_n, user_n = {}, {}
        for r in st.read_access(8000):
            d = str(r.get("ts", ""))[:10]
            if d < dates[0]:
                continue
            if d not in by_day or not self.can_view(u, r.get("site", "")):
                continue
            guest = r.get("kind") == "guest-open" or str(r.get("user", "")).startswith("khách")
            if r.get("kind") == "guest-open":
                continue  # lan mo link: da dem o lan vao trang ngay sau
            by_day[d]["guest" if guest else "console" if r.get("kind") == "console" else "web"] += 1
            k = (r.get("site"), r.get("port"))
            b = bmc_n.setdefault(k, {"site": k[0], "port": k[1], "count": 0, "last": ""})
            b["count"] += 1
            b["last"] = max(b["last"], str(r.get("ts", "")))
            if not guest:
                who = str(r.get("user", "")) or "(không rõ)"
                x = user_n.setdefault(who, {"user": who, "count": 0, "last": "", "ips": set()})
                x["count"] += 1
                x["last"] = max(x["last"], str(r.get("ts", "")))
                x["ips"].add(r.get("ip", ""))
        notes = {(b["site"], b["port"]): b.get("note", "") for b in st.bmcs}
        top_bmcs = sorted(bmc_n.values(), key=lambda x: (-x["count"], x["port"]))[:6]
        for b in top_bmcs:
            b["note"] = notes.get((b["site"], b["port"]), "")
        top_users = [{**x, "ips": len(x["ips"])} for x in sorted(user_n.values(), key=lambda x: -x["count"])[:6]]
        now = time.time()
        guests = [self.guest_view(i, g) for i, g in st.guests.items()
                  if self.can_view(u, g["site"]) and not g.get("revoked") and g["exp"] > now]
        maint = [self.maint_view(i, m) for i, m in st.maint.items() if self.can_view(u, m["site"])]
        maint = sorted((m for m in maint if m["status"] != "done"), key=lambda m: (m["status"] != "active", m["start"]))[:5]
        days_list = [by_day[d] for d in dates]
        return {"days": days_list, "total": sum(x["web"] + x["console"] + x["guest"] for x in days_list),
                "users": len(user_n), "top_bmcs": top_bmcs, "top_users": top_users,
                "guests": sorted(guests, key=lambda g: g["expires"])[:5], "guests_active": len(guests), "maint": maint}

    # ------------------------------------------------------------ cong khach hang
    def customer_bmcs(self, u):
        """BMC thuoc tai khoan khach hang: theo nhan (KH-...) hoac danh sach site:cong."""
        tags = {t.lower() for t in u.get("bmc_tags") or []}
        keys = set(u.get("bmc_list") or [])
        out = []
        for b in self.store.bmcs:
            if not b.get("enabled", True) or bmc_expired(b):
                continue
            if f"{b['site']}:{b['port']}" in keys or tags & {t.lower() for t in b.get("tags") or []}:
                out.append(b)
        return sorted(out, key=bmc_key)

    # ------------------------------------------------------------ lich bao tri
    @staticmethod
    def _now_local():
        return dt.datetime.now().strftime("%Y-%m-%dT%H:%M")

    def maint_active(self, site, port=0, now=None):
        """Lich bao tri dang dien ra cho site (port=0) hoac 1 BMC (ke ca lich ca site) -> ban ghi | None."""
        now = now or self._now_local()
        best = None
        for mid, m in self.store.maint.items():
            if m["site"] != site or not (m["start"] <= now < m["end"]):
                continue
            if m.get("port") and (not port or m["port"] != port):
                continue
            if not best or m["end"] > best["end"]:
                best = {**m, "id": mid}
        return best

    def maint_view(self, mid, m, now=None):
        now = now or self._now_local()
        status = "active" if m["start"] <= now < m["end"] else "upcoming" if now < m["start"] else "done"
        return {"id": mid, **m, "status": status, "site_label": self.store.sites.get(m["site"], {}).get("label", m["site"])}

    def site_maint(self, site):
        """Bao tri dang dien ra -> gui xuong agent (trang loi IPMI hien bien bao tri)."""
        now = self._now_local()
        out = []
        for m in self.store.maint.values():
            if m["site"] == site and m["start"] <= now < m["end"]:
                try:
                    end_ts = dt.datetime.strptime(m["end"], "%Y-%m-%dT%H:%M").timestamp()
                except ValueError:
                    continue
                out.append({"port": m.get("port") or 0, "end": m["end"].replace("T", " "), "end_ts": end_ts,
                            "note": m.get("note", "")})
        return out

    # ------------------------------------------------------------ link tam cho khach
    def site_ip_rules(self, site):
        """Quy tac chan / cho phep IP con han cua site -> gui xuong agent."""
        now = time.time()
        return [{"cidr": r["cidr"], "action": r["action"], "port": r.get("port", 0), "exp": r.get("exp", 0),
                 "note": r.get("note", "")} for r in self.store.iprules.values()
                if r["site"] == site and (not r.get("exp") or r["exp"] > now)]

    @staticmethod
    def iprule_view(rid, r):
        exp = r.get("exp") or 0
        return {"id": rid, **{k: r.get(k) for k in ("site", "port", "cidr", "action", "note", "created_by", "created_at")},
                "exp": exp, "expires": dt.datetime.fromtimestamp(exp).isoformat(timespec="minutes") if exp else "",
                "status": "expired" if exp and exp <= time.time() else "active"}

    def site_guests(self, site):
        """Link khach con han cua site -> gui xuong agent (chi ban bam cua ma)."""
        now = time.time()
        return [{"hash": g["hash"], "port": g["port"], "exp": g["exp"], "label": g.get("label", ""), "id": gid}
                for gid, g in self.store.guests.items()
                if g["site"] == site and not g.get("revoked") and g["exp"] > now]

    @staticmethod
    def guest_view(gid, g):
        now = time.time()
        status = "revoked" if g.get("revoked") else "expired" if g["exp"] <= now else "active"
        return {"id": gid, "site": g["site"], "port": g["port"], "label": g.get("label", ""),
                "expires": dt.datetime.fromtimestamp(g["exp"]).isoformat(timespec="seconds"),
                "left_minutes": max(0, int((g["exp"] - now) // 60)), "status": status,
                "created_at": g.get("created_at"), "created_by": g.get("created_by"),
                "revoked_by": g.get("revoked_by", "")}

    # ------------------------------------------------------------ canh bao
    def notify_snapshot(self):
        st = self.store
        today = dt.date.today()
        soon = (today + dt.timedelta(days=7)).isoformat()
        sites, expiring = [], []
        with st.lock:
            for k in sorted(st.sites):
                s = st.sites[k]
                h = self.hb.get(k) or {}
                online = self.online(k)
                health = h.get("health") or {}
                bmcs = []
                for b in st.bmcs:
                    if b["site"] != k or not b.get("enabled", True):
                        continue
                    web = (health.get(str(b["port"])) or {}).get("web") or {}
                    bmcs.append({"port": b["port"], "note": b.get("note", ""), "upstream": b.get("upstream", ""),
                                 "down": online and web.get("up") is False, "error": web.get("error", ""),
                                 "maint": bool(self.maint_active(k, b["port"]))})
                    exp = b.get("expires") or ""
                    if exp and today.isoformat() <= exp <= soon:
                        expiring.append({"site": k, "port": b["port"], "expires": exp, "note": b.get("note", "")})
                sites.append({"key": k, "label": s["label"], "token_set": bool(s.get("token_hash")),
                              "maint": bool(self.maint_active(k)),
                              "seen": bool(h) or bool((st.state.get(k) or {}).get("applied")),
                              "online": online, "hostname": h.get("hostname"), "bmcs": bmcs})
        return {"sites": sites, "expiring": sorted(expiring, key=lambda x: x["expires"])}

    def _notify_result(self, kind, title, res):
        bad = {k: v for k, v in res.items() if v != "ok"}
        if bad:
            self.store.audit("hệ thống", "notify-failed", f"{title} → " + "; ".join(f"{k}: {v}" for k, v in bad.items()), ip="")

    # ------------------------------------------------------------ trang thai site
    def online(self, site):
        h = self.hb.get(site)
        return bool(h) and time.time() - h["_received"] < self.store.cfg["agent_offline_after"]

    def site_status(self, site):
        st = self.store
        s = st.sites[site]
        state = st.state.get(site, {})
        h = self.hb.get(site) or {}
        desired = st.desired(site)
        target = state.get("target") or {}
        applied_rev = h.get("applied_rev") or (state.get("applied") or {}).get("rev")
        report = state.get("last_report") or {}
        reported = (report.get("rev"), report.get("attempt")) == (target.get("rev"), target.get("attempt"))
        if not target or desired["rev"] != target.get("rev"):
            phase = "pending" if (target or desired["bmcs"]) else "empty"
        elif reported:
            phase = "synced" if report.get("ok") else "failed"
            if report.get("ok"):
                applied_rev = target["rev"]
        elif applied_rev == target.get("rev") and not report:
            phase = "synced"
        else:
            phase = "applying"
        if phase == "synced" and h.get("legacy_active"):
            phase = "pending"
        tr = h.get("traefik") or {}
        routers = tr.get("routers") or []
        return {
            "key": site, "label": s["label"], "domain": s["domain"],
            "allowed_ips": s.get("allowed_ips", []), "overrides": s.get("overrides", {}),
            "token_set": bool(s.get("token_hash")), "token_hint": s.get("token_hint", ""),
            "online": self.online(site), "last_seen": h.get("time"),
            "hostname": h.get("hostname"), "agent_version": h.get("version"),
            "remote_ip": h.get("_ip"),
            "bmcs": len(desired["bmcs"]),
            "enabled": sum(1 for b in desired["bmcs"] if b.get("enabled", True)),
            "down": sum(1 for v in (h.get("health") or {}).values()
                        if (v.get("web") or {}).get("up") is False),
            "phase": phase, "desired_rev": desired["rev"], "target": target,
            "applied_rev": applied_rev, "last_report": report,
            "traefik": {"reachable": tr.get("reachable", False), "version": tr.get("version"),
                        "entrypoints": tr.get("entrypoints"), "routers": len(routers),
                        "errors": sum(1 for r in routers if r.get("status") != "enabled" or r.get("error"))},
            "warnings": h.get("warnings") or [],
            "legacy_active": len(h.get("legacy_active") or []),
            "created_at": s.get("created_at"),
            "dashboard": self.dashboard_view(site),
            "sysinfo": h.get("sysinfo") or {},
            "extra_at": {k: (v or {}).get("at") for k, v in (self.extra.get(site) or {}).items()},
            "agent_build": h.get("build") or "",
            "skipped": report.get("skipped") or [] if reported or report.get("ok") else [],
            "agent_pkg_build": (agent_pkg_info() or {}).get("build", ""),
            "history_count": len((state.get("history") or [])),
        }

    def bmc_views(self, u):
        out = []
        for b in self.store.bmcs:
            if not self.can_view(u, b["site"]):
                continue
            h = self.hb.get(b["site"]) or {}
            routers = {r["name"]: r for r in (h.get("traefik") or {}).get("routers") or []}
            v = {**BMC_DEFAULTS, **b}
            v["health"] = (h.get("health") or {}).get(str(b["port"]))
            v["auth_stats"] = (h.get("auth_stats") or {}).get(str(b["port"]))
            names = [f"bmc-{b['port']}"] + ([f"bmc-{b['port']}-console"] if b.get("console_port") else [])
            v["traefik"] = {n: routers[n] for n in names if n in routers}
            v["site_online"] = self.online(b["site"])
            v["traefik_reachable"] = bool((h.get("traefik") or {}).get("reachable"))
            out.append(v)
        return sorted(out, key=bmc_key)

    def dashboard_view(self, site):
        s = self.store.sites[site]
        d = {**DASHBOARD_DEFAULTS, **(s.get("dashboard") or {})}
        return {"enabled": d["enabled"], "port": d["port"], "allow_ips": d["allow_ips"],
                "users": sorted(d["users"]),
                "url": f"https://{s['domain']}:{d['port']}/dashboard/" if s.get("domain") else ""}

    def update_dashboard(self, site, data):
        """data: {enabled, port, allow_ips, user, password}. Mat khau de trong = giu nguyen."""
        cur = {**DASHBOARD_DEFAULTS, **(self.store.sites[site].get("dashboard") or {})}
        users = dict(cur["users"])
        user = str(data.get("user") or "").strip()
        pw = str(data.get("password") or "")
        if user:
            if pw:
                if len(pw) < 10:
                    raise ValidationError("Mật khẩu dashboard tối thiểu 10 ký tự")
                users = {user: apr1_hash(pw)}
            elif user in users:
                users = {user: users[user]}
            elif data.get("enabled"):
                raise ValidationError("Nhập mật khẩu cho tài khoản dashboard mới")
        d = validate_dashboard({"enabled": data.get("enabled", cur["enabled"]),
                                "port": data.get("port", cur["port"]),
                                "allow_ips": data.get("allow_ips", cur["allow_ips"]),
                                "users": users})
        if d["enabled"]:
            for b in self.store.bmcs:
                if b["site"] == site and d["port"] in (b["port"], b.get("console_port")):
                    raise ValidationError(f"Cổng {d['port']} đang dùng cho BMC {b['port']}")
            reserved = set((self.hb.get(site) or {}).get("reserved_ports") or [])
            if d["port"] in reserved:
                raise ValidationError(f"Cổng {d['port']} đang dành cho agent/Traefik")
        self.store.sites[site]["dashboard"] = d

    # ------------------------------------------------------------ BMC
    def validate_bmc(self, raw, existing=None):
        b = validate_bmc_fields(raw)
        if b["site"] not in self.store.sites:
            raise ValidationError(f"Site '{b['site']}' không tồn tại")
        mine = bmc_ports(b)
        for o in self.store.bmcs:
            if o["site"] != b["site"] or bmc_key(o) == existing:
                continue
            theirs = bmc_ports(o)
            if mine & theirs:
                raise ValidationError(f"Cổng {sorted(mine & theirs)[0]} đã dùng cho BMC {o['port']} "
                                      f"cùng site")
        dash = self.store.sites[b["site"]].get("dashboard") or {}
        if dash.get("enabled") and dash.get("port") in mine:
            raise ValidationError(f"Cổng {dash['port']} đang dùng cho dashboard Traefik của site")
        reserved = set((self.hb.get(b["site"]) or {}).get("reserved_ports") or [])
        if mine & reserved:
            raise ValidationError(f"Cổng {sorted(mine & reserved)[0]} đang dành cho agent/Traefik")
        tkey = str(raw.get("template") or "")
        if tkey:
            if tkey not in all_templates(self.store.templates):
                raise ValidationError(f"Không có mẫu '{tkey}'")
            b["template"] = tkey
        b["tags"] = parse_tags(raw.get("tags"))
        exp = str(raw.get("expires") or "").strip()
        if exp and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", exp):
            raise ValidationError("Hạn sử dụng dạng YYYY-MM-DD")
        b["expires"] = exp
        return b

    def free_ports(self, site, web_range=(8001, 8999), console_range=(5900, 5999),
                   tcp_range=(17000, 17999), tcp_count=0):
        used = set((self.hb.get(site) or {}).get("reserved_ports") or [])
        for b in self.store.bmcs:
            if b["site"] == site:
                used |= bmc_ports(b)
        dash = self.store.sites[site].get("dashboard") or {}
        if dash.get("enabled"):
            used.add(dash.get("port"))

        def pick(lo, hi):
            return next((p for p in range(lo, hi + 1) if p not in used), None)
        tcp = []
        for p in range(tcp_range[0], tcp_range[1] + 1):
            if len(tcp) >= tcp_count:
                break
            if p not in used:
                tcp.append(p)
        return {"port": pick(*web_range), "console_port": pick(*console_range), "tcp": tcp}

    # ------------------------------------------------------------ phat hanh
    def record_report(self, site, rep):
        """Ghi ket qua ap dung vao state[site].history (giu 40 lan gan nhat). Goi khi da giu store.lock."""
        state = self.store.state.setdefault(site, {})
        hist = state.setdefault("history", [])
        key = (rep.get("rev"), rep.get("attempt"))
        if hist and (hist[0].get("rev"), hist[0].get("attempt")) == key:
            return
        target = state.get("target") or {}
        by = target.get("by", "") if (target.get("rev"), target.get("attempt")) == key else ""
        hist.insert(0, {"rev": rep.get("rev"), "attempt": rep.get("attempt"), "ok": bool(rep.get("ok")),
                        "at": rep.get("at") or now_iso(), "by": by,
                        "steps": [{"step": x.get("step"), "ok": x.get("ok")} for x in (rep.get("log") or [])][:12]})
        del hist[40:]

    def release(self, site, user, retry=False):
        st = self.store
        with st.lock:
            rel = st.desired(site)
            state = st.state.setdefault(site, {})
            target = state.get("target") or {}
            if target.get("rev") == rel["rev"] and not retry and \
                    self.site_status(site)["phase"] in ("synced", "applying"):
                return False
            path = st._p("releases", site, f"{rel['rev']}.json")
            if st.load_release(site, rel["rev"]) is None:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                st.blob_put("release", f"{site}/{rel['rev']}", {**rel, "created_at": now_iso(), "created_by": user}, path)
            state["target"] = {"rev": rel["rev"], "attempt": int(target.get("attempt", 0)) + 1,
                               "at": now_iso(), "by": user}
            st.save("state.json")
            st.audit(user, "apply", f"rev {rel['rev']} ({len(rel['bmcs'])} BMC)", site)
            return True

    def plan(self, site):
        st = self.store
        h = self.hb.get(site) or {}
        params = {**DEFAULT_PARAMS, **(h.get("params") or {})}
        desired = st.desired(site)
        applied = st.load_release(site, h.get("applied_rev") or
                                  ((st.state.get(site) or {}).get("applied") or {}).get("rev"))
        old_static, old_dyn = render_files(applied, params) if applied else ("", {})
        new_static, new_dyn = render_files(desired, params)
        changes = []
        if old_static != new_static:
            changes.append({"area": "static", "file": "traefik.yml",
                            "kind": "modify" if old_static else "add",
                            "diff": _diff(old_static, new_static, "a/traefik.yml", "b/traefik.yml")})
        for name in sorted(set(old_dyn) | set(new_dyn)):
            o, n = old_dyn.get(name, ""), new_dyn.get(name, "")
            if o == n:
                continue
            kind = "add" if not o else "delete" if not n else "modify"
            changes.append({"area": "dynamic", "file": name, "kind": kind,
                            "diff": _diff(o, n, f"a/{name}" if o else "/dev/null",
                                          f"b/{name}" if n else "/dev/null")})
        for f in h.get("legacy_active") or []:
            changes.append({"area": "nginx", "file": f, "kind": "disable", "diff": ""})
        return changes

    # ------------------------------------------------------------ sao luu
    def snapshot(self, label):
        st = self.store
        bdir = st.cfg["backup_dir"]
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
        dest = os.path.join(bdir, f"{stamp}-{re.sub(r'[^a-z0-9-]', '', label)[:20]}")
        os.makedirs(dest)
        meta = {"label": label, "ts": now_iso(), "bmcs": len(st.bmcs),
                "sites": {k: sum(1 for b in st.bmcs if b["site"] == k) for k in st.sites}}
        docs = {"bmc.json": {"bmcs": sorted(st.bmcs, key=bmc_key)}, "settings.json": st.settings, "sites.json": st.sites}
        for name, obj in docs.items():
            write_json(os.path.join(dest, name), obj, 0o600 if name == "sites.json" else 0o644)
        write_json(os.path.join(dest, "meta.json"), meta)
        name = os.path.basename(dest)
        st.blob_put("backup", name, {"meta": meta, "docs": docs})
        backups = sorted(d for d in os.listdir(bdir) if os.path.isdir(os.path.join(bdir, d)))
        for old in backups[:-MAX_BACKUPS]:
            shutil.rmtree(os.path.join(bdir, old), ignore_errors=True)
        if st.db:
            try:
                for old in st.db.blob_names("backup")[:-MAX_BACKUPS]:
                    st.db.blob_delete("backup", old)
            except Exception as e:
                st.db_error = f"{type(e).__name__}: {e}"
        return name

    def list_backups(self):
        st = self.store
        bdir = st.cfg["backup_dir"]
        found = {}
        for d in os.listdir(bdir):
            meta = read_json(os.path.join(bdir, d, "meta.json"), None)
            if meta is not None:
                found[d] = meta
        if st.db:  # DB la nguon chinh: may web moi (chua co thu muc backups) van thay ban sao luu
            try:
                for d in st.db.blob_names("backup"):
                    if d not in found:
                        found[d] = (st.db.blob_get("backup", d) or {}).get("meta") or {}
            except Exception as e:
                st.db_error = f"{type(e).__name__}: {e}"
        return [{"name": d, **found[d]} for d in sorted(found, reverse=True)]

    def read_backup(self, name):
        st = self.store
        snap = st.blob_get("backup", name)
        return snap or read_backup_dir(os.path.join(st.cfg["backup_dir"], name))

    def restore(self, name, user):
        if not re.match(r"^[0-9A-Za-z-]+$", name):
            raise ValidationError("Tên bản sao lưu không hợp lệ")
        st = self.store
        snap = self.read_backup(name)
        if not snap:
            raise ValidationError("Không tìm thấy bản sao lưu")
        docs = snap["docs"]
        with st.lock:
            current = self.snapshot("before-restore")
            st.bmcs = (docs.get("bmc.json") or {"bmcs": []}).get("bmcs", [])
            st.settings = {**SETTINGS_DEFAULTS, **{k: v for k, v in (docs.get("settings.json") or {}).items()
                                                   if k in SETTINGS_DEFAULTS}}
            old_sites = docs.get("sites.json") or {}
            for k, s in old_sites.items():
                if k in st.sites:  # giu token hien tai de agent khong bi mat ket noi
                    s["token_hash"] = st.sites[k].get("token_hash", "")
                    s["token_hint"] = st.sites[k].get("token_hint", "")
            for k in list(st.sites):
                if k not in old_sites and any(b["site"] == k for b in st.bmcs):
                    old_sites[k] = st.sites[k]
            for k, s in st.sites.items():
                old_sites.setdefault(k, s)
            st.sites = old_sites
            for n in ("bmc.json", "settings.json", "sites.json"):
                st.save(n)
            st.audit(user, "restore", f"{name} (trước đó: {current})")
        return {"ok": True, "backup": current}


# =========================================================================== #
# HTTP
# =========================================================================== #

def make_handler(app):
    st = app.store

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "bmcproxy"
        sys_version = ""
        timeout = 60          # ket noi treo khong lam ngheo luong
        is_plain = False

        def setup(self):
            """Bat tay TLS trong luong rieng cua tung ket noi (khong chan cac ket noi khac).
            Ket noi http thuong (go nham http://) -> tra 301 sang https://."""
            ctx = getattr(self.server, "ssl_ctx", None)
            if ctx is not None:
                self.request.settimeout(15)
                try:
                    first = self.request.recv(1, socket.MSG_PEEK)
                except OSError:
                    first = b""
                if first == b"\x16":  # ban ghi TLS handshake
                    self.request = ctx.wrap_socket(self.request, server_side=True)
                else:
                    self.is_plain = True
            super().setup()

        def log_message(self, fmt, *args):
            if "/agent/v1/sync" in (getattr(self, "path", "") or ""):
                return
            sys.stderr.write("%s - %s\n" % (self.client_ip(), fmt % args))

        def send(self, code, body, ctype="application/json; charset=utf-8", headers=None):
            if not isinstance(body, (bytes, str)):
                body = json.dumps(body, ensure_ascii=False)
            if isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Web-Version", web_version()["v"])  # trang dang mo so voi ban moi -> bao tai lai
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            if isinstance(self.connection, ssl.SSLSocket):
                self.send_header("Strict-Transport-Security", "max-age=31536000")
            self.send_header("Content-Security-Policy",
                             "default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; "
                             "script-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def err(self, code, msg):
            self.send(code, {"error": msg})

        def cookie_token(self):
            for part in (self.headers.get("Cookie") or "").split(";"):
                k, _, v = part.strip().partition("=")
                if k == "bmcproxy_session":
                    return v
            return None

        def body_json(self, limit=5_000_000):
            n = int(self.headers.get("Content-Length") or 0)
            if n > limit:
                raise ValidationError("Dữ liệu quá lớn")
            raw = self.rfile.read(n) if n else b"{}"
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
            except ValueError:
                raise ValidationError("JSON không hợp lệ")
            if not isinstance(data, dict):
                raise ValidationError("JSON phải là object")
            return data

        def do_GET(self):
            self.route("GET")

        def do_POST(self):
            self.route("POST")

        def do_PUT(self):
            self.route("PUT")

        def do_DELETE(self):
            self.route("DELETE")

        def route(self, method):
            if self.is_plain:
                host = re.sub(r"[^A-Za-z0-9.:\[\]-]", "", self.headers.get("Host") or "")
                path = self.path if self.path.startswith("/") else "/"
                self.send_response(301)
                self.send_header("Location", f"https://{host}{path}")
                self.send_header("Content-Length", "0")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                return
            self._ip = None
            REQ.ip = self.client_ip()
            REQ.ua = short_agent(self.headers.get("User-Agent"))
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            self.query = urllib.parse.parse_qs(parsed.query)
            wp = (st.cfg.get("web_path") or "").rstrip("/")
            if wp:
                if path == wp:  # thieu dau / cuoi -> them vao de duong dan tuong doi dung
                    self.send_response(301)
                    self.send_header("Location", wp + "/" + (("?" + parsed.query) if parsed.query else ""))
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                if path.startswith(wp + "/"):
                    path = path[len(wp):]
                elif not (path.startswith(("/agent/v1/", "/install/")) or path == "/api/zabbix"):
                    return self.send(404, b"Not found", "text/plain; charset=utf-8")
            try:
                st.refresh()
                if method == "GET" and path in STATIC:
                    fname, ctype = STATIC[path]
                    with open(os.path.join(WEB_DIR, fname), "rb") as f:
                        body = f.read()
                    if fname == "index.html":
                        wv = web_version()
                        body = (body.replace(b'href="app.css"', f'href="app.css?v={wv["app.css"]}"'.encode(), 1)
                                .replace(b'src="app.js"', f'src="app.js?v={wv["app.js"]}"'.encode(), 1)
                                .replace(b"</head>", f'<meta name="web-version" content="{wv["v"]}">\n</head>'.encode(), 1))
                    if DEV and fname == "index.html":
                        body = body.replace(b"</body>", b'<script src="__dev/reload.js"></script></body>', 1)
                    return self.send(200, body, ctype)
                if DEV and method == "GET" and path == "/__dev/version":
                    return self.send(200, dev_version())
                if DEV and method == "GET" and path == "/__dev/reload.js":
                    return self.send(200, DEV_RELOAD_JS, "application/javascript; charset=utf-8")
                if path.startswith("/agent/v1/"):
                    return self.agent_api(method, path[len("/agent/v1/"):])
                m = re.match(r"^/install/([A-Za-z0-9_-]{20,64})(/agent\.zip)?$", path)
                if m and method == "GET":
                    return self.install_get(m.group(1), bool(m.group(2)))
                if path == "/api/zabbix" and method == "GET":
                    return self.api_zabbix()
                if path == "/api/login" and method == "POST":
                    return self.api_login()
                if path == "/api/login-info" and method == "GET":
                    lc = st.auth.get("ldap") or {}
                    on = bool(lc.get("enabled")) and gw_ldap.available()
                    return self.send(200, {"ldap": on, "domain": (lc.get("domain") or "") if on else ""})
                if not path.startswith("/api/"):
                    return self.err(404, "Không tìm thấy")
                name = app.session_user(self.cookie_token())
                if not name:
                    return self.err(401, "Chưa đăng nhập")
                if method != "GET" and self.headers.get("X-Requested-With") != "bmcproxy":
                    return self.err(403, "Thiếu header chống CSRF")
                return self.api(method, path.strip("/").split("/")[1:], app.user(name))
            except ValidationError as e:
                return self.err(400, str(e))
            except PermissionError as e:
                return self.err(403, str(e))
            except Exception as e:
                traceback.print_exc()
                return self.err(500, f"Lỗi máy chủ: {e}")

        # ------------------------------------------------------------ agent
        def client_ip(self):
            if getattr(self, "_ip", None) is None:
                headers = getattr(self, "headers", None)  # request het gio truoc khi doc xong header -> chua co
                if headers is None:
                    return self.client_address[0]
                self._ip = real_client_ip(self.client_address[0], headers, st.cfg)
            return self._ip

        def agent_site(self):
            auth = self.headers.get("Authorization") or ""
            site = self.headers.get("X-Agent-Site") or ""
            token = auth[7:] if auth.startswith("Bearer ") else ""
            s = st.sites.get(site)
            if not s or not token or not s.get("token_hash") or \
                    not hmac.compare_digest(hash_token(token), s["token_hash"]):
                return None
            allowed = s.get("allowed_ips") or []
            # IP that (qua proxy) hoac IP ket noi truc tiep nam trong danh sach (site cu co san 127.0.0.1 van chay)
            if allowed and self.client_ip() not in allowed and self.client_address[0] not in allowed:
                return None
            return site

        def agent_api(self, method, name):
            site = self.agent_site()
            if not site:
                claimed = clean_text(self.headers.get("X-Agent-Site"), 40)
                sys.stderr.write(f"agent bị từ chối: site={claimed!r} ip={self.client_ip()} "
                                 "(sai token, chưa có site, hoặc IP không nằm trong danh sách)\n")
                return self.err(401, "Agent không hợp lệ (token / site / IP)")
            if method != "POST":
                return self.err(405, "Chỉ nhận POST")
            data = self.body_json()
            if name == "sync":
                data["_received"] = time.time()
                data["_ip"] = self.client_ip()
                act = data.get("action") if isinstance(data.get("action"), dict) else None
                if act and act.get("name") == "update_agent":
                    st.audit("agent", "agent-update" if act.get("ok") else "agent-update-failed",
                             str(act.get("output", ""))[:300], site)
                    app.notifier.event("agent_update", ("✅ Đã cập nhật agent" if act.get("ok") else "❌ Cập nhật agent lỗi")
                                       + f" ở site {st.sites[site]['label']}", str(act.get("output", ""))[:500])
                for k in ("logs", "diag", "action", "detect"):
                    if isinstance(data.get(k), dict):
                        app.extra.setdefault(site, {})[k] = data.pop(k)
                if isinstance(data.get("access"), list):
                    st.access_add(site, data.pop("access"))
                if isinstance(data.get("denied"), list):
                    st.denied_add(site, data.pop("denied"))
                was_online = app.online(site)
                app.hb[site] = data
                if not was_online:
                    st.audit("agent", "agent-online", data.get("hostname", ""), site)
                with st.lock:
                    cmds = app.commands.pop(site, [])
                    target = (st.state.get(site) or {}).get("target")
                resp = {"target": target, "commands": cmds, "server_time": now_iso(), "guests": app.site_guests(site),
                        "maint": app.site_maint(site), "ip_rules": app.site_ip_rules(site)}
                att = data.get("attempt") or {}
                # Agent da ap dung nhung goi /report bi mat (mang chap chon): lay ket qua tu heartbeat
                if target and (att.get("rev"), att.get("attempt")) == (target["rev"], target["attempt"]):
                    with st.lock:
                        state = st.state.setdefault(site, {})
                        last = state.get("last_report") or {}
                        if (last.get("rev"), last.get("attempt")) != (att.get("rev"), att.get("attempt")):
                            state["last_report"] = {k: att.get(k) for k in ("rev", "attempt", "ok", "log", "at", "skipped")}
                            app.record_report(site, state["last_report"])
                            if att.get("ok"):
                                state["applied"] = {"rev": att.get("rev"), "at": att.get("at")}
                            st.save("state.json")
                if target and (att.get("rev"), att.get("attempt")) != (target["rev"], target["attempt"]):
                    resp["release"] = st.load_release(site, target["rev"])
                return self.send(200, resp)
            if name == "report":
                with st.lock:
                    state = st.state.setdefault(site, {})
                    state["last_report"] = {k: data.get(k) for k in ("rev", "attempt", "ok", "log", "at", "skipped")}
                    app.record_report(site, state["last_report"])
                    if data.get("ok"):
                        state["applied"] = {"rev": data.get("rev"), "at": data.get("at")}
                    st.save("state.json")
                skipped = data.get("skipped") or []
                st.audit("agent", "apply-ok" if data.get("ok") else "apply-failed",
                         f"rev {data.get('rev')}" + (f", bỏ qua BMC {', '.join(str(x.get('port')) for x in skipped)}"
                                                     " (cổng bận)" if skipped else ""), site)
                if data.get("ok") and skipped:
                    app.notifier.event("apply_failed", f"⚠️ Áp dụng một phần ở site {st.sites[site]['label']}",
                                       "\n".join(f"- BMC {x.get('port')}: cổng {x.get('owner')} đang bị chương trình khác dùng"
                                                  for x in skipped[:10]) + "\nCác BMC khác đã áp dụng. Xử lý xong bấm Thử lại.")
                if not data.get("ok"):
                    failed = [x for x in data.get("log") or [] if not x.get("ok")]
                    app.notifier.event("apply_failed", f"❌ Áp dụng lỗi ở site {st.sites[site]['label']}",
                                       "Đã tự khôi phục cấu hình cũ.\n" + "\n".join(
                                           f"- {x.get('step')}: {str(x.get('output') or '')[:300]}" for x in failed[:5]))
                return self.send(200, {"ok": True})
            if name == "import":
                return self.send(200, self.agent_import(site, data))
            if name == "package":  # lenh "Cap nhat agent": agent tai goi moi bang token cua minh
                info = agent_pkg_info()
                if not info:
                    return self.err(404, "Web chưa có gói agent")
                with open(info["path"], "rb") as f:
                    return self.send(200, f.read(), "application/zip")
            return self.err(404, "Không tìm thấy")

        def agent_import(self, site, data):
            accepted, skipped, enabled_auth = [], list(data.get("skipped") or []), []
            with st.lock:
                app.snapshot("import")
                for item in data.get("items") or []:
                    if not isinstance(item, dict) or not isinstance(item.get("raw"), dict):
                        continue
                    try:
                        port = to_port(item["raw"].get("port"), "Cổng")
                    except ValidationError:
                        port = None
                    if port and st.get_bmc(site, port):
                        # BMC da co (vd nhap lai sau khi quay ve nginx): van ghi nhan file nginx
                        # de lan ap dung toi agent tat file do, tranh trung cong voi Traefik
                        accepted.append(item.get("file"))
                        skipped.append({"file": item.get("file"), "reason": f"cổng {port} đã có, giữ BMC hiện tại"})
                        continue
                    try:
                        b = app.validate_bmc({**item["raw"], "site": site})
                    except ValidationError as e:
                        skipped.append({"file": item.get("file"), "reason": str(e)})
                        continue
                    b.update(imported_from=clean_text(item.get("file"), 120),
                             imported_auth=bool(item.get("had_auth")),
                             imported_console_auth=item.get("had_console_auth"),
                             updated_at=now_iso(), updated_by="import")
                    st.bmcs.append(b)
                    accepted.append(item.get("file"))
                    if not item.get("had_auth") or item.get("had_console_auth") is False:
                        enabled_auth.append(b["port"])
                    url = item.get("auth_url") or ""
                    s = st.sites[site]
                    if url and url != st.settings["auth_url"] and "auth_url" not in s["overrides"]:
                        try:
                            s["overrides"].update(validate_settings_values({"auth_url": url}, True))
                            st.save("sites.json")
                        except ValidationError:
                            pass
                st.save("bmc.json")
                st.audit("agent", "import", f"{len(accepted)} BMC, bật xác thực {len(enabled_auth)}", site)
            return {"accepted": accepted, "skipped": skipped, "auth_enabled": enabled_auth}

        # ------------------------------------------------------------ dang nhap
        def api_login(self):
            ip = self.client_ip()
            if not app.login_allowed(ip):
                return self.err(429, "Sai quá nhiều lần, thử lại sau 5 phút")
            data = self.body_json(10_000)
            name = str(data.get("user", ""))[:64]
            password = str(data.get("password", ""))
            acct = gw_ldap.normalize_user(name) or name
            if app.account_locked(name) or app.account_locked(acct):
                app.login_failed(ip)
                return self.err(429, f"Tài khoản tạm khoá {ACCOUNT_LOCK_SECONDS // 60} phút do sai mật khẩu nhiều lần")
            rec = st.users.get(name)
            lc = st.auth.get("ldap") or {}
            if rec and rec.get("source") != "ldap" or not (lc.get("enabled") and gw_ldap.available()):
                # tai khoan rieng cua web (admin du phong van vao duoc khi AD hong)
                if not rec or rec.get("source") == "ldap" or not check_password(rec, password):
                    locked = app.login_failed(ip, name if rec else "")
                    if locked:
                        app.notifier.event("login_locked", f"🔒 Khoá tài khoản {name} {ACCOUNT_LOCK_SECONDS // 60} phút",
                                           f"Sai mật khẩu {ACCOUNT_MAX_FAILS} lần liên tiếp, lần cuối từ IP {ip}.")
                    if rec:
                        st.audit(name, "login-fail", "sai mật khẩu"
                                 + (f" - khoá tài khoản {ACCOUNT_LOCK_SECONDS // 60} phút" if locked else ""))
                    return self.err(401, "Sai tài khoản hoặc mật khẩu")
            else:
                name, rec, msg = self.ldap_login(lc, name, password, ip)
                if msg:
                    return msg
            reason = app.blocked_reason(rec)
            if reason:
                st.audit(name, "login-fail", reason)
                return self.err(403, reason)
            if rec.get("totp_secret"):
                otp = str(data.get("otp") or "").strip()
                if not otp:
                    return self.send(401, {"error": "Nhập mã xác thực 2 lớp (6 số trên ứng dụng Authenticator)",
                                           "need_otp": True})
                if not totp_check(rec["totp_secret"], otp):
                    app.login_failed(ip, name)
                    st.audit(name, "login-fail", "sai mã 2FA")
                    return self.send(401, {"error": "Mã xác thực 2 lớp không đúng", "need_otp": True})
            app.login_ok(ip, name)
            app.ldap_checked[name] = time.time()
            remember = bool(data.get("remember"))
            token = app.new_session(name, ip, remember)
            with st.lock:
                rec["last_login"] = {"ts": now_iso(), "ip": ip}
                try:
                    st.save("users.json")
                except ValidationError:
                    pass
            st.audit(name, "login", ", ".join(x for x in (
                "tài khoản AD" if rec.get("source") == "ldap" else "", "2FA" if rec.get("totp_secret") else "",
                "ghi nhớ 30 ngày" if remember else "") if x))
            secure = "; Secure" if isinstance(self.connection, ssl.SSLSocket) else ""
            # Ghi nho: cookie 30 ngay. Khong: cookie mat khi dong trinh duyet (web gioi han 12 gio)
            cookie = (f"bmcproxy_session={token}; Path={(st.cfg.get('web_path') or '') + '/'}; HttpOnly; SameSite=Strict"
                      + (f"; Max-Age={REMEMBER_TTL}" if remember else "") + secure)
            return self.send(200, app.user(name), headers={"Set-Cookie": cookie})

        def api_my(self, method, what, u):
            """Cong khach hang: BMC cua toi, mo BMC (link tam), lich su truy cap."""
            mine = app.customer_bmcs(u)
            keys = {(b["site"], b["port"]) for b in mine}
            if method == "GET" and what == "bmcs":
                out = []
                for b in mine:
                    h = app.hb.get(b["site"]) or {}
                    web = ((h.get("health") or {}).get(str(b["port"])) or {}).get("web") or {}
                    online = app.online(b["site"])
                    m = app.maint_active(b["site"], b["port"])
                    out.append({"site": b["site"], "site_label": st.sites[b["site"]]["label"], "port": b["port"],
                                "note": b.get("note", ""), "expires": b.get("expires", ""),
                                "java_web": bool(b.get("java_web")),
                                "status": "maint" if m else "unknown" if not online or not web
                                else "up" if web.get("up") else "down",
                                "maint": {"end": m["end"], "note": m.get("note", "")} if m else None})
                return self.send(200, out)
            if method == "GET" and what == "access":
                rows = [r for r in st.read_access(3000) if (r.get("site"), r.get("port")) in keys][:300]
                return self.send(200, rows)
            if method == "POST" and what == "open":
                data = self.body_json(2000)
                try:
                    key = (str(data.get("site", "")), int(data.get("port")))
                except (TypeError, ValueError):
                    raise ValidationError("BMC không hợp lệ")
                if key not in keys:
                    raise PermissionError("BMC này không thuộc tài khoản của bạn")
                b = st.get_bmc(*key)
                domain = st.sites[key[0]]["domain"]
                if not b.get("auth", True):
                    return self.send(200, {"url": f"https://{domain}:{key[1]}/"})
                token = secrets.token_urlsafe(24)
                now = time.time()
                with st.lock:
                    # moi lan mo cap link moi 4 gio; link cong khach hang cu cua cung BMC + nguoi thi thu hoi
                    for g in st.guests.values():
                        if g.get("portal") == u["name"] and (g["site"], g["port"]) == key and not g.get("revoked"):
                            g["revoked"], g["revoked_by"] = True, "cổng khách hàng"
                    for old in [i for i, g in st.guests.items() if g["exp"] < now - 30 * 86400]:
                        del st.guests[old]
                    gid = secrets.token_hex(6)
                    st.guests[gid] = {"hash": hash_token(token), "site": key[0], "port": key[1],
                                      "label": f"KH {u.get('full_name') or u['name']}"[:60], "exp": now + 4 * 3600,
                                      "created_at": now_iso(), "created_by": u["name"], "portal": u["name"]}
                    st.save("guests.json")
                st.audit(u["name"], "portal-open", f"cổng {key[1]}", key[0])
                return self.send(200, {"url": f"https://{domain}:{key[1]}{GUEST_PATH}?t={token}",
                                       "site_online": app.online(key[0])})
            return self.err(404, "Không tìm thấy API")

        def api_maint(self, method, mid, u):
            if method == "GET" and mid is None:
                rows = [app.maint_view(i, m) for i, m in st.maint.items() if app.can_view(u, m["site"])]
                now_rows = sorted((r for r in rows if r["status"] != "done"), key=lambda r: (r["status"] != "active", r["start"]))
                done = sorted((r for r in rows if r["status"] == "done"), key=lambda r: r["end"], reverse=True)
                return self.send(200, now_rows + done)
            if method == "POST" and mid is None:
                data = self.body_json(5000)
                site = str(data.get("site", ""))
                if site not in st.sites:
                    raise ValidationError("Không có site này")
                app.need(u, "maint", site)
                port = int(data.get("port") or 0)
                if port and not st.get_bmc(site, port):
                    raise ValidationError(f"Site {site} không có BMC cổng {port}")
                start, end = str(data.get("start", ""))[:16], str(data.get("end", ""))[:16]
                for v in (start, end):
                    try:
                        dt.datetime.strptime(v, "%Y-%m-%dT%H:%M")
                    except ValueError:
                        raise ValidationError("Thời gian dạng YYYY-MM-DDTHH:MM")
                if end <= start:
                    raise ValidationError("Kết thúc phải sau bắt đầu")
                if end <= app._now_local():
                    raise ValidationError("Lịch bảo trì đã kết thúc trong quá khứ")
                mid = secrets.token_hex(5)
                with st.lock:
                    cutoff = (dt.datetime.now() - dt.timedelta(days=90)).strftime("%Y-%m-%dT%H:%M")
                    for old in [i for i, m in st.maint.items() if m["end"] < cutoff]:  # giu lich cu 90 ngay
                        del st.maint[old]
                    st.maint[mid] = {"site": site, "port": port, "start": start, "end": end,
                                     "note": clean_text(data.get("note", ""), 120), "created_by": u["name"],
                                     "created_at": now_iso()}
                    st.save("maint.json")
                st.audit(u["name"], "maint-add", f"{'cổng ' + str(port) if port else 'cả site'} {start} → {end}"
                         + (f" · {st.maint[mid]['note']}" if st.maint[mid]["note"] else ""), site)
                return self.send(201, app.maint_view(mid, st.maint[mid]))
            if method == "DELETE" and mid:
                m = st.maint.get(mid)
                if not m:
                    return self.err(404, "Không có lịch này")
                app.need(u, "maint", m["site"])
                with st.lock:
                    if m["start"] <= app._now_local() < m["end"]:  # dang dien ra -> ket thuc ngay (giu lich su)
                        m["end"] = app._now_local()
                        m["ended_by"] = u["name"]
                    else:
                        del st.maint[mid]
                    st.save("maint.json")
                st.audit(u["name"], "maint-end", f"{'cổng ' + str(m.get('port')) if m.get('port') else 'cả site'}", m["site"])
                return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        def blocked_view(self, u):
            """Lan bi chan gom theo (site, cong, IP): tong so lan, ly do, lan dau / cuoi."""
            app.need(u, "stats")
            site = (self.query.get("site") or [""])[0]
            try:
                days = max(1, min(30, int((self.query.get("days") or ["7"])[0])))
            except ValueError:
                days = 7
            agg = {}
            for r in st.read_denied(site=site, days=days):
                if not app.can(u, "stats", r.get("site", "")):
                    continue
                k = (r["site"], r["port"], r["ip"])
                a = agg.setdefault(k, {"site": r["site"], "port": r["port"], "ip": r["ip"], "count": 0, "reasons": {},
                                       "first": r.get("first") or r["ts"], "last": r["ts"], "path": r.get("path", "")})
                a["count"] += r["count"]
                a["reasons"][r["reason"]] = a["reasons"].get(r["reason"], 0) + r["count"]
                a["first"] = min(a["first"], r.get("first") or r["ts"])
                a["last"] = max(a["last"], r["ts"])
            notes = {bmc_key(b): b.get("note", "") for b in st.bmcs}
            rows = sorted(agg.values(), key=lambda a: (-a["count"], a["last"]))[:1000]
            for a in rows:
                a["note"] = notes.get((a["site"], a["port"]), "")
                a["rule"] = next((app.iprule_view(i, x)["action"] for i, x in st.iprules.items() if x["site"] == a["site"]
                                  and (not x.get("port") or x["port"] == a["port"]) and ip_in(a["ip"], x["cidr"])
                                  and (not x.get("exp") or x["exp"] > time.time())), "")
            by_ip = {}
            for a in rows:
                by_ip[a["ip"]] = by_ip.get(a["ip"], 0) + a["count"]
            return {"rows": rows, "days": days, "total": sum(a["count"] for a in rows), "ips": len(by_ip),
                    "top_ips": sorted(by_ip.items(), key=lambda x: -x[1])[:10]}

        def api_iprules(self, method, rid, u):
            if method == "GET" and rid is None:
                rows = [app.iprule_view(i, r) for i, r in st.iprules.items() if app.can_view(u, r["site"])]
                return self.send(200, sorted(rows, key=lambda r: (r["status"] != "active", r["site"], r["action"], r["cidr"])))
            if method == "POST" and rid is None:
                data = self.body_json(10_000)
                site = str(data.get("site", ""))
                if site not in st.sites:
                    raise ValidationError("Chọn site")
                app.need(u, "iprules", site)
                action = str(data.get("action", ""))
                if action not in ("block", "allow"):
                    raise ValidationError("Chọn chặn hoặc cho phép")
                try:
                    net = ipaddress.ip_network(str(data.get("cidr", "")).strip(), strict=False)
                except ValueError:
                    raise ValidationError("IP / dải IP không hợp lệ (vd 1.2.3.4 hoặc 1.2.3.0/24)")
                if action == "allow" and net.prefixlen < (16 if net.version == 4 else 48):
                    raise ValidationError("Cho phép tối đa dải /16 (IPv6 /48): dải rộng hơn = mở BMC cho quá nhiều người")
                if action == "block" and net.prefixlen < (8 if net.version == 4 else 32):
                    raise ValidationError("Chặn tối đa dải /8 (IPv6 /32)")
                port = int(data.get("port") or 0)
                if port and not st.get_bmc(site, port):
                    raise ValidationError(f"Site {site} không có BMC cổng {port}")
                try:
                    hours = float(data.get("hours") or 0)
                except (TypeError, ValueError):
                    raise ValidationError("Thời hạn là số giờ")
                if hours < 0 or hours > 24 * 365:
                    raise ValidationError("Thời hạn tối đa 1 năm (0 = không hạn)")
                rid = secrets.token_hex(5)
                rec = {"site": site, "port": port, "cidr": str(net), "action": action,
                       "exp": time.time() + hours * 3600 if hours else 0, "note": clean_text(data.get("note", ""), 60),
                       "created_by": u["name"], "created_at": now_iso()}
                with st.lock:
                    dup = [i for i, r in st.iprules.items() if (r["site"], r.get("port", 0), r["cidr"]) == (site, port, rec["cidr"])]
                    for i in dup:  # cung IP + pham vi: thay quy tac cu
                        del st.iprules[i]
                    cutoff = time.time() - 30 * 86400
                    for old in [i for i, r in st.iprules.items() if r.get("exp") and r["exp"] < cutoff]:
                        del st.iprules[old]
                    st.iprules[rid] = rec
                    st.save("iprules.json")
                st.audit(u["name"], f"ip-{action}", f"{rec['cidr']} {'cổng ' + str(port) if port else 'cả site'}"
                         + (f", {hours:g} giờ" if hours else "") + (f" · {rec['note']}" if rec["note"] else ""), site)
                return self.send(201, {**app.iprule_view(rid, rec), "site_online": app.online(site)})
            if method == "DELETE" and rid:
                r = st.iprules.get(rid)
                if not r:
                    return self.err(404, "Không có quy tắc này")
                app.need(u, "iprules", r["site"])
                with st.lock:
                    del st.iprules[rid]
                    st.save("iprules.json")
                st.audit(u["name"], "ip-rule-delete", f"{'chặn' if r['action'] == 'block' else 'cho phép'} {r['cidr']}"
                         + (f" cổng {r['port']}" if r.get("port") else ""), r["site"])
                return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        def api_guests(self, method, gid, u):
            if method == "GET" and gid is None:
                rows = [app.guest_view(i, g) for i, g in st.guests.items() if app.can_view(u, g["site"])]
                site = (self.query.get("site") or [""])[0]
                port = (self.query.get("port") or [""])[0]
                rows = [r for r in rows if (not site or r["site"] == site) and (not port or str(r["port"]) == port)]
                order = {"active": 0, "expired": 1, "revoked": 2}
                return self.send(200, sorted(rows, key=lambda r: (order[r["status"]], r["expires"]), reverse=False))
            if method == "POST" and gid is None:
                data = self.body_json(10_000)
                site = str(data.get("site", ""))
                if site not in st.sites:
                    raise ValidationError("Không có site này")
                app.need(u, "guests", site)
                port = to_port(data.get("port"), "Cổng")
                b = st.get_bmc(site, port)
                if not b:
                    raise ValidationError("Không có BMC này")
                if not b.get("auth", True):
                    raise ValidationError("BMC đang tắt 'Bắt xác thực' - ai có link BMC cũng vào được, không cần link khách")
                try:
                    hours = float(data.get("hours") or 4)
                except (TypeError, ValueError):
                    raise ValidationError("Số giờ là số")
                if not 0.25 <= hours <= 168:
                    raise ValidationError("Thời hạn từ 15 phút đến 7 ngày")
                label = clean_text(data.get("label", ""), 60)
                token = secrets.token_urlsafe(24)
                gid = secrets.token_hex(6)
                now = time.time()
                with st.lock:
                    for old in [i for i, g in st.guests.items() if g["exp"] < now - 30 * 86400]:  # don link qua 30 ngay
                        del st.guests[old]
                    st.guests[gid] = {"hash": hash_token(token), "site": site, "port": port, "label": label,
                                      "exp": now + hours * 3600, "created_at": now_iso(), "created_by": u["name"]}
                    st.save("guests.json")
                url = f"https://{st.sites[site]['domain']}:{port}{GUEST_PATH}?t={token}"
                st.audit(u["name"], "guest-add", f"cổng {port}, {hours:g} giờ" + (f", {label}" if label else ""), site)
                return self.send(201, {**app.guest_view(gid, st.guests[gid]), "url": url,
                                       "site_online": app.online(site)})
            if method == "DELETE" and gid:
                g = st.guests.get(gid)
                if not g:
                    return self.err(404, "Không có link này")
                app.need(u, "guests", g["site"])
                with st.lock:
                    g["revoked"], g["revoked_by"] = True, u["name"]
                    st.save("guests.json")
                st.audit(u["name"], "guest-revoke", f"cổng {g['port']}" + (f", {g.get('label')}" if g.get("label") else ""),
                         g["site"])
                return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        def ldap_login(self, lc, raw, password, ip):
            """-> (ten, ban ghi, None) hoac (_, _, phan hoi loi da gui)."""
            name = gw_ldap.normalize_user(raw)
            local = st.users.get(name)
            if not name or (local and local.get("source") != "ldap"):
                # trung ten tai khoan rieng cua web -> khong cho AD "chiem" tai khoan do
                app.login_failed(ip)
                return None, None, self.err(401, "Sai tài khoản hoặc mật khẩu")
            try:
                info = gw_ldap.authenticate(lc, name, password)
                role, sites = gw_ldap.decide(lc, info, local)
            except gw_ldap.LdapError as e:
                if e.kind == "bad":
                    locked = app.login_failed(ip, name)
                    if locked:
                        app.notifier.event("login_locked", f"🔒 Khoá tài khoản AD {name} {ACCOUNT_LOCK_SECONDS // 60} phút",
                                           f"Sai mật khẩu {ACCOUNT_MAX_FAILS} lần liên tiếp, lần cuối từ IP {ip}.")
                    if local:
                        st.audit(name, "login-fail", f"AD: {e}"
                                 + (f" - khoá {ACCOUNT_LOCK_SECONDS // 60} phút" if locked else ""))
                    return None, None, self.err(401, str(e))
                st.audit(name, "login-fail", f"AD: {e}")
                if e.kind == "denied":
                    return None, None, self.err(403, str(e))
                sys.stderr.write(f"AD/LDAP: {e}\n")
                return None, None, self.err(503, "Không kiểm tra được tài khoản AD (máy chủ AD không trả lời). "
                                                 "Thử lại sau hoặc dùng tài khoản riêng của web.")
            with st.lock:
                rec = st.users.get(name)
                if rec is None:
                    rec = st.users[name] = {"created_at": now_iso(), "created_by": "AD"}
                    st.audit("AD", "user-add", f"{name} ({role}) tạo tự động khi đăng nhập AD")
                elif (rec.get("role"), rec.get("sites") or []) != (role, sites):
                    st.audit("AD", "user-edit", f"{name}: vai trò theo nhóm AD → {role}"
                                                + (f" ({', '.join(sites)})" if sites else ""))
                rec.update({"source": "ldap", "role": role, "sites": [s for s in sites if s in st.sites],
                            "ldap_dn": info["dn"], "ldap_groups": info["groups"][:60]})
                for k in ("full_name", "email"):
                    if info[k]:
                        rec[k] = info[k][:120]
                for k in ("salt", "iterations", "hash", "must_change"):
                    rec.pop(k, None)
            return name, rec, None

        def api_ldap(self, method, sub, u):
            app.need_admin(u)
            old = st.auth.get("ldap") or {}
            if method == "GET" and sub is None:
                return self.send(200, gw_ldap.public_view(old))
            data = self.body_json(20_000)
            if method == "PUT" and sub is None:
                cfg = gw_ldap.validate(data, old, tuple(st.sites))
                with st.lock:
                    st.auth["ldap"] = cfg
                    st.save("auth.json")
                st.audit(u["name"], "ldap", ("bật" if cfg["enabled"] else "tắt") + f" đăng nhập AD ({cfg['servers']})")
                return self.send(200, gw_ldap.public_view(cfg))
            if method == "POST" and sub == "test":
                # thu voi cai dat dang nhap tren form (chua can Luu), khong tao / sua tai khoan nao
                cfg = gw_ldap.validate({**data, "enabled": False}, old, tuple(st.sites))
                cfg["enabled"] = True
                if not gw_ldap.available():
                    return self.send(200, {"ok": False, "error": "Server web chưa cài ldap3: sudo apt install -y python3-ldap3"})
                user = str(data.get("test_user") or "")
                if not user:
                    try:
                        return self.send(200, {"ok": True, "message": gw_ldap.test_connection(cfg)})
                    except gw_ldap.LdapError as e:
                        return self.send(200, {"ok": False, "error": str(e)})
                try:
                    info = gw_ldap.authenticate(cfg, user, str(data.get("test_password") or ""))
                except gw_ldap.LdapError as e:
                    return self.send(200, {"ok": False, "error": str(e)})
                local = st.users.get(info["name"])
                try:
                    role, sites = gw_ldap.decide(cfg, info, local if local and local.get("source") == "ldap" else None)
                    verdict = ""
                except gw_ldap.LdapError as e:
                    role, sites, verdict = "", [], str(e)
                if local and local.get("source") != "ldap":
                    verdict = f"Web đã có tài khoản riêng tên {info['name']} - đăng nhập AD với tên này sẽ bị từ chối"
                st.audit(u["name"], "ldap-test", info["name"])
                return self.send(200, {"ok": True, "user": {k: info[k] for k in ("name", "dn", "full_name", "email", "groups")},
                                       "role": role, "sites": sites, "verdict": verdict})
            return self.err(404, "Không tìm thấy API")

        def api_zabbix(self):
            token = st.cfg.get("zabbix_token") or ""
            given = self.headers.get("X-Api-Token") or ""
            name = app.session_user(self.cookie_token())
            if not ((token and hmac.compare_digest(token, given)) or name):
                return self.err(401, "Sai token")
            u = app.user(name) if name else {"role": "admin", "sites": [], "name": "zabbix"}
            if u["role"] == "customer":
                return self.err(403, "Không có quyền")
            if self.query.get("type") == ["sites"]:
                return self.send(200, [{
                    "site": s["key"], "online": int(s["online"]), "phase": s["phase"],
                    "bmcs": s["enabled"], "down": s["down"], "router_errors": s["traefik"]["errors"],
                } for s in (app.site_status(k) for k in app.visible_sites(u))])
            out = []
            for v in app.bmc_views(u):
                if not v["enabled"]:
                    continue
                h, stt = v["health"] or {}, v["auth_stats"] or {}
                r = v["traefik"].get(f"bmc-{v['port']}") or {}
                out.append({
                    "site": v["site"], "port": v["port"], "key": f"{v['site']}:{v['port']}",
                    "upstream": v["upstream"], "note": v["note"], "auth": int(v["auth"]),
                    "site_online": int(v["site_online"]),
                    "up": int(bool((h.get("web") or {}).get("up"))),
                    "latency_ms": (h.get("web") or {}).get("ms"),
                    "console_port": v["console_port"],
                    "console_up": int(bool((h.get("console") or {}).get("up"))) if v["console_port"] else None,
                    "router_ok": int(r.get("status") == "enabled") if r else None,
                    "auth_ok": stt.get("ok", 0), "auth_deny": stt.get("deny", 0),
                    "auth_error": stt.get("error", 0),
                })
            return self.send(200, out)

        # ------------------------------------------------------------ API web
        def api(self, method, parts, u):
            res = parts[0] if parts else ""
            a1 = parts[1] if len(parts) > 1 else None
            a2 = parts[2] if len(parts) > 2 else None

            if res == "me" and method == "GET":
                return self.send(200, {**u, "version": VERSION})
            if u["role"] == "customer" and res not in ("logout", "password", "2fa", "my"):
                raise PermissionError("Tài khoản khách hàng chỉ dùng trang BMC của tôi")
            if res == "my":
                return self.api_my(method, a1, u)
            if res == "maint":
                return self.api_maint(method, a1, u)
            if res == "logout" and method == "POST":
                app.drop_session(self.cookie_token())
                return self.send(200, {"ok": True},
                                 headers={"Set-Cookie": f"bmcproxy_session=; Path={(st.cfg.get('web_path') or '') + '/'}; Max-Age=0"})
            if res == "ldap":
                return self.api_ldap(method, a1, u)
            if res == "guests":
                return self.api_guests(method, a1, u)
            if res == "blocked" and method == "GET":
                return self.send(200, self.blocked_view(u))
            if res == "iprules":
                return self.api_iprules(method, a1, u)
            if res == "stats" and method == "GET":
                app.need(u, "stats")
                return self.send(200, app.stats(u))
            if res == "access" and method == "GET":
                app.need(u, "stats")
                site = (self.query.get("site") or [""])[0]
                try:
                    port = int((self.query.get("port") or ["0"])[0] or 0)
                    limit = max(50, min(5000, int((self.query.get("limit") or ["2000"])[0])))
                except ValueError:
                    raise ValidationError("Tham số không hợp lệ")
                if site and not app.can_view(u, site):
                    raise PermissionError("Không có quyền xem site này")
                rows = [r for r in st.read_access(limit, site, port) if app.can_view(u, r.get("site", ""))]
                notes = {(b["site"], b["port"]): b.get("note", "") for b in st.bmcs}
                for r in rows:
                    r["note"] = notes.get((r.get("site"), r.get("port")), "")
                return self.send(200, rows)
            if res == "notify":
                app.need_admin(u)
                if method == "GET":
                    return self.send(200, {**gw_notify.public_view(st.notify), "sent": app.notifier.sent})
                data = self.body_json(20_000)
                if method == "PUT" and a1 is None:
                    cfg = gw_notify.validate(data, st.notify)
                    with st.lock:
                        st.notify = cfg
                        st.save("notify.json")
                    chans = [n for n, on in (("Telegram", cfg["telegram"]["enabled"]), ("email", cfg["email"]["enabled"])) if on]
                    st.audit(u["name"], "notify", "bật " + ", ".join(chans) if chans else "tắt cảnh báo")
                    return self.send(200, gw_notify.public_view(cfg))
                if method == "POST" and a1 == "test":
                    cfg = gw_notify.validate(data, st.notify)  # thu voi gia tri tren form (chua can Luu)
                    if not (cfg["telegram"]["enabled"] or cfg["email"]["enabled"]):
                        raise ValidationError("Bật ít nhất 1 kênh (Telegram / email) để thử")
                    res = gw_notify.deliver(cfg, "Thử cảnh báo",
                                            f"Tin thử từ web ({st.cfg['listen_port']}) do {u['name']} gửi lúc {now_iso()}.")
                    st.audit(u["name"], "notify-test", "; ".join(f"{k}: {v}" for k, v in res.items()))
                    return self.send(200, res)
            if res == "password" and method == "POST":
                if st.users[u["name"]].get("source") == "ldap":
                    raise ValidationError("Tài khoản AD: đổi mật khẩu trên Windows (Ctrl+Alt+Del → Đổi mật khẩu) hoặc nhờ IT")
                data = self.body_json(10_000)
                if not check_password(st.users[u["name"]], str(data.get("old", ""))):
                    raise ValidationError("Mật khẩu cũ không đúng")
                new = str(data.get("new", ""))
                if len(new) < 10:
                    raise ValidationError("Mật khẩu mới tối thiểu 10 ký tự")
                if check_password(st.users[u["name"]], new):
                    raise ValidationError("Mật khẩu mới phải khác mật khẩu cũ")
                with st.lock:
                    st.users[u["name"]].update(hash_password(new))
                    st.users[u["name"]].pop("must_change", None)
                    st.users[u["name"]]["password_changed"] = now_iso()
                    st.save("users.json")
                n = len(app.user_sessions(u["name"])) - 1
                app.drop_user_sessions(u["name"], keep_token=self.cookie_token())
                st.audit(u["name"], "password", f"đăng xuất {n} phiên khác" if n > 0 else "")
                return self.send(200, {"ok": True, "dropped": max(n, 0)})
            if res == "2fa" and method == "POST":
                return self.api_2fa(u)

            if res == "overview" and method == "GET":
                return self.send(200, self.overview(u))
            if res == "sites":
                return self.api_sites(method, a1, a2, u)
            if res == "templates":
                return self.api_templates(method, a1, a2, u)
            if res == "bmcs":
                return self.api_bmcs(method, a1, a2, u, parts[3] if len(parts) > 3 else None)
            if res == "render" and method == "POST":
                data = self.body_json()
                orig = data.get("_orig")
                existing = (orig["site"], int(orig["port"])) if isinstance(orig, dict) else None
                b = app.validate_bmc(data, existing)
                h = app.hb.get(b["site"]) or {}
                params = {**DEFAULT_PARAMS, **(h.get("params") or {})}
                return self.send(200, render_bmc(b, params), "text/plain; charset=utf-8")
            if res == "settings":
                if method == "GET":
                    return self.send(200, {"settings": st.settings, "overridable": OVERRIDABLE,
                                           "zabbix_enabled": bool(st.cfg.get("zabbix_token")),
                                           "offline_after": st.cfg["agent_offline_after"],
                                           "storage": st.storage_info() if u["role"] == "admin" else None,
                                           "version": VERSION})
                if method == "PUT":
                    app.need_admin(u)
                    s = validate_settings_values(self.body_json())
                    with st.lock:
                        st.settings = s
                        st.save("settings.json")
                    st.audit(u["name"], "settings")
                    return self.send(200, s)
            if res == "warnings" and method == "GET":
                return self.send(200, self.warnings(u))
            if res == "apply" and method == "POST":
                data = self.body_json()
                sites = data.get("sites") or [k for k in app.visible_sites(u) if app.can(u, "apply", k)]
                out = {}
                for k in sites:
                    if k not in st.sites:
                        continue
                    app.need(u, "apply", k)
                    out[k] = app.release(k, u["name"], retry=bool(data.get("retry")))
                return self.send(200, {"released": out})
            if res == "traefik" and method == "GET":
                site = (self.query.get("site") or [""])[0]
                if site not in st.sites or not app.can_view(u, site):
                    raise ValidationError("Chọn site")
                return self.send(200, {**((app.hb.get(site) or {}).get("traefik") or {}),
                                       "online": app.online(site)})
            if res == "backups":
                app.need_admin(u)
                if method == "GET" and a1 is None:
                    return self.send(200, app.list_backups())
                if method == "POST" and a1 and a2 == "restore":
                    return self.send(200, app.restore(a1, u["name"]))
            if res == "audit" and method == "GET":
                app.need(u, "audit")
                try:
                    limit = max(50, min(5000, int((self.query.get("limit") or ["2000"])[0])))
                except ValueError:
                    limit = 2000
                rows = st.read_audit(limit)
                if u["role"] != "admin" and u["sites"]:
                    rows = [r for r in rows if not r.get("site") or r["site"] in u["sites"]]
                return self.send(200, rows)
            if res == "users":
                return self.api_users(method, a1, u, a2)
            return self.err(404, "Không tìm thấy API")

        # ------------------------------------------------------------ site
        def api_sites(self, method, key, action, u):
            if method == "GET" and key is None:
                return self.send(200, [app.site_status(k) for k in app.visible_sites(u)])
            if method == "POST" and key is None:
                app.need_admin(u)
                data = self.body_json()
                key = str(data.get("key", "")).strip()
                if not RE_SITE_KEY.match(key):
                    raise ValidationError("Mã site chỉ gồm a-z, 0-9, - (tối đa 32 ký tự)")
                if key in st.sites:
                    raise ValidationError("Mã site đã tồn tại")
                rec = new_site_record(key, key.upper(), "")
                self.apply_site_fields(rec, data)
                token = secrets.token_urlsafe(32)
                rec["token_hash"], rec["token_hint"] = hash_token(token), token[-4:]
                with st.lock:
                    st.sites[key] = rec
                    if isinstance(data.get("dashboard"), dict):
                        try:
                            app.update_dashboard(key, data["dashboard"])
                        except ValidationError:
                            del st.sites[key]
                            raise
                    st.save("sites.json")
                st.audit(u["name"], "site-add", rec["domain"], key)
                return self.send(201, {"site": app.site_status(key), "token": token,
                                       "agent_config": self.agent_config(key, token)})
            if key not in st.sites or not app.can_view(u, key):
                return self.err(404, "Không có site này")
            if method == "GET" and action == "free-ports":
                n = to_port((self.query.get("tcp") or ["0"])[0] or 0, "Số cổng", True) if \
                    (self.query.get("tcp") or ["0"])[0] not in ("", "0") else 0
                return self.send(200, app.free_ports(key, tcp_count=min(n or 0, 12)))
            if method == "GET" and action == "plan":
                return self.send(200, app.plan(key))
            if method == "GET" and action is None:
                return self.send(200, app.site_status(key))
            if method == "PUT" and action is None:
                app.need_admin(u)
                data = self.body_json()
                with st.lock:
                    self.apply_site_fields(st.sites[key], data)
                    if isinstance(data.get("dashboard"), dict):
                        app.update_dashboard(key, data["dashboard"])
                    st.save("sites.json")
                st.audit(u["name"], "site-edit",
                         "dashboard " + ("bật" if st.sites[key].get("dashboard", {}).get("enabled") else "tắt")
                         if isinstance(data.get("dashboard"), dict) else "", key)
                return self.send(200, app.site_status(key))
            if method == "DELETE" and action is None:
                app.need_admin(u)
                if any(b["site"] == key for b in st.bmcs):
                    raise ValidationError("Site còn BMC, hãy xoá hoặc chuyển BMC trước")
                with st.lock:
                    app.snapshot("site-delete")
                    del st.sites[key]
                    st.state.pop(key, None)
                    st.save("sites.json")
                    st.save("state.json")
                app.hb.pop(key, None)
                st.audit(u["name"], "site-delete", "", key)
                return self.send(200, {"ok": True})
            if method == "POST" and action == "token":
                app.need_admin(u)
                token = secrets.token_urlsafe(32)
                with st.lock:
                    st.sites[key]["token_hash"] = hash_token(token)
                    st.sites[key]["token_hint"] = token[-4:]
                    st.save("sites.json")
                st.audit(u["name"], "site-token", "đổi token agent", key)
                return self.send(200, {"token": token, "agent_config": self.agent_config(key, token)})
            if method == "POST" and action == "command":
                cmd_body = self.body_json()
                name = str(cmd_body.get("name", ""))
                if name not in ("import", "recheck", "clear_cache", "logs", "diagnose", "detect", "restart_traefik",
                                "restart_agent", "update_agent"):
                    raise ValidationError("Lệnh không hợp lệ")
                if name in ("clear_cache", "logs", "restart_traefik", "restart_agent", "update_agent"):
                    app.need_admin(u)
                else:  # import = lay BMC dang chay tren Traefik ve web
                    app.need(u, "bmc_add" if name == "import" else "detect", key)
                cmd = {"name": name}
                if name == "detect":  # do loai BMC theo IP (agent o cung mang BMC)
                    ip = str(cmd_body.get("ip", "")).strip()
                    if not RE_IPHOST.match(ip):
                        raise ValidationError("IP / tên BMC không hợp lệ")
                    cmd.update(ip=ip, req=secrets.token_hex(6))
                if name == "update_agent":
                    info = agent_pkg_info()
                    if not info:
                        raise ValidationError("Web chưa có gói agent (cài web bằng gói bmc-gateway-web mới)")
                    cmd.update(sha256=info["sha256"], build=info["build"])
                if name == "diagnose":  # gui kem danh sach BMC hien tai tren web (ke ca BMC chua ap dung)
                    cmd["bmcs"] = [{k: b.get(k) for k in ("port", "upstream", "legacy_tls", "note", "enabled")}
                                   for b in st.desired(key)["bmcs"]
                                   if not cmd_body.get("port") or b["port"] == int(cmd_body["port"])]
                with st.lock:
                    app.commands.setdefault(key, []).append(cmd)
                st.audit(u["name"], f"command-{name}", "", key)
                return self.send(200, {"queued": True, "online": app.online(key), "req": cmd.get("req", "")})
            if method == "POST" and action == "install":
                app.need_admin(u)
                mode = "update" if self.body_json(1000).get("mode") == "update" else "install"
                code = secrets.token_urlsafe(24)
                with st.lock:
                    now = time.time()
                    for h in [h for h, v in app.install_codes.items() if v["exp"] < now - INSTALL_PKG_WINDOW]:
                        del app.install_codes[h]
                    app.install_codes[hash_token(code)] = {"site": key, "exp": now + INSTALL_TTL, "by": u["name"],
                                                           "used_at": None, "ip": None, "mode": mode}
                st.audit(u["name"], "site-install-code", ("tạo lệnh cập nhật agent" if mode == "update" else "tạo lệnh cài agent")
                         + " (1 lần, 1 giờ)", key)
                return self.send(200, {"code": code, "path": f"/install/{code}", "expires_in": INSTALL_TTL,
                                       "package": bool(self.agent_package()), "online": app.online(key)})
            if method == "GET" and action in ("logs", "diag", "action", "detect"):
                if action in ("logs", "action"):
                    app.need_admin(u)
                return self.send(200, (app.extra.get(key) or {}).get(action) or {})
            if method == "GET" and action == "history":
                state = st.state.get(key) or {}
                applied = (state.get("applied") or {}).get("rev")
                desired = st.desired(key)["rev"]
                rows = []
                for h in state.get("history") or []:
                    rel = st.load_release(key, h.get("rev"))
                    rows.append({**h, "bmcs": len(rel["bmcs"]) if rel else None, "available": bool(rel),
                                 "applied": h.get("rev") == applied, "desired": h.get("rev") == desired})
                return self.send(200, {"rows": rows, "applied": applied, "desired": desired})
            if method == "POST" and action == "rollback":
                app.need(u, "apply", key)
                rev = str(self.body_json().get("rev", ""))
                rel = st.load_release(key, rev)
                if not rel:
                    raise ValidationError("Không còn bản cấu hình này trên web")
                with st.lock:
                    snap = app.snapshot("rollback")
                    meta = {b["port"]: {k: b[k] for k in BMC_META if k in b} for b in st.bmcs if b["site"] == key}
                    restored = []
                    for b in rel["bmcs"]:
                        nb = {**b, "site": key}  # y nguyen ban cu -> cung ma rev
                        nb.update(meta.get(nb["port"], {}))
                        nb["updated_at"], nb["updated_by"] = now_iso(), u["name"]
                        restored.append(nb)
                    st.bmcs = [b for b in st.bmcs if b["site"] != key] + restored
                    st.save("bmc.json")
                st.audit(u["name"], "rollback", f"về bản {rev} ({len(restored)} BMC), sao lưu trước: {snap}", key)
                return self.send(200, {"ok": True, "bmcs": len(restored), "backup": snap})
            return self.err(404, "Không tìm thấy API")

        # ------------------------------------------------------------ lenh cai agent 1 dong
        @staticmethod
        def agent_package():
            try:
                pk = sorted(f for f in os.listdir(AGENT_PKG_DIR) if f.startswith("bmc-gateway-agent") and f.endswith(".zip"))
            except OSError:
                return None
            return os.path.join(AGENT_PKG_DIR, pk[-1]) if pk else None

        def install_get(self, code, want_pkg):
            ip = self.client_ip()
            rec = app.install_codes.get(hash_token(code))
            now = time.time()
            if want_pkg:
                if not rec or not rec["used_at"] or rec["ip"] != ip or now > rec["used_at"] + INSTALL_PKG_WINDOW:
                    return self.err(403, "Mã cài không hợp lệ / đã hết hạn")
                pkg = self.agent_package()
                if not pkg:
                    return self.err(404, "Web chưa có gói agent (cài web bằng gói bmc-gateway-web mới)")
                with open(pkg, "rb") as f:
                    return self.send(200, f.read(), "application/zip")
            ua = (self.headers.get("User-Agent") or "").lower()
            if not ua.startswith(("curl/", "wget/")):
                # xem truoc link (Zalo, WhatsApp, Telegram, trinh duyet...) khong duoc dung mat ma 1 lan
                body = "# Lenh cai / cap nhat agent: chay tren server bang curl, vd:\n#   curl -fsSk <link nay> | sudo bash\n"
                return self.send(200, body.encode(), "text/plain; charset=utf-8")
            if not rec or rec["used_at"] or now > rec["exp"]:
                body = "echo 'LOI: ma cai da dung hoac het han - tao lenh moi tren web: Site -> Cai agent' >&2; exit 1\n"
                return self.send(410, body.encode(), "text/x-shellscript; charset=utf-8")
            site = rec["site"]
            if site not in st.sites:
                return self.err(404, "Site đã bị xoá")
            if not self.agent_package():
                body = "echo 'LOI: web chua co goi agent (cai lai web bang goi bmc-gateway-web moi)' >&2; exit 1\n"
                return self.send(503, body.encode(), "text/x-shellscript; charset=utf-8")
            scheme = "https" if isinstance(self.connection, ssl.SSLSocket) else "http"
            host = re.sub(r"[^A-Za-z0-9.:\[\]-]", "", self.headers.get("Host") or "")
            web = f"{scheme}://{host}"
            if rec.get("mode") == "update":  # chi cap nhat code agent: giu token, agent.json, IP duoc phep
                with st.lock:
                    rec["used_at"], rec["ip"] = now, ip
                st.audit(rec["by"], "site-install", f"server {ip} chạy lệnh cập nhật agent", site)
                script = (UPDATE_SCRIPT.replace("__WEB__", web).replace("__CODE__", code).replace("__SITE__", site)
                          .replace("__NOW__", now_iso()))
                return self.send(200, script.encode("utf-8"), "text/x-shellscript; charset=utf-8")
            token = secrets.token_urlsafe(32)
            with st.lock:
                rec["used_at"], rec["ip"] = now, ip
                s = st.sites[site]
                s["token_hash"], s["token_hint"] = hash_token(token), token[-4:]
                added = ""
                if ip not in (s.get("allowed_ips") or []):
                    s["allowed_ips"] = (s.get("allowed_ips") or []) + [ip]
                    added = f", thêm IP {ip} vào IP được phép"
                st.save("sites.json")
            st.audit(rec["by"], "site-install", f"server {ip} chạy lệnh cài agent (token mới{added})", site)
            cfg = self.agent_config(site, token)
            cfg["controller_url"] = web
            script = (INSTALL_SCRIPT.replace("__WEB__", web).replace("__CODE__", code).replace("__SITE__", site)
                      .replace("__NOW__", now_iso()).replace("__AGENT_JSON__", json.dumps(cfg, indent=1)))
            return self.send(200, script.encode("utf-8"), "text/x-shellscript; charset=utf-8")

        @staticmethod
        def apply_site_fields(rec, data):
            if "label" in data:
                rec["label"] = clean_text(data["label"], 60) or rec["label"]
            if "domain" in data:
                d = str(data["domain"]).strip()
                if not RE_DOMAIN.match(d):
                    raise ValidationError("Tên miền không hợp lệ")
                rec["domain"] = d
            if not rec.get("domain"):
                raise ValidationError("Cần nhập tên miền của site")
            if "allowed_ips" in data:
                ips = [str(x).strip() for x in data["allowed_ips"] if str(x).strip()]
                for ip in ips:
                    if not RE_IP.match(ip):
                        raise ValidationError(f"IP '{ip}' không hợp lệ")
                rec["allowed_ips"] = ips
            if "overrides" in data:
                ov = {k: v for k, v in dict(data["overrides"]).items() if k in OVERRIDABLE}
                rec["overrides"] = validate_settings_values(ov, partial=True)

        def agent_config(self, key, token):
            host = self.headers.get("Host") or f"<ip-web>:{st.cfg['listen_port']}"
            scheme = "https" if isinstance(self.connection, ssl.SSLSocket) else "http"
            return {"site": key, "controller_url": f"{scheme}://{host}", "token": token,
                    "verify_tls": scheme == "https", "poll_interval": 10,
                    "traefik_static_file": "/etc/traefik/traefik.yml",
                    "traefik_dynamic_dir": "/etc/traefik/dynamic",
                    "traefik_restart_cmd": ["systemctl", "restart", "traefik"],
                    "traefik_api": "http://127.0.0.1:18080",
                    "nginx_conf_dir": "/etc/nginx/conf.d",
                    "nginx_test_cmd": ["nginx", "-t"],
                    "nginx_reload_cmd": ["systemctl", "reload", "nginx"]}

        # ------------------------------------------------------------ BMC
        def api_templates(self, method, key, action, u):
            if method == "GET" and key is None:
                return self.send(200, all_templates(st.templates))
            if method == "POST" and action == "apply":
                tpl = all_templates(st.templates).get(key)
                if not tpl:
                    return self.err(404, "Không có mẫu này")
                d = self.body_json()
                return self.send(200, apply_template(tpl, d.get("port"), d.get("ip"), d.get("console_port")))
            app.need_admin(u)
            if key in BUILTIN_TEMPLATES:
                raise ValidationError("Mẫu có sẵn không sửa được - hãy tạo mẫu mới với mã khác")
            if method == "PUT":
                t = validate_template(key, self.body_json())
                with st.lock:
                    st.templates[key] = t
                    st.save("templates.json")
                st.audit(u["name"], "template-save", f"{key} ({t['label']})")
                return self.send(200, t)
            if method == "DELETE":
                if any(b.get("template") == key for b in st.bmcs):
                    raise ValidationError("Mẫu đang được BMC dùng")
                with st.lock:
                    st.templates.pop(key, None)
                    st.save("templates.json")
                st.audit(u["name"], "template-delete", key)
                return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        def bulk_add(self, u, data):
            """Them / cap nhat nhieu BMC tu text dan vao. commit=False chi kiem tra."""
            rows = parse_rows(str(data.get("text", "")))
            if not rows:
                raise ValidationError("Chưa có dòng nào")
            if len(rows) > 2000:
                raise ValidationError("Tối đa 2000 dòng mỗi lần")
            update = bool(data.get("update_existing"))
            tpls = all_templates(st.templates)
            results, planned, seen = [], [], {}
            with st.lock:
                for line, row in rows:
                    r = {"line": line, "site": row.get("site", ""), "port": row.get("port", "")}
                    try:
                        raw = row_to_bmc(row, tpls)
                        if not app.can_view(u, raw["site"]):
                            raise PermissionError(f"Bạn không có quyền ở site {raw['site']}")
                        port = to_port(raw["port"], "Cổng")
                        cur = st.get_bmc(raw["site"], port)
                        if cur and not update:
                            raise ValidationError("BMC đã có (tick 'Cập nhật BMC đã có' để ghi đè)")
                        app.need(u, "bmc_edit" if cur else "bmc_add", raw["site"])
                        b = app.validate_bmc({**(cur or {}), **raw}, (raw["site"], port) if cur else None)
                        ports = bmc_ports(b)
                        for pt in ports:
                            other = seen.get((b["site"], pt))
                            if other:
                                raise ValidationError(f"trùng cổng {pt} với dòng {other}")
                        for pt in ports:
                            seen[(b["site"], pt)] = line
                        if cur:
                            for k in BMC_META[:3]:
                                if k in cur:
                                    b[k] = cur[k]
                        planned.append((cur, b))
                        r.update(ok=True, action="sửa" if cur else "thêm", upstream=b["upstream"],
                                 console_port=b["console_port"], template=b.get("template", ""))
                    except (ValidationError, PermissionError) as e:
                        r.update(ok=False, error=str(e))
                    results.append(r)
                errors = sum(1 for r in results if not r["ok"])
                saved = 0
                if data.get("commit") and not errors:
                    by_site = {}
                    for cur, b in planned:
                        b["updated_at"], b["updated_by"] = now_iso(), u["name"]
                        if cur:
                            st.bmcs = [b if bmc_key(x) == bmc_key(cur) else x for x in st.bmcs]
                        else:
                            st.bmcs.append(b)
                        saved += 1
                        by_site[b["site"]] = by_site.get(b["site"], 0) + 1
                    st.save("bmc.json")
                    for k, n in by_site.items():
                        st.audit(u["name"], "bmc-bulk", f"{n} BMC", k)
            return {"rows": results, "errors": errors, "saved": saved}

        def batch(self, u, data):
            keys = [(str(k.get("site")), to_port(k.get("port"), "Cổng")) for k in data.get("keys") or []]
            if not keys:
                raise ValidationError("Chưa chọn BMC nào")
            action = data.get("action")
            fields = {k: v for k, v in dict(data.get("fields") or {}).items()
                      if k in ("auth", "console_auth", "enabled", "legacy_tls", "jsesp_cache", "java_web", "max_conns",
                              "template", "tags", "expires", "host_header")}
            for site, _ in keys:
                app.need(u, "bmc_delete" if action == "delete" else "bmc_edit", site)
            wanted = set(keys)
            done = 0
            with st.lock:
                if action == "delete":
                    before = len(st.bmcs)
                    st.bmcs = [b for b in st.bmcs if bmc_key(b) not in wanted]
                    done = before - len(st.bmcs)
                elif action == "set":
                    if not fields:
                        raise ValidationError("Chưa chọn thay đổi")
                    new = []
                    for b in st.bmcs:
                        if bmc_key(b) in wanted:
                            nb = app.validate_bmc({**b, **fields}, bmc_key(b))
                            for k in BMC_META[:3]:
                                if k in b:
                                    nb[k] = b[k]
                            nb["updated_at"], nb["updated_by"] = now_iso(), u["name"]
                            new.append(nb)
                            done += 1
                        else:
                            new.append(b)
                    st.bmcs = new
                else:
                    raise ValidationError("Thao tác không hợp lệ")
                st.save("bmc.json")
            for site in sorted({k[0] for k in keys}):
                n = sum(1 for k in keys if k[0] == site)
                st.audit(u["name"], f"bmc-batch-{action}", f"{n} BMC {fields if action == 'set' else ''}".strip(), site)
            return {"ok": True, "changed": done}

        def api_bmcs(self, method, site, port, u, sub=None):
            if method == "GET" and site is None:
                return self.send(200, app.bmc_views(u))
            if method == "GET" and sub == "history":
                if not app.can_view(u, site):
                    raise PermissionError("Không có quyền xem site này")
                p = str(to_port(port, "Cổng"))
                pat = re.compile(r"(?<![0-9])" + p + r"(?![0-9])")
                rows = [a for a in st.read_audit(5000) if a.get("site") == site and
                        (a.get("action", "").startswith(("bmc-", "rollback")) or a.get("action") in ("import", "apply"))
                        and pat.search(str(a.get("detail", "")))][:60]
                return self.send(200, rows)
            if method == "GET" and site == "export":
                app.need(u, "export")
                only = (self.query.get("site") or [""])[0]
                rows = []
                for b in app.bmc_views(u):
                    if (only and b["site"] != only) or not app.can(u, "export", b["site"]):
                        continue
                    host = st.sites.get(b["site"], {}).get("domain", "")
                    if host:
                        b["link"] = f"https://{host}/" if b["port"] == 443 else f"https://{host}:{b['port']}/"
                        b["console_link"] = f"https://{host}:{b['console_port']}/" if b.get("console_port") else ""
                    rows.append(b)
                name = f"bmc-{only or 'all'}-{now_iso()[:10]}.csv"
                return self.send(200, export_csv(rows), "text/csv; charset=utf-8",
                                 headers={"Content-Disposition": f'attachment; filename="{name}"'})
            if method == "POST" and site == "bulk":
                return self.send(200, self.bulk_add(u, self.body_json()))
            if method == "POST" and site == "batch":
                return self.send(200, self.batch(u, self.body_json()))
            if method == "POST" and site is None:
                data = self.body_json()
                app.need(u, "bmc_add", str(data.get("site", "")))
                with st.lock:
                    b = app.validate_bmc(data)
                    b["updated_at"], b["updated_by"] = now_iso(), u["name"]
                    st.bmcs.append(b)
                    st.save("bmc.json")
                st.audit(u["name"], "bmc-add", f"{b['port']} -> {b['upstream']}", b["site"])
                return self.send(201, b)
            port = to_port(port, "Cổng")
            app.need(u, "bmc_delete" if method == "DELETE" else "bmc_edit", site)
            with st.lock:
                cur = st.get_bmc(site, port)
                if not cur:
                    return self.err(404, "Không có BMC này")
                if method == "PUT":
                    data = self.body_json()
                    new_site = str(data.get("site") or site)
                    if new_site != site:  # chuyen BMC sang site khac = them o site moi
                        app.need(u, "bmc_add", new_site)
                    b = app.validate_bmc({**cur, **data, "site": new_site}, (site, port))
                    for k in BMC_META[:3]:
                        if k in cur:
                            b[k] = cur[k]
                    if "template" not in data and cur.get("template"):
                        b["template"] = cur["template"]
                    b["updated_at"], b["updated_by"] = now_iso(), u["name"]
                    st.bmcs = [b if bmc_key(x) == (site, port) else x for x in st.bmcs]
                    st.save("bmc.json")
                    st.audit(u["name"], "bmc-edit", f"{port} -> {b['site']}:{b['port']} {b['upstream']}", site)
                    return self.send(200, b)
                if method == "DELETE":
                    st.bmcs = [x for x in st.bmcs if bmc_key(x) != (site, port)]
                    st.save("bmc.json")
                    st.audit(u["name"], "bmc-delete", f"{port} -> {cur['upstream']}", site)
                    return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        # ------------------------------------------------------------ nguoi dung
        def api_2fa(self, u):
            """Nguoi dung tu bat / tat xac thuc 2 lop."""
            data = self.body_json(10_000)
            rec = st.users[u["name"]]
            action = data.get("action")
            with st.lock:
                if action == "setup":
                    rec["totp_pending"] = totp_new_secret()
                    st.save("users.json")
                    return self.send(200, {"secret": rec["totp_pending"], "uri": totp_uri(rec["totp_pending"], u["name"])})
                if action == "enable":
                    if not rec.get("totp_pending"):
                        raise ValidationError("Bấm Bật 2FA lại để lấy mã mới")
                    if not totp_check(rec["totp_pending"], data.get("code")):
                        raise ValidationError("Mã 6 số không đúng (kiểm tra giờ trên điện thoại)")
                    rec["totp_secret"] = rec.pop("totp_pending")
                    st.save("users.json")
                    st.audit(u["name"], "2fa-on")
                    return self.send(200, {"ok": True})
                if action == "disable":
                    pw = str(data.get("password", ""))
                    ok = check_password(rec, pw)
                    if rec.get("source") == "ldap":
                        try:
                            ok = gw_ldap.authenticate(st.auth.get("ldap") or {}, u["name"], pw)["name"] == u["name"]
                        except gw_ldap.LdapError:
                            ok = False
                    if not ok:
                        raise ValidationError("Mật khẩu không đúng")
                    rec.pop("totp_secret", None)
                    rec.pop("totp_pending", None)
                    st.save("users.json")
                    st.audit(u["name"], "2fa-off")
                    return self.send(200, {"ok": True})
            raise ValidationError("Thao tác không hợp lệ")

        @staticmethod
        def user_view(n, r):
            exp = r.get("expires") or ""
            status = ("disabled" if r.get("disabled") else
                      "expired" if exp and exp < dt.date.today().isoformat() else "active")
            return {"name": n, "role": r.get("role"), "sites": r.get("sites") or [],
                    "perms": user_perms(r), "perms_custom": isinstance(r.get("perms"), list) and r.get("role") in ("operator", "viewer"),
                    "full_name": r.get("full_name", ""), "email": r.get("email", ""), "note": r.get("note", ""),
                    "disabled": bool(r.get("disabled")), "expires": exp, "status": status,
                    "must_change": bool(r.get("must_change")), "totp": bool(r.get("totp_secret")),
                    "last_login": r.get("last_login"), "created_at": r.get("created_at", ""),
                    "created_by": r.get("created_by", ""), "password_changed": r.get("password_changed", ""),
                    "source": r.get("source", "local"), "ldap_groups": r.get("ldap_groups") or [],
                    "bmc_tags": r.get("bmc_tags") or [], "bmc_list": r.get("bmc_list") or [],
                    "sessions": app.user_sessions(n)}

        @staticmethod
        def profile_fields(data, name, me):
            out = {"full_name": clean_text(data.get("full_name", ""), 80),
                   "email": clean_text(data.get("email", ""), 120), "note": clean_text(data.get("note", ""), 200)}
            exp = str(data.get("expires") or "").strip()
            if exp and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", exp):
                raise ValidationError("Ngày hết hạn dạng YYYY-MM-DD")
            out["expires"] = exp
            out["disabled"] = str(data.get("disabled", "")).lower() in ("1", "true", "on", "yes")
            if name == me and (out["disabled"] or (exp and exp < dt.date.today().isoformat())):
                raise ValidationError("Không thể tự khoá / cho hết hạn tài khoản của mình")
            return out

        def api_users(self, method, name, u, sub=None):
            app.need_admin(u)
            if method == "GET" and name is None:
                return self.send(200, [self.user_view(n, r) for n, r in sorted(st.users.items())])
            if name is not None and name not in st.users:
                return self.err(404, "Không có tài khoản này")
            if sub == "history" and method == "GET":
                rows = [a for a in st.read_audit(3000) if a.get("user") == name
                        and a.get("action") in ("login", "login-fail", "password", "2fa-on", "2fa-off")][:60]
                return self.send(200, rows)
            if sub == "logout" and method == "POST":
                n = len(app.user_sessions(name))
                app.drop_user_sessions(name)
                st.audit(u["name"], "user-logout", f"{name} ({n} phiên)")
                return self.send(200, {"ok": True, "dropped": n})
            data = self.body_json(10_000) if method in ("POST", "PUT") else {}
            if method == "POST" and name is None:
                name = str(data.get("name", "")).strip()
                if not RE_USER.match(name):
                    raise ValidationError("Tên chỉ gồm chữ, số, . _ - (tối đa 32)")
                if name in st.users:
                    raise ValidationError("Tài khoản đã tồn tại")
                is_ad = str(data.get("source", "")) == "ldap"
                pw = str(data.get("password", ""))
                if is_ad:
                    name = name.lower()
                    if name in st.users:
                        raise ValidationError("Tài khoản đã tồn tại")
                elif len(pw) < 10:
                    raise ValidationError("Mật khẩu tối thiểu 10 ký tự")
                rec = {**({"source": "ldap"} if is_ad else hash_password(pw)), **self.role_fields(data),
                       **self.profile_fields(data, name, u["name"]), "created_at": now_iso(), "created_by": u["name"]}
                if not is_ad and str(data.get("must_change", "1")).lower() in ("1", "true", "on", "yes"):
                    rec["must_change"] = True
                if rec["perms"] is None:
                    del rec["perms"]
                with st.lock:
                    st.users[name] = rec
                    st.save("users.json")
                st.audit(u["name"], "user-add", f"{name} ({rec['role']})")
                return self.send(201, {"ok": True})
            if method == "PUT":
                fields = self.role_fields(data)
                if name == u["name"] and fields["role"] != "admin":
                    raise ValidationError("Không thể tự bỏ quyền quản trị của mình")
                prof = self.profile_fields(data, name, u["name"])
                notes = []
                with st.lock:
                    rec = st.users[name]
                    if "perms" not in data and rec.get("role") == fields["role"]:  # form cu khong gui quyen -> giu
                        fields["perms"] = rec.get("perms")
                    rec.update(fields)
                    if rec.get("perms") is None:
                        rec.pop("perms", None)
                    rec.update({k: v for k, v in prof.items() if k in data})  # chi doi o co gui len
                    if data.get("password"):
                        if rec.get("source") == "ldap":
                            raise ValidationError("Tài khoản AD: mật khẩu đặt lại trên AD, không đặt trên web")
                        if len(str(data["password"])) < 10:
                            raise ValidationError("Mật khẩu tối thiểu 10 ký tự")
                        rec.update(hash_password(str(data["password"])))
                        rec["password_changed"] = now_iso()
                        if str(data.get("must_change", "1")).lower() in ("1", "true", "on", "yes"):
                            rec["must_change"] = True
                        notes.append("đặt lại mật khẩu")
                        app.drop_user_sessions(name)
                    if str(data.get("reset_2fa", "")).lower() in ("1", "true", "on", "yes") and rec.get("totp_secret"):
                        rec.pop("totp_secret", None)
                        rec.pop("totp_pending", None)
                        notes.append("tắt 2FA")
                    if prof["disabled"] and "disabled" in data:
                        app.drop_user_sessions(name)
                        notes.append("khoá")
                    st.save("users.json")
                st.audit(u["name"], "user-edit", f"{name} ({fields['role']}" + (", " + ", ".join(notes) if notes else "") + ")")
                return self.send(200, {"ok": True})
            if method == "DELETE":
                if name == u["name"]:
                    raise ValidationError("Không thể tự xoá tài khoản của mình")
                with st.lock:
                    del st.users[name]
                    st.save("users.json")
                app.drop_user_sessions(name)
                st.audit(u["name"], "user-delete", name)
                return self.send(200, {"ok": True})
            return self.err(404, "Không tìm thấy API")

        @staticmethod
        def role_fields(data):
            role = data.get("role", "viewer")
            if role not in ROLES:
                raise ValidationError("Vai trò không hợp lệ")
            sites = [s for s in (data.get("sites") or []) if s in st.sites]
            if role != "customer":
                out = {"role": role, "sites": [] if role == "admin" else sites, "bmc_tags": [], "bmc_list": [], "perms": None}
                if role in ("operator", "viewer") and isinstance(data.get("perms"), list):
                    perms = [p for p in PERMS if p in data["perms"]]
                    if perms != list(ROLE_PERMS[role]):  # trung mac dinh -> khong luu (doi theo vai tro ve sau)
                        out["perms"] = perms
                return out
            tags = parse_tags(data.get("bmc_tags") or "")
            raw = data.get("bmc_list") or ""
            items = [x.strip() for x in (re.split(r"[\s,;]+", raw) if isinstance(raw, str) else raw) if str(x).strip()]
            bmc_list = []
            for x in items:
                m = re.fullmatch(r"([a-z0-9-]{1,40}):(\d{1,5})", str(x))
                if not m or not st.get_bmc(m.group(1), int(m.group(2))):
                    raise ValidationError(f"BMC '{x}' không có (dạng site:cổng, vd hcm:8001)")
                bmc_list.append(f"{m.group(1)}:{int(m.group(2))}")
            if not tags and not bmc_list:
                raise ValidationError("Khách hàng: nhập nhãn BMC (vd KH-ABC) hoặc danh sách BMC (site:cổng)")
            return {"role": role, "sites": [], "bmc_tags": tags, "bmc_list": bmc_list, "perms": None}

        # ------------------------------------------------------------ tong hop
        def overview(self, u):
            sites = [app.site_status(k) for k in app.visible_sites(u)]
            views = [v for v in app.bmc_views(u) if v["enabled"]]
            auth = {"ok": 0, "deny": 0, "error": 0}
            denied = []
            for v in views:
                s = v["auth_stats"] or {}
                for k in auth:
                    auth[k] += s.get(k, 0)
                if s.get("deny"):
                    denied.append({"site": v["site"], "port": v["port"], "note": v["note"],
                                   "deny": s["deny"]})
            down = [{"site": v["site"], "port": v["port"], "upstream": v["upstream"], "note": v["note"]}
                    for v in views if (v["health"] or {}).get("web", {}).get("up") is False]
            return {
                "sites": sites, "bmcs": len(views),
                "checked": sum(1 for v in views if v["health"]), "down": down,
                "open": sum(1 for v in views if not v["auth"] or (v["console_port"] and not v["console_auth"])),
                "auth": auth, "top_denied": sorted(denied, key=lambda x: -x["deny"])[:6],
                "cert": cert_info(st.settings["cert_file"]), "started": app.started,
            }

        def warnings(self, u):
            w = []
            if st.db and st.db_error and u["role"] == "admin":
                w.append({"level": "danger", "site": "",
                          "text": f"Mất kết nối cơ sở dữ liệu {st.db.describe()}: {st.db_error[:160]}"})
            dbc = st.cfg.get("db") or {}
            if (st.db and dbc.get("type") == "mysql" and not dbc.get("ssl") and u["role"] == "admin"
                    and dbc.get("host") not in ("127.0.0.1", "localhost", "::1")):
                w.append({"level": "warn", "site": "",
                          "text": "Kết nối MySQL chưa mã hoá (mật khẩu, dữ liệu đi qua mạng dạng rõ). "
                                  "Chạy lại: sudo bash install.sh db"})
            for k in app.visible_sites(u):
                s = app.site_status(k)
                m = app.maint_active(k)
                if m:
                    w.append({"level": "info", "site": k, "text": f"Đang bảo trì đến {m['end'].replace('T', ' ')}"
                              + (f" · {m['note']}" if m.get("note") else "") + " (không gửi cảnh báo)"})
                if not s["token_set"]:
                    w.append({"level": "warn", "site": k, "text": "Chưa tạo token cho agent"})
                elif not s["online"]:
                    w.append({"level": "danger", "site": k,
                              "text": "Agent mất liên lạc" + (f" từ {s['last_seen']}" if s["last_seen"] else " (chưa từng kết nối)")})
                if s["phase"] == "failed":
                    w.append({"level": "danger", "site": k, "text": "Lần áp dụng gần nhất bị lỗi, đã khôi phục"})
                if s["online"] and s["target"] and not s["traefik"]["reachable"]:
                    w.append({"level": "danger", "site": k,
                              "text": "Traefik không chạy hoặc API Traefik không phản hồi"})
                if s["traefik"]["errors"]:
                    w.append({"level": "danger", "site": k, "text": f"{s['traefik']['errors']} router Traefik lỗi"})
                for x in s["warnings"]:
                    w.append({**x, "site": k})
            for b in st.bmcs:
                if not app.can_view(u, b["site"]) or not b.get("enabled", True):
                    continue
                if not b["auth"]:
                    w.append({"level": "danger", "site": b["site"], "text": f"Cổng {b['port']} không có xác thực"})
                if b.get("console_port") and not b["console_auth"]:
                    w.append({"level": "danger", "site": b["site"],
                              "text": f"Console {b['console_port']} (BMC {b['port']}) không có xác thực"})
                exp = b.get("expires") or ""
                if exp and b.get("enabled", True):
                    days = (dt.date.fromisoformat(exp) - dt.date.today()).days if re.fullmatch(r"\d{4}-\d{2}-\d{2}", exp) else 99
                    if days < 0:
                        w.append({"level": "warn", "site": b["site"],
                                  "text": f"BMC {b['port']} hết hạn sử dụng {exp} - sẽ tắt ở lần Áp dụng"})
                    elif days <= 7:
                        w.append({"level": "info", "site": b["site"],
                                  "text": f"BMC {b['port']} hết hạn sau {days} ngày ({exp})"})
                if b.get("tcp_ports") and not b.get("tcp_allow_ips"):
                    ports_str = ", ".join(str(t["proxy"] if isinstance(t, dict) else t) for t in b["tcp_ports"])
                    w.append({"level": "danger", "site": b["site"],
                              "text": f"Console Java của BMC {b['port']} mở TCP cho mọi IP "
                                      f"({ports_str}) - hãy khai IP được phép"})
            order = {"danger": 0, "warn": 1, "info": 2}
            return sorted(w, key=lambda x: order.get(x["level"], 3))

    return Handler


def serve(store):
    if not store.users:
        sys.exit("Chưa có tài khoản. Chạy: python3 bmcproxy.py adduser admin")
    cfg = store.cfg
    app = App(store)
    app.notifier.start()
    httpd = ThreadingServer((cfg["listen_host"], cfg["listen_port"]), make_handler(app))
    httpd.ssl_ctx = None
    scheme = "http"
    if cfg.get("tls_cert"):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cfg["tls_cert"], cfg["tls_key"])
        httpd.ssl_ctx = ctx  # bat tay TLS lam trong Handler.setup (moi ket noi 1 luong)
        scheme = "https"
    if DEV:
        print("DEV: sửa file web -> trình duyệt tự tải lại; sửa .py -> server tự khởi động lại", flush=True)
    print(f"bmcproxy controller {VERSION}: {scheme}://{cfg['listen_host']}:{cfg['listen_port']}/"
          + (f" | dữ liệu: {store.db.describe()}" if store.db else " | dữ liệu: file JSON"), flush=True)
    httpd.serve_forever()
