"""Lop bao ve truoc BMC (chay trong agent, cung buoc forwardAuth cua Traefik):

- WAF: bo luat dung san kieu ModSecurity CRS (rut gon) - path traversal, LFI, SQLi, XSS, chen lenh, Shellshock,
  duong dan do quet (wp-admin, .env, phpMyAdmin...), cong cu quet (sqlmap, nikto, nmap...). Che do: tat / chi ghi / chan.
- Quoc gia: chi cho phep / chan cac nuoc da chon (web gui xuong cac dai IP theo GeoIP). IP noi bo luon duoc vao.
- Chong do mat khau: dem POST vao trang dang nhap BMC (iDRAC, iLO, AMI, Supermicro, XCC, Redfish...) theo IP;
  qua nguong trong khung thoi gian -> tu chan IP mot thoi gian, bao ve web tao quy tac chan (go duoc).
"""

import bisect
import collections
import hashlib
import ipaddress
import json
import re
import threading
import time
import urllib.parse

WAF_RULES = [
    # (ma, ten, noi kiem tra, bieu thuc) - kiem tra tren URI da giai ma 2 lan (chu thuong)
    ("traversal", "Path traversal (../)", "uri", r"(\.\./|\.\.\\|/\.\.;)"),
    ("lfi", "Đọc file hệ thống (/etc/passwd...)", "uri", r"(/etc/(passwd|shadow|hosts)|/proc/self/|win\.ini|boot\.ini|c:\\windows)"),
    ("sqli", "SQL injection", "uri",
     r"(union(\s|/\*.*?\*/)+(all(\s)+)?select|select.{1,80}from.{1,40}information_schema|\b(sleep|benchmark|pg_sleep)\s*\(|"
     r"'\s*(or|and)\s+'?\d+'?\s*=\s*'?\d|;\s*(drop|insert|update|delete)\s+|xp_cmdshell|load_file\s*\()"),
    ("xss", "XSS (<script>, javascript:)", "uri", r"(<\s*script|<\s*/\s*script|javascript\s*:|<\s*(img|svg|iframe|body)[^>]{0,80}\son\w+\s*=|document\.cookie)"),
    ("cmd", "Chèn lệnh hệ thống", "uri",
     r"((;|\||`|\$\(|&&)\s*(wget|curl|bash|sh|nc|ncat|python\d?|perl|php|chmod|rm\s+-|cat\s+/|busybox|tftp)\b)"),
    ("shellshock", "Shellshock (() {)", "any", r"\(\s*\)\s*\{"),
    ("scanpath", "Đường dẫn dò quét (wp-admin, .env, phpMyAdmin...)", "uri",
     r"^/(wp-(admin|login|content|includes)|xmlrpc\.php|phpmyadmin|pma/|myadmin|\.env|\.git/|\.svn/|\.aws/|\.ds_store|"
     r"vendor/phpunit|actuator/|boaform/|hnap1|owa/|autodiscover/|solr/|jenkins/|manager/html|druid/|telescope/|"
     r"\.well-known/security|config\.(php|json|yml)|server-status|_ignition/|cgi-bin/(luci|php|test-cgi))"),
    ("scanner", "Công cụ quét (sqlmap, nikto, nmap...)", "ua",
     r"(sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|feroxbuster|ffuf|wpscan|acunetix|nessus|openvas|"
     r"hydra|medusa|jaeles|whatweb|wfuzz|netsparker|appscan|burpcollaborator|interactsh|censysinspect|zmap)"),
]
_WAF = [(rid, label, where, re.compile(rx, re.I | re.S)) for rid, label, where, rx in WAF_RULES]
WAF_LABEL = {rid: label for rid, label, _, _ in WAF_RULES}

# POST dang nhap BMC: iDRAC /data/login, /sysmgmt/.../session; iLO /json/login_session; AMI /rpc/WEBSES/create.asp, /api/session;
# Supermicro /cgi/login.cgi; Lenovo XCC /api/login; Redfish /redfish/v1/SessionService/Sessions; trang khac co chu login / logon / auth
LOGIN_RE = re.compile(r"(/data/login|/sysmgmt/\d+/bmc/session|/json/login_session|/rpc/webses/create\.asp|/api/session|"
                      r"/cgi/login\.cgi|/api/login|/redfish/v1/sessionservice/sessions|login|logon|signin)", re.I)

SECURITY_DEFAULTS = {
    "geo": {"mode": "any", "countries": []},          # any / allow (chi cac nuoc nay) / deny (chan cac nuoc nay)
    "brute": {"enabled": True, "limit": 10, "window": 600, "ban": 3600},   # 10 lan dang nhap / 10 phut -> chan 1 gio
    "waf": {"mode": "block", "scanner": True},        # off / log / block
}


def _key(addr):
    return int(addr) if addr.version == 4 else int(addr) >> 64


def _decode(uri):
    s = uri or ""
    for _ in range(2):
        t = urllib.parse.unquote_plus(s)
        if t == s:
            break
        s = t
    return s.lower()


