"""Test tinh nang: canh bao, link khach, nhat ky truy cap BMC, cap nhat agent tu web.

python -m unittest discover -s tests -v   (trong thu muc bmcproxy/; can chay tools/build_packages.py truoc
de co goi agent cho test cap nhat agent)
"""
import http.client
import http.server
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.parse
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for d in ("agent", "controller", "common"):
    sys.path.insert(0, os.path.join(ROOT, d))
# Windows: console cp1252 khong in duoc tieng Viet -> serve() chet ngay luc in dong khoi dong
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def req(port, method, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    h = {"Content-Type": "application/json", "X-Requested-With": "bmcproxy", **(headers or {})}
    c.request(method, path, json.dumps(body) if isinstance(body, (dict, list)) else body, h)
    r = c.getresponse()
    raw = r.read()
    c.close()
    try:
        data = json.loads(raw)
    except ValueError:
        data = raw
    return r.status, dict(r.getheaders()), data


# ====================================================================== canh bao
class FakeTelegram(http.server.BaseHTTPRequestHandler):
    got = []

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = urllib.parse.parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode())
        FakeTelegram.got.append({"path": self.path, "chat_id": body["chat_id"][0], "text": body["text"][0]})
        out = json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


class NotifyTest(unittest.TestCase):
    def setUp(self):
        import gw_notify
        self.N = gw_notify
        self.port = free_port()
        self.srv = http.server.ThreadingHTTPServer(("127.0.0.1", self.port), FakeTelegram)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        FakeTelegram.got.clear()
        self.cfg = gw_notify.validate({"telegram": {"enabled": True, "bot_token": "123456:" + "A" * 30, "chat_id": "-100123"},
                                       "bmc_down_minutes": 1})
        self.cfg["telegram"]["api"] = f"http://127.0.0.1:{self.port}"

    def tearDown(self):
        self.srv.shutdown()

    def wait_msgs(self, n):
        for _ in range(50):
            if len(FakeTelegram.got) >= n:
                return
            time.sleep(0.1)

    def test_transitions(self):
        snap = {"sites": [{"key": "hcm", "label": "HCM", "token_set": True, "seen": True, "online": True, "hostname": "h",
                           "bmcs": [{"port": 8001, "note": "KH1", "upstream": "https://10.0.0.5", "down": False, "error": ""}]}],
                "expiring": []}
        n = self.N.Notifier(lambda: self.cfg, lambda: snap)
        n.start()
        self.assertEqual(n.check(now=1000), [])              # lan dau: chi ghi nhan
        snap["sites"][0]["online"] = False
        ev = n.check(now=1060)
        self.assertEqual([e[0] for e in ev], ["site_offline"])
        self.assertEqual(n.check(now=1120), [])              # van mat: khong bao lai
        snap["sites"][0]["online"] = True
        snap["sites"][0]["bmcs"][0]["down"] = True
        ev = n.check(now=1180)
        self.assertEqual([e[0] for e in ev], ["site_offline"])  # site co lai; BMC chua du 1 phut
        self.assertIn("kết nối lại", ev[0][1])
        ev = n.check(now=1250)
        self.assertEqual([e[0] for e in ev], ["bmc_down"])
        self.wait_msgs(3)
        self.assertEqual(len(FakeTelegram.got), 3)
        self.assertEqual(FakeTelegram.got[0]["chat_id"], "-100123")
        self.assertIn("mất liên lạc", FakeTelegram.got[0]["text"])
        self.assertIn("cổng 8001", FakeTelegram.got[2]["text"])
        self.assertTrue(all(x["result"].get("telegram") == "ok" for x in n.sent))

    def test_maint_suppresses(self):
        snap = {"sites": [{"key": "hcm", "label": "HCM", "token_set": True, "seen": True, "online": True, "maint": False,
                           "hostname": "h", "bmcs": []}], "expiring": []}
        n = self.N.Notifier(lambda: self.cfg, lambda: snap)
        n.check(now=1000)
        snap["sites"][0].update(online=False, maint=True)
        self.assertEqual(n.check(now=1060), [])          # mat lien lac trong luc bao tri: khong bao
        snap["sites"][0]["maint"] = False
        self.assertEqual([e[0] for e in n.check(now=1120)], ["site_offline"])  # het bao tri ma van mat -> bao

    def test_validate_and_hide_secret(self):
        with self.assertRaises(Exception):
            self.N.validate({"telegram": {"enabled": True, "bot_token": "sai", "chat_id": "1"}})
        v = self.N.public_view(self.cfg)
        self.assertNotIn("bot_token", v["telegram"])
        self.assertTrue(v["telegram"]["has_bot_token"])
        kept = self.N.validate({"telegram": {"enabled": True, "chat_id": "-100999"}}, self.cfg)  # o token trong = giu
        self.assertEqual(kept["telegram"]["bot_token"], self.cfg["telegram"]["bot_token"])


