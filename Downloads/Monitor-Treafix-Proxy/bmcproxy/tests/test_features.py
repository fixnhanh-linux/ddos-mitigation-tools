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


if __name__ == "__main__":
    unittest.main()