class Shield:
    def __init__(self):
        self.lock = threading.Lock()
        self.cfg = json.loads(json.dumps(SECURITY_DEFAULTS))
        self.rev = ""
        self.geo4, self.geo6 = ([], []), ([], [])
        self.logins = {}          # ip -> deque(thoi diem POST dang nhap)
        self.bans = {}            # ip -> (het han, ly do)
        self.events = []          # tu chan chua bao ve web

    # ------------------------------------------------------------ cau hinh (web gui xuong)
    def set_config(self, data):
        if not isinstance(data, dict):
            return
        cfg = json.loads(json.dumps(SECURITY_DEFAULTS))
        for part in ("geo", "brute", "waf"):
            if isinstance(data.get(part), dict):
                cfg[part].update({k: v for k, v in data[part].items() if k in cfg[part]})
        g4, g6 = ([], []), ([], [])
        geo = data.get("geo") or {}
        for src, dst in ((geo.get("v4") or [], g4), (geo.get("v6") or [], g6)):
            for a, b in sorted((int(x[0]), int(x[1])) for x in src if isinstance(x, (list, tuple)) and len(x) == 2):
                dst[0].append(a)
                dst[1].append(b)
        with self.lock:
            self.cfg, self.geo4, self.geo6 = cfg, g4, g6
            self.rev = str(data.get("rev", ""))

    def status(self):
        with self.lock:
            now = time.time()
            return {"rev": self.rev, "bans": {ip: int(u - now) for ip, (u, _) in self.bans.items() if u > now}}

    # ------------------------------------------------------------ kiem tra 1 request
    def _in_geo(self, addr):
        starts, ends = self.geo4 if addr.version == 4 else self.geo6
        n = _key(addr)
        i = bisect.bisect_right(starts, n) - 1
        return i >= 0 and n <= ends[i]

    def inspect(self, port, ip, uri, method="GET", ua="", extra=""):
        """Tra ve None (cho qua) hoac (ly do, chi tiet, chan that?): waf / waf-log / geo / bruteforce."""
        with self.lock:
            cfg = self.cfg
        now = time.time()
        try:
            addr = ipaddress.ip_address((ip or "").strip())
        except ValueError:
            addr = None
        local = bool(addr and (addr.is_private or addr.is_loopback or addr.is_link_local))
        # 1. IP dang bi tu chan (do mat khau)
        with self.lock:
            ban = self.bans.get(ip)
            if ban and ban[0] <= now:
                del self.bans[ip]
                ban = None
        if ban:
            return "bruteforce", ban[1], True
        # 2. WAF
        mode = cfg["waf"].get("mode", "block")
        if mode in ("log", "block"):
            path = _decode(uri)
            for rid, _, where, rx in _WAF:
                if rid == "scanner" and not cfg["waf"].get("scanner", True):
                    continue
                hay = path if where == "uri" else (ua or "") if where == "ua" else f"{path}\n{ua}\n{extra}"
                if hay and rx.search(hay):
                    return ("waf" if mode == "block" else "waf-log"), rid, mode == "block"
        # 3. Quoc gia (IP noi bo luon duoc vao)
        gmode = cfg["geo"].get("mode", "any")
        if gmode in ("allow", "deny") and addr and not local:
            inside = self._in_geo(addr)
            if (gmode == "allow" and not inside) or (gmode == "deny" and inside):
                return "geo", ",".join(cfg["geo"].get("countries") or []), True
        # 4. Dem dang nhap BMC
        br = cfg["brute"]
        if br.get("enabled") and (method or "").upper() == "POST" and LOGIN_RE.search((uri or "").split("?", 1)[0]):
            window, limit = max(60, int(br.get("window") or 600)), max(3, int(br.get("limit") or 10))
            with self.lock:
                q = self.logins.setdefault(ip, collections.deque())
                q.append(now)
                while q and q[0] < now - window:
                    q.popleft()
                if len(self.logins) > 20000:
                    self.logins = {k: v for k, v in self.logins.items() if v and v[-1] > now - window}
                if len(q) > limit:
                    until = now + max(60, int(br.get("ban") or 3600))
                    detail = f"{len(q)} lần đăng nhập / {window // 60} phút (BMC {port})"
                    self.bans[ip] = (until, detail)
                    q.clear()
                    self.events.append({"ip": ip, "port": port, "count": limit + 1, "window": window,
                                        "until": until, "detail": detail})
                    del self.events[:-200]
                    return "bruteforce", detail, True
        return None

    def pop_events(self):
        with self.lock:
            out, self.events = self.events, []
        return out

    def requeue_events(self, items):
        with self.lock:
            self.events = (items + self.events)[-200:]


def security_rev(cfg, geo_ranges_id=""):
    """Ma phien ban cau hinh bao ve (agent chi tai lai khi doi)."""
    raw = json.dumps({k: cfg.get(k) for k in ("geo", "brute", "waf")}, sort_keys=True) + "|" + geo_ranges_id
    return hashlib.sha256(raw.encode()).hexdigest()[:12]