# ====================================================================== ap dung: cong bi chiem
class SkipBusyPortTest(unittest.TestCase):
    def test_skip_bmc_with_busy_port(self):
        import gw_agent
        from gw_common import hash_password
        from gw_controller import Store, load_controller_config
        tmp = tempfile.mkdtemp(prefix="bmcproxy-busy-")
        busy = socket.socket()
        busy.bind(("0.0.0.0", 0))
        busy.listen(1)
        bport = busy.getsockname()[1]          # "chuong trinh khac" dang giu cong nay
        try:
            cfgp = os.path.join(tmp, "config.json")
            with open(cfgp, "w") as f:
                json.dump({"data_dir": os.path.join(tmp, "data"), "backup_dir": os.path.join(tmp, "bk")}, f)
            st = Store(load_controller_config(cfgp))
            st.sites["hcm"] = {"key": "hcm", "label": "HCM", "domain": "p.example.net", "overrides": {}}
            from gw_common import BMC_DEFAULTS
            free1, free2 = free_port(), free_port()
            st.bmcs += [{**BMC_DEFAULTS, "site": "hcm", "port": free1, "upstream": "https://10.0.0.5"},
                        {**BMC_DEFAULTS, "site": "hcm", "port": free2, "upstream": "https://10.0.0.6",
                         "console_port": bport, "console_upstream": "https://10.0.0.6:5900"}]
            rel = st.desired("hcm")
            cfg = {**gw_agent.AGENT_DEFAULTS, "site": "hcm", "data_dir": os.path.join(tmp, "agent"),
                   "traefik_static_file": os.path.join(tmp, "tr", "traefik.yml"),
                   "traefik_dynamic_dir": os.path.join(tmp, "tr", "dyn"),
                   "traefik_restart_cmd": [sys.executable, "-c", "print('restart')"], "traefik_stop_cmd": [],
                   "nginx_conf_dir": os.path.join(tmp, "nginx"), "nginx_test_cmd": [], "nginx_reload_cmd": [],
                   "port_owner_cmd": []}
            os.makedirs(cfg["data_dir"])
            a = gw_agent.Agent(cfg)
            a.verify = lambda r, restarted: (True, "ok")
            res = a.apply_release(rel)
            self.assertTrue(res["ok"], res["log"])
            self.assertEqual([x["port"] for x in res["skipped"]], [free2])
            self.assertEqual(res["skipped"][0]["busy"], [bport])
            self.assertEqual([b["port"] for b in a.release["bmcs"]], [free1])     # BMC con lai van chay
            static = open(cfg["traefik_static_file"], encoding="utf-8").read()
            self.assertIn(f":{free1}", static)
            self.assertNotIn(f":{bport}", static)
            self.assertTrue(any(w["text"].startswith(f"BMC {free2} chưa chạy") for w in a.local_warnings()))
            # giai phong cong -> Thu lai: BMC vao lai
            busy.close()
            res = a.apply_release(rel)
            self.assertTrue(res["ok"], res["log"])
            self.assertEqual(res["skipped"], [])
            self.assertIn(f":{bport}", open(cfg["traefik_static_file"], encoding="utf-8").read())
            # tat che do bo qua -> huy ca lan nhu ban cu
            busy2 = socket.socket()
            busy2.bind(("0.0.0.0", 0))
            busy2.listen(1)
            st.bmcs.append({**BMC_DEFAULTS, "site": "hcm", "port": busy2.getsockname()[1], "upstream": "https://10.0.0.7"})
            a.cfg["skip_busy_ports"] = False
            res = a.apply_release(st.desired("hcm"))
            busy2.close()
            self.assertFalse(res["ok"])
        finally:
            try:
                busy.close()
            except OSError:
                pass
            shutil.rmtree(tmp, ignore_errors=True)


# ====================================================================== web that + agent
class SiteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from gw_common import hash_password
        from gw_controller import Store, load_controller_config, serve
        cls.tmp = tempfile.mkdtemp(prefix="bmcproxy-feat-")
        cls.port = free_port()
        cfgp = os.path.join(cls.tmp, "config.json")
        with open(cfgp, "w") as f:
            json.dump({"listen_host": "127.0.0.1", "listen_port": cls.port, "data_dir": os.path.join(cls.tmp, "data"),
                       "backup_dir": os.path.join(cls.tmp, "bk")}, f)
        cls.st = Store(load_controller_config(cfgp))
        pw = "T-" + secrets.token_hex(8)
        cls.st.users["admin"] = {**hash_password(pw), "role": "admin", "sites": []}
        cls.st.save("users.json")
        threading.Thread(target=serve, args=(cls.st,), daemon=True).start()
        for _ in range(50):
            try:
                socket.create_connection(("127.0.0.1", cls.port), 0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        s, h, _ = req(cls.port, "POST", "/api/login", {"user": "admin", "password": pw})
        cls.ck = {"Cookie": h["Set-Cookie"].split(";")[0]}
        req(cls.port, "POST", "/api/sites", {"key": "hcm", "label": "HCM", "domain": "proxy-hcm.example.net",
                                              "allowed_ips": ["127.0.0.1"]}, cls.ck)
        cls.token = req(cls.port, "POST", "/api/sites/hcm/token", None, cls.ck)[2]["token"]
        req(cls.port, "POST", "/api/bmcs", {"site": "hcm", "port": 8001, "upstream": "https://10.0.0.5",
                                             "template": "idrac9", "note": "KH 1"}, cls.ck)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def sync(self, extra=None):
        hb = {"site": "hcm", "version": "2.0.0", "build": "x", "hostname": "srv", "time": "2026-10-21T10:00:00", **(extra or {})}
        return req(self.port, "POST", "/agent/v1/sync", hb,
                    {"Authorization": f"Bearer {self.token}", "X-Agent-Site": "hcm"})

    def test_guest_link_and_access_log(self):
        from gw_auth import AuthGateway, start_auth_server
        s, _, g = req(self.port, "POST", "/api/guests", {"site": "hcm", "port": 8001, "hours": 2, "label": "anh Minh"}, self.ck)
        self.assertEqual(s, 201, g)
        token = urllib.parse.parse_qs(urllib.parse.urlparse(g["url"]).query)["t"][0]
        self.assertTrue(g["url"].startswith("https://proxy-hcm.example.net:8001/__bmcgw/guest?t="))
        self.assertNotIn(token, open(os.path.join(self.tmp, "data", "guests.json"), encoding="utf-8").read())  # chi luu ban bam
        # agent nhan danh sach link khach qua sync
        s, _, resp = self.sync()
        self.assertEqual(s, 200)
        self.assertEqual(len([x for x in resp["guests"] if x["id"] == g["id"]]), 1)
        gw = AuthGateway(lambda: {"bmcs": [{"port": 8001, "enabled": True}]})
        gw.set_guests(resp["guests"])
        aport = free_port()
        start_auth_server(gw, "127.0.0.1", aport)
        time.sleep(0.2)
        # khach mo link -> dat cookie -> chuyen vao "/"
        s, h, _ = req(aport, "GET", f"/__bmcgw/guest?t={token}", None, {"X-Bmcproxy-Bmc": "8001", "X-Forwarded-For": "1.2.3.4"})
        self.assertEqual(s, 302)
        self.assertIn(f"bmcgw_guest={token}", h["Set-Cookie"])
        self.assertEqual(req(aport, "GET", "/__bmcgw/guest?t=sai", None, {"X-Bmcproxy-Bmc": "8001"})[0], 403)
        # forwardAuth: cookie khach dung cong -> 200, cong khac -> 401
        s, h, _ = req(aport, "GET", "/auth/8001", None, {"Cookie": f"bmcgw_guest={token}", "X-Forwarded-For": "1.2.3.4",
                                                          "X-Forwarded-Uri": "/index.html"})
        self.assertEqual(s, 200)
        self.assertEqual(h.get("Token-guest"), "true")
        self.assertEqual(req(aport, "GET", "/auth/8002", None, {"Cookie": f"bmcgw_guest={token}"})[0], 403)
        self.assertEqual(req(aport, "GET", "/auth/8001", None, {"Cookie": "bmcgw_guest=sai"})[0], 401)
        # lan truy cap -> gui ve web
        acc = gw.pop_access()
        self.assertEqual([a["kind"] for a in acc], ["guest-open", "web"])
        self.assertEqual(acc[0]["ip"], "1.2.3.4")
        self.assertEqual(self.sync({"access": acc})[0], 200)
        rows = req(self.port, "GET", "/api/access?site=hcm&port=8001", None, self.ck)[2]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["note"], "KH 1")
        self.assertTrue(rows[0]["user"].startswith("khách: anh Minh"))
        # gom: cung nguoi + IP trong 30 phut khong ghi lai
        gw.log_access(8001, "1.2.3.4", "u", "/x")
        gw.log_access(8001, "1.2.3.4", "u", "/y")
        gw.log_access(8001, "1.2.3.4", "u", "/__kvm/vnc.html")
        self.assertEqual([a["kind"] for a in gw.pop_access()], ["web", "console"])
        # thu hoi -> sync sau khong con link
        self.assertEqual(req(self.port, "DELETE", f"/api/guests/{g['id']}", None, self.ck)[0], 200)
        self.assertFalse([x for x in self.sync()[2]["guests"] if x["id"] == g["id"]])
        lst = req(self.port, "GET", "/api/guests", None, self.ck)[2]
        self.assertEqual(next(x for x in lst if x["id"] == g["id"])["status"], "revoked")

    def test_ip_rules_and_blocked_log(self):
        from gw_auth import AuthGateway
        # web: tao quy tac -> agent nhan qua sync; dai qua rong / IP sai bi tu choi
        bad = [{"cidr": "10.0.0.0/8", "action": "allow"}, {"cidr": "1.2.3", "action": "block"}, {"cidr": "1.2.3.4", "action": "x"}]
        for d in bad:
            self.assertEqual(req(self.port, "POST", "/api/iprules", {"site": "hcm", **d}, self.ck)[0], 400, d)
        s, _, blk = req(self.port, "POST", "/api/iprules", {"site": "hcm", "cidr": "203.0.113.9", "action": "block", "note": "bot"}, self.ck)
        self.assertEqual(s, 201, blk)
        s, _, alw = req(self.port, "POST", "/api/iprules", {"site": "hcm", "cidr": "198.51.100.0/24", "action": "allow",
                                                            "port": 8001, "hours": 2}, self.ck)
        self.assertEqual(s, 201, alw)
        rules = self.sync()[2]["ip_rules"]
        self.assertEqual(sorted(r["cidr"] for r in rules), ["198.51.100.0/24", "203.0.113.9/32"])
        # agent: chan uu tien hon link khach, cho phep vao khong can cookie (chi dung cong), lan bi chan duoc gom
        gw = AuthGateway(lambda: {"bmcs": [{"port": 8001, "enabled": True}, {"port": 8002, "enabled": True}]})
        gw.set_ip_rules(rules)
        self.assertEqual(gw.check(8001, "", "", "203.0.113.9", "/")[0], 403)
        code, h = gw.check(8001, "", "", "198.51.100.7", "/index.html")
        self.assertEqual((code, h.get("Token-ip-allow")), (200, "true"))
        self.assertEqual(gw.check(8002, "", "", "198.51.100.7", "/")[0], 401)  # cho phep chi cong 8001
        for _ in range(3):
            gw.check(8002, "", "", "192.0.2.50", "/login.html")
        den = {(d["ip"], d["reason"]): d for d in gw.pop_denied()}
        self.assertEqual(den[("192.0.2.50", "no-login")]["count"], 3)
        self.assertEqual(den[("203.0.113.9", "blocked")]["count"], 1)
        self.assertEqual(gw.pop_denied(), [])
        # agent gui ve -> trang Chan IP gom theo IP
        self.assertEqual(self.sync({"denied": list(den.values())})[0], 200)
        r = req(self.port, "GET", "/api/blocked?days=1", None, self.ck)[2]
        row = next(x for x in r["rows"] if x["ip"] == "192.0.2.50")
        self.assertEqual((row["count"], row["reasons"], row["port"]), (3, {"no-login": 3}, 8002))
        self.assertEqual(next(x for x in r["rows"] if x["ip"] == "203.0.113.9")["rule"], "block")
        # van hanh mac dinh khong duoc chan / cho phep IP
        pw = "P-" + secrets.token_hex(8)
        req(self.port, "POST", "/api/users", {"name": "nv2", "password": pw, "role": "operator", "must_change": ""}, self.ck)
        ck = {"Cookie": req(self.port, "POST", "/api/login", {"user": "nv2", "password": pw})[1]["Set-Cookie"].split(";")[0]}
        self.assertEqual(req(self.port, "POST", "/api/iprules", {"site": "hcm", "cidr": "192.0.2.1", "action": "block"}, ck)[0], 403)
        self.assertEqual(req(self.port, "GET", "/api/blocked", None, ck)[0], 200)
        self.assertEqual(req(self.port, "DELETE", f"/api/iprules/{blk['id']}", None, ck)[0], 403)
        req(self.port, "DELETE", "/api/users/nv2", None, self.ck)
        for x in (blk, alw):
            self.assertEqual(req(self.port, "DELETE", f"/api/iprules/{x['id']}", None, self.ck)[0], 200)
        self.assertEqual(self.sync()[2]["ip_rules"], [])

    def test_fine_permissions(self):
        # Van hanh chi duoc sua BMC + xuat CSV o site hcm: them / xoa / ap dung / xem nhat ky -> 403
        pw = "P-" + secrets.token_hex(8)
        s, _, r = req(self.port, "POST", "/api/users", {"name": "nv1", "password": pw, "role": "operator", "sites": ["hcm"],
                                                         "perms": ["bmc_edit", "export", "khong-co"], "must_change": ""}, self.ck)
        self.assertEqual(s, 201, r)
        ck = {"Cookie": req(self.port, "POST", "/api/login", {"user": "nv1", "password": pw})[1]["Set-Cookie"].split(";")[0]}
        self.assertEqual(req(self.port, "GET", "/api/me", None, ck)[2]["perms"], ["bmc_edit", "export"])
        s, _, r = req(self.port, "PUT", "/api/bmcs/hcm/8001", {"note": "KH 1"}, ck)
        self.assertEqual(s, 200, r)
        self.assertEqual(req(self.port, "POST", "/api/bmcs", {"site": "hcm", "port": 8009, "upstream": "https://10.0.0.9"}, ck)[0], 403)
        self.assertEqual(req(self.port, "DELETE", "/api/bmcs/hcm/8001", None, ck)[0], 403)
        self.assertEqual(req(self.port, "POST", "/api/bmcs/batch", {"action": "delete", "keys": [{"site": "hcm", "port": 8001}]}, ck)[0], 403)
        s, _, r = req(self.port, "POST", "/api/bmcs/batch", {"action": "set", "keys": [{"site": "hcm", "port": 8001}],
                                                              "fields": {"tags": ["KH-1"]}}, ck)
        self.assertEqual(s, 200, r)
        self.assertEqual(req(self.port, "POST", "/api/apply", {"sites": ["hcm"]}, ck)[0], 403)
        self.assertEqual(req(self.port, "POST", "/api/guests", {"site": "hcm", "port": 8001}, ck)[0], 403)
        self.assertEqual(req(self.port, "POST", "/api/sites/hcm/command", {"name": "detect", "ip": "10.0.0.9"}, ck)[0], 403)
        for path in ("/api/audit", "/api/stats", "/api/access"):
            self.assertEqual(req(self.port, "GET", path, None, ck)[0], 403, path)
        self.assertEqual(req(self.port, "GET", "/api/bmcs/export", None, ck)[0], 200)
        users = {u["name"]: u for u in req(self.port, "GET", "/api/users", None, self.ck)[2]}
        self.assertTrue(users["nv1"]["perms_custom"])
        # tick lai dung bo mac dinh -> khong luu rieng; doi vai tro khong gui quyen -> theo vai tro moi
        from gw_common import ROLE_PERMS
        req(self.port, "PUT", "/api/users/nv1", {"role": "operator", "sites": ["hcm"], "perms": list(ROLE_PERMS["operator"])}, self.ck)
        self.assertNotIn("perms", self.st.users["nv1"])
        self.assertEqual(req(self.port, "POST", "/api/apply", {"sites": ["hcm"]}, ck)[0], 200)
        req(self.port, "PUT", "/api/users/nv1", {"role": "viewer", "sites": ["hcm"]}, self.ck)
        self.assertEqual(req(self.port, "GET", "/api/me", None, ck)[2]["perms"], ["export"])
        self.assertEqual(req(self.port, "PUT", "/api/bmcs/hcm/8001", {"note": "KH 1"}, ck)[0], 403)
        # Chi xem duoc cho them quyen xem nhat ky
        req(self.port, "PUT", "/api/users/nv1", {"role": "viewer", "sites": ["hcm"], "perms": ["audit"]}, self.ck)
        self.assertEqual(req(self.port, "GET", "/api/audit", None, ck)[0], 200)
        self.assertEqual(req(self.port, "GET", "/api/bmcs/export", None, ck)[0], 403)
        req(self.port, "DELETE", "/api/users/nv1", None, self.ck)

    def test_customer_portal(self):
        from gw_common import hash_password
        req(self.port, "POST", "/api/bmcs", {"site": "hcm", "port": 8005, "upstream": "https://10.0.0.6",
                                             "template": "idrac9", "note": "KH ABC", "tags": "KH-ABC"}, self.ck)
        # tao tai khoan khach hang: bat buoc co nhan / danh sach BMC
        bad = req(self.port, "POST", "/api/users", {"name": "kh1", "password": "x" * 12, "role": "customer"}, self.ck)
        self.assertEqual(bad[0], 400)
        pw = "K-" + secrets.token_hex(8)
        s, _, r = req(self.port, "POST", "/api/users", {"name": "kh.abc", "password": pw, "role": "customer",
                                                        "bmc_tags": "KH-ABC", "must_change": ""}, self.ck)
        self.assertEqual(s, 201, r)
        s, h, me = req(self.port, "POST", "/api/login", {"user": "kh.abc", "password": pw})
        self.assertEqual((s, me["role"]), (200, "customer"))
        kc = {"Cookie": h["Set-Cookie"].split(";")[0]}
        mine = req(self.port, "GET", "/api/my/bmcs", None, kc)[2]
        self.assertEqual([b["port"] for b in mine], [8005])
        # moi API cua nhan vien deu bi chan
        for m, path in (("GET", "/api/bmcs"), ("GET", "/api/sites"), ("GET", "/api/overview"), ("GET", "/api/audit"),
                        ("GET", "/api/access"), ("GET", "/api/guests"), ("GET", "/api/settings"), ("GET", "/api/users"),
                        ("GET", "/api/maint"), ("POST", "/api/apply"), ("GET", "/api/zabbix")):
            self.assertEqual(req(self.port, m, path, {} if m == "POST" else None, kc)[0], 403, path)
        # mo BMC cua minh -> link khach 4 gio; BMC khac -> 403
        s, _, o = req(self.port, "POST", "/api/my/open", {"site": "hcm", "port": 8005}, kc)
        self.assertEqual(s, 200, o)
        self.assertIn(":8005/__bmcgw/guest?t=", o["url"])
        self.assertEqual(req(self.port, "POST", "/api/my/open", {"site": "hcm", "port": 8001}, kc)[0], 403)
        req(self.port, "POST", "/api/my/open", {"site": "hcm", "port": 8005}, kc)
        portal = [g for g in self.sync()[2]["guests"] if g["port"] == 8005]
        self.assertEqual(len(portal), 1)  # mo lai -> link cu cua cung BMC bi thu hoi
        self.assertEqual(req(self.port, "GET", "/api/my/access", None, kc)[0], 200)
        self.assertEqual(req(self.port, "POST", "/api/password", {"old": pw, "new": "N-" + secrets.token_hex(8)}, kc)[0], 200)

    def test_maintenance(self):
        import gw_errpage
        from gw_auth import AuthGateway
        import datetime as dt
        now = dt.datetime.now()
        f = lambda d: d.strftime("%Y-%m-%dT%H:%M")
        self.assertEqual(req(self.port, "POST", "/api/maint", {"site": "hcm", "start": f(now), "end": f(now - dt.timedelta(hours=1))},
                             self.ck)[0], 400)
        s, _, m = req(self.port, "POST", "/api/maint", {"site": "hcm", "port": 0, "start": f(now - dt.timedelta(minutes=1)),
                                                        "end": f(now + dt.timedelta(hours=1)), "note": "thay switch"}, self.ck)
        self.assertEqual((s, m["status"]), (201, "active"), m)
        req(self.port, "POST", "/api/maint", {"site": "hcm", "port": 8001, "start": f(now + dt.timedelta(days=1)),
                                              "end": f(now + dt.timedelta(days=1, hours=2))}, self.ck)
        rows = req(self.port, "GET", "/api/maint", None, self.ck)[2]
        self.assertEqual([r["status"] for r in rows], ["active", "upcoming"])
        warns = req(self.port, "GET", "/api/warnings", None, self.ck)[2]
        self.assertTrue(any("bảo trì" in w["text"] for w in warns))
        resp = self.sync()[2]
        self.assertEqual(len(resp["maint"]), 1)
        gw = AuthGateway(lambda: {"bmcs": []})
        gw.set_maint(resp["maint"])
        mt = gw.maint_for(8001)
        self.assertEqual(mt["note"], "thay switch")
        body = gw_errpage.page({"port": 8001, "upstream": "https://127.0.0.1:1", "note": ""}, "502", maint=mt)[2].decode()
        self.assertIn("Đang bảo trì", body)
        # ket thuc som -> agent khong con bien bao tri
        self.assertEqual(req(self.port, "DELETE", f"/api/maint/{m['id']}", None, self.ck)[0], 200)
        self.assertEqual(self.sync()[2]["maint"], [])

    def test_stats(self):
        self.sync({"access": [{"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "port": 8001, "ip": "9.9.9.9", "user": "noc@x",
                               "kind": "console", "path": "/__kvm/"}]})
        s, _, r = req(self.port, "GET", "/api/stats", None, self.ck)
        self.assertEqual(s, 200)
        self.assertEqual(len(r["days"]), 7)
        self.assertGreaterEqual(r["days"][-1]["console"], 1)
        self.assertTrue(any(u["user"] == "noc@x" for u in r["top_users"]))
        self.assertTrue(any(b["port"] == 8001 and b["note"] == "KH 1" for b in r["top_bmcs"]))

    def test_render_guest_router(self):
        from gw_render import expected_routers, render_bmc
        from gw_common import BMC_DEFAULTS
        b = {**BMC_DEFAULTS, "site": "hcm", "port": 8001, "upstream": "https://10.0.0.5", "auth": True}
        params = {"auth_host": "127.0.0.1", "auth_port": 9444}
        out = render_bmc(b, params)
        text = out if isinstance(out, str) else json.dumps(out)
        self.assertIn("/__bmcgw/guest", text)
        self.assertIn("bmc-8001-guest", expected_routers({"bmcs": [b]}))

    def test_update_agent(self):
        import gw_controller
        info = gw_controller.agent_pkg_info()
        if not info:
            self.skipTest("chưa có gói agent - chạy tools/build_packages.py")
        inst = tempfile.mkdtemp(prefix="agent-inst-")
        try:
            with zipfile.ZipFile(info["path"]) as z:
                z.extractall(inst)
            app = os.path.join(inst, "bmc-gateway-agent")
            with open(os.path.join(app, "BUILD"), "w") as f:
                f.write("2.0.0-banCu\n")
            with open(os.path.join(app, "gw_nginx.py"), "a") as f:
                f.write("\n# ban cu\n")
            data = os.path.join(inst, "data")
            os.makedirs(data)
            # web phat lenh -> agent (chay that, tu thu muc cai dat) tai goi, kiem SHA-256, cai, thoat de systemd chay lai
            s, _, r = req(self.port, "POST", "/api/sites/hcm/command", {"name": "update_agent"}, self.ck)
            self.assertEqual(s, 200, r)
            code = ("import sys, json; sys.path.insert(0, sys.argv[1]); import gw_agent\n"
                    "cfg = {**gw_agent.AGENT_DEFAULTS, 'site': 'hcm', 'controller_url': sys.argv[2], 'token': sys.argv[3],"
                    " 'verify_tls': False, 'data_dir': sys.argv[4]}\n"
                    "a = gw_agent.Agent(cfg)\n"
                    "a.update_agent({'sha256': sys.argv[5], 'build': sys.argv[6]})\n"
                    "print('RESULT:' + json.dumps(a.extra.get('action')), flush=True)\n"
                    "import os; os._exit(0)\n")
            p = subprocess.run([sys.executable, "-c", code, app, f"http://127.0.0.1:{self.port}", self.token, data,
                                info["sha256"], info["build"]], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120, cwd=app,
                               env={**os.environ, "PYTHONIOENCODING": "utf-8"})
            out = [x for x in p.stdout.splitlines() if x.startswith("RESULT:")]
            self.assertTrue(out, p.stdout[-1500:] + p.stderr[-1500:])
            act = json.loads(out[0][7:])
            self.assertTrue(act["ok"], act)
            self.assertEqual(open(os.path.join(app, "BUILD")).read().strip(), info["build"])
            self.assertNotIn("# ban cu", open(os.path.join(app, "gw_nginx.py")).read())
            backups = [d for d in os.listdir(data) if d.startswith("agent-backup-")]
            self.assertEqual(len(backups), 1)
            self.assertIn("2.0.0-banCu", open(os.path.join(data, backups[0], "BUILD")).read())
            # SHA-256 sai -> khong dung vao file
            p = subprocess.run([sys.executable, "-c", code, app, f"http://127.0.0.1:{self.port}", self.token, data,
                                "0" * 64, "x"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120, cwd=app,
                               env={**os.environ, "PYTHONIOENCODING": "utf-8"})
            out = [x for x in p.stdout.splitlines() if x.startswith("RESULT:")]
            self.assertTrue(out, p.stdout[-1500:] + p.stderr[-1500:])
            act = json.loads(out[0][7:])
            self.assertFalse(act["ok"])
            self.assertIn("SHA-256", act["output"])
            # sai token -> web tu choi tai goi
            self.assertEqual(req(self.port, "POST", "/agent/v1/package", {}, {"Authorization": "Bearer sai",
                                                                                "X-Agent-Site": "hcm"})[0], 401)
        finally:
            shutil.rmtree(inst, ignore_errors=True)


    def test_idrac9_host_header_and_batch(self):
        # mau co san luon lay tu code, ban sao cu trong templates.json khong de len
        self.st.templates["idrac9"] = {"label": "Dell iDRAC 9", "upstream": "default", "console": "none",
                                       "legacy_tls": False, "jsesp_cache": False}
        s, _, t = req(self.port, "GET", "/api/templates", None, self.ck)
        self.assertEqual(s, 200)
        self.assertEqual(t["idrac9"]["host_header"], "upstream")
        self.assertTrue(t["idrac9"]["builtin"])
        s, _, f = req(self.port, "POST", "/api/templates/idrac9/apply", {"port": 8024, "ip": "10.0.0.24"}, self.ck)
        self.assertEqual((s, f["host_header"], f["upstream"]), (200, "upstream", "https://10.0.0.24"))
        # sua hang loat: Host = IP BMC roi tra lai
        key = [{"site": "hcm", "port": 8001}]
        for want in ("upstream", "client"):
            s, _, r = req(self.port, "POST", "/api/bmcs/batch",
                          {"keys": key, "action": "set", "fields": {"host_header": want}}, self.ck)
            self.assertEqual((s, r.get("changed")), (200, 1), r)
            b = next(x for x in self.st.bmcs if x["site"] == "hcm" and x["port"] == 8001)
            self.assertEqual(b["host_header"], want)
        s, _, r = req(self.port, "POST", "/api/bmcs/batch",
                      {"keys": key, "action": "set", "fields": {"host_header": "sai"}}, self.ck)
        self.assertEqual(s, 400, r)

    def test_detect_command_roundtrip(self):
        s, _, r = req(self.port, "POST", "/api/sites/hcm/command", {"name": "detect", "ip": "10.0.0.9;rm"}, self.ck)
        self.assertEqual(s, 400, r)
        s, _, q = req(self.port, "POST", "/api/sites/hcm/command", {"name": "detect", "ip": "10.0.0.9"}, self.ck)
        self.assertEqual(s, 200, q)
        self.assertTrue(q["req"])
        s, _, resp = self.sync()
        cmd = next(c for c in resp["commands"] if c.get("name") == "detect")
        self.assertEqual((cmd["ip"], cmd["req"]), ("10.0.0.9", q["req"]))
        # agent gui ket qua o lan sync sau -> web tra cho form
        self.sync({"detect": {"req": q["req"], "ip": "10.0.0.9", "template": "idrac9", "confidence": "cao",
                              "web": {"port": 443, "scheme": "https", "tls": "TLSv1.3", "legacy_tls": False}}})
        s, _, d = req(self.port, "GET", "/api/sites/hcm/detect", None, self.ck)
        self.assertEqual((s, d["req"], d["template"]), (200, q["req"], "idrac9"))

    def test_dev_routes_off(self):
        import gw_controller
        self.assertFalse(gw_controller.DEV)
        self.assertEqual(req(self.port, "GET", "/__dev/version", None, self.ck)[0], 404)
        s, _, body = req(self.port, "GET", "/", None, self.ck)
        self.assertNotIn(b"__dev/reload.js", body)


# ====================================================================== do loai BMC
class DetectTest(unittest.TestCase):
    """detect_bmc voi trang BMC gia lap (HTTP cong ngau nhien)."""

    FAKES = {
        "idrac9": {"/": (302, {"Location": "/restgui/start.html"}, ""),
                   "/restgui/start.html": (200, {}, "<title>iDRAC9</title>"),
                   "/redfish/v1/": (200, {}, json.dumps({"Product": "Integrated Dell Remote Access Controller"}))},
        "idrac7-8": {"/": (200, {}, "<title>iDRAC8 - Login</title>")},
        # mau lay tu BMC that qua proxy (khong co ten hang tren trang chu / Redfish khoa)
        "idrac6": {"/": (200, {}, "<title>iDRAC 6</title>")},
        "qct-ami-java": {"/": (302, {"Location": "/index.html"}, "/home/x/ast2300evb_workspace/Build")},
        "ilo4-5": {"/": (200, {}, "<title>iLO 5</title> Integrated Lights-Out")},
        "lenovo": {"/": (200, {}, "<title>Lenovo XClarity Controller</title>")},
        "cisco-c220": {"/": (200, {}, "<title>Cisco Integrated Management Controller</title>")},
        "supermicro": {"/": (200, {}, '<form action="/cgi/login.cgi">')},
        "qct-ami-java ": {"/": (200, {"Server": "lighttpd"}, "<title>MegaRAC SP</title>")},
        "qct-ami-java  ": {"/": (200, {}, "<title>TYAN</title>")},
        "idrac9 ": {"/": (302, {"Location": "/restgui/start.html"}, "")},
        "idrac9  ": {"/": (400, {}, "<title>400 Bad Request</title> ... use an ErrorDocument to handle the request.")},
        "idrac7-8 ": {"/": (302, {"Location": "/start.html"}, "<title>Moved Temporarily</title>")},
        None: {"/": (200, {}, "<title>Router</title>")},
    }

    def test_fingerprints(self):
        import gw_errpage
        old = gw_errpage.DETECT_WEB_PORTS, gw_errpage.DETECT_EXTRA_PORTS
        try:
            for expect, pages in self.FAKES.items():
                class H(http.server.BaseHTTPRequestHandler):
                    def do_GET(self, pages=pages):
                        code, hdr, body = pages.get(self.path, (404, {}, "nf"))
                        self.send_response(code)
                        for k, v in hdr.items():
                            self.send_header(k, v)
                        self.end_headers()
                        self.wfile.write(body.encode())

                    def log_message(self, *a):
                        pass

                srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
                threading.Thread(target=srv.serve_forever, daemon=True).start()
                try:
                    gw_errpage.DETECT_WEB_PORTS = [(srv.server_address[1], "http")]
                    gw_errpage.DETECT_EXTRA_PORTS = []
                    r = gw_errpage.detect_bmc("127.0.0.1")
                finally:
                    srv.shutdown()
                    srv.server_close()
                self.assertEqual(r.get("template"), expect.strip() if expect else None, r)
                self.assertEqual(r["web"]["port"], srv.server_address[1])
        finally:
            gw_errpage.DETECT_WEB_PORTS, gw_errpage.DETECT_EXTRA_PORTS = old

    def test_no_web_port(self):
        import gw_errpage
        old = gw_errpage.DETECT_WEB_PORTS, gw_errpage.DETECT_EXTRA_PORTS
        try:
            s = socket.socket()
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
            s.close()  # cong vua dong -> chac chan khong co ai nghe
            gw_errpage.DETECT_WEB_PORTS, gw_errpage.DETECT_EXTRA_PORTS = [(port, "https")], []
            r = gw_errpage.detect_bmc("127.0.0.1")
            self.assertIn("error", r)
            self.assertIsNone(r.get("template"))
        finally:
            gw_errpage.DETECT_WEB_PORTS, gw_errpage.DETECT_EXTRA_PORTS = old


# ====================================================================== iDRAC tu choi qua proxy
class RejectPageTest(unittest.TestCase):
    """Trang iDRAC di qua agent: QueryNotSupported / 400 -> trang huong dan; chuyen huong ve IP noi bo -> ten mien proxy."""

    QNS = json.dumps({"error": {"code": "Base.1.8.GeneralError", "@Message.ExtendedInfo": [
        {"MessageId": "Base.1.8.QueryNotSupported"}]}})

    @classmethod
    def setUpClass(cls):
        from gw_auth import AuthGateway, start_auth_server
        test = cls

        class FakeIdrac(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                own = self.headers.get("Host", "").startswith("127.0.0.1")  # Host Header Check cua iDRAC
                path = self.path.split("?")[0]
                if path == "/" and own:
                    code, hdr, body = 302, {"Location": f"https://127.0.0.1:{test.bport}/restgui/start.html"}, ""
                elif path == "/":
                    code, hdr, body = 400, {}, "<title>400 Bad Request</title><h1>Bad Request</h1> ErrorDocument"
                elif path == "/restgui/index.html":
                    code, hdr, body = (200, {"Content-Type": "text/html"}, "<html>iDRAC</html>") if own \
                        else (200, {"Content-Type": "application/json"}, test.QNS)
                else:
                    code, hdr, body = 200, {"Content-Type": "text/html", "Set-Cookie": "-http-session-=1"}, "<html>login</html>"
                self.send_response(code)
                for k, v in hdr.items():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, *a):
                pass

        cls.bmc_srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeIdrac)
        cls.bport = cls.bmc_srv.server_address[1]
        threading.Thread(target=cls.bmc_srv.serve_forever, daemon=True).start()
        up = f"http://127.0.0.1:{cls.bport}"
        cls.gw = AuthGateway(lambda: {"bmcs": [
            {"port": 8101, "enabled": True, "upstream": up, "host_header": "client", "note": "R640"},
            {"port": 8102, "enabled": True, "upstream": up, "host_header": "upstream", "note": "R740"}]})
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        cls.aport = s.getsockname()[1]
        s.close()
        cls.auth_srv = start_auth_server(cls.gw, "127.0.0.1", cls.aport)

    @classmethod
    def tearDownClass(cls):
        cls.bmc_srv.shutdown()
        cls.auth_srv.shutdown()

    def page(self, port, path):
        return req(self.aport, "GET", path, None, {"X-Bmcproxy-Page": str(port), "Host": f"proxy.example.net:{port}"})

    def test_query_not_supported_shows_fix(self):
        s, _, body = self.page(8101, "/restgui/index.html?abc123")
        self.assertEqual(s, 200)
        text = body.decode()
        self.assertIn("QueryNotSupported", text)
        self.assertIn("racadm set iDRAC.WebServer.HostHeaderCheck Disabled", text)
        self.assertIn("Host header = IP của BMC", text)

    def test_host_ip_passthrough_and_redirect(self):
        # Host = IP BMC: trang that tra nguyen, chuyen huong ve IP noi bo -> ten mien proxy
        s, _, body = self.page(8102, "/restgui/index.html?abc123")
        self.assertEqual((s, body), (200, b"<html>iDRAC</html>"))
        s, h, _ = self.page(8102, "/")
        self.assertEqual(s, 302)
        self.assertEqual(h["Location"], "https://proxy.example.net:8102/restgui/start.html")
        s, h, body = self.page(8102, "/restgui/start.html")
        self.assertEqual((s, body), (200, b"<html>login</html>"))
        self.assertIn("-http-session-", h.get("Set-Cookie", ""))

    def test_root_400_error_page(self):
        import gw_errpage
        code, _, body = gw_errpage.page(self.gw._bmc(8101), "400", "reject")
        self.assertEqual(code, 200)
        self.assertIn("Host Header Check", body.decode())
        self.assertTrue(gw_errpage.is_reject(400, b"<h1>Bad Request</h1>"))
        self.assertFalse(gw_errpage.is_reject(200, b"<html>ok</html>"))

    def test_render_routes(self):
        import gw_render
        y = gw_render.render_bmc({"site": "hcm", "port": 8101, "upstream": "https://10.0.0.5", "host_header": "client"},
                                 gw_render.DEFAULT_PARAMS)
        self.assertIn("bmc-8101-root", y)
        self.assertIn("kind=reject", y)
        self.assertIn("Path(`/restgui/index.html`)", y)
        y = gw_render.render_bmc({"site": "hcm", "port": 8102, "upstream": "https://10.0.0.5", "host_header": "upstream"},
                                 gw_render.DEFAULT_PARAMS)
        self.assertNotIn("bmc-8102-root", y)
        self.assertIn("Path(`/`) || Path(`/restgui/start.html`)", y)

if __name__ == "__main__":
    unittest.main()
