"""Kiem tra nhanh truoc khi dong goi:  python -m unittest discover -s tests -v   (trong thu muc bmcproxy/)

- moi module import duoc tu cau truc thu muc (common/ controller/ agent/)
- web chay that tren cong ngau nhien: dang nhap, tao site, them BMC, xem truoc config Traefik
- dang nhap AD voi AD gia lap (ldap3 MOCK_SYNC) - bo qua neu may chua cai ldap3
"""
import http.client
import json
import os
import secrets
import shutil
import socket
import sys
import tempfile
import threading
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for d in ("agent", "controller", "common"):
    sys.path.insert(0, os.path.join(ROOT, d))

MODULES = ["gw_common", "gw_render", "gw_auth", "gw_controller", "gw_db", "gw_ldap", "gw_templates",
           "gw_agent", "gw_nginx", "gw_limit", "gw_errpage", "gw_java", "gw_kvm"]


class ImportTest(unittest.TestCase):
    def test_import_all(self):
        import importlib
        for m in MODULES:
            importlib.import_module(m)

    def test_static_files(self):
        import gw_controller
        for f in ("index.html", "app.js", "app.css"):
            self.assertTrue(os.path.isfile(os.path.join(gw_controller.WEB_DIR, f)), f)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class WebTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from gw_common import hash_password
        from gw_controller import Store, load_controller_config, serve
        cls.tmp = tempfile.mkdtemp(prefix="bmcproxy-test-")
        cls.port = free_port()
        cfgp = os.path.join(cls.tmp, "config.json")
        with open(cfgp, "w") as f:
            json.dump({"listen_host": "127.0.0.1", "listen_port": cls.port, "data_dir": os.path.join(cls.tmp, "data"),
                       "backup_dir": os.path.join(cls.tmp, "backups")}, f)
        cls.st = Store(load_controller_config(cfgp))
        cls.pw = "T-" + secrets.token_hex(8)
        cls.st.users["admin"] = {**hash_password(cls.pw), "role": "admin", "sites": []}
        cls.st.save("users.json")
        threading.Thread(target=serve, args=(cls.st,), daemon=True).start()
        for _ in range(40):
            try:
                socket.create_connection(("127.0.0.1", cls.port), 0.25).close()
                break
            except OSError:
                threading.Event().wait(0.1)
        s, ck, _ = cls.req("POST", "/api/login", {"user": "admin", "password": cls.pw})
        assert s == 200, s
        cls.cookie = ck

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def req(cls, m, path, body=None, cookie=None):
        c = http.client.HTTPConnection("127.0.0.1", cls.port, timeout=10)
        h = {"Content-Type": "application/json", "X-Requested-With": "bmcproxy"}
        ck = cookie if cookie is not None else getattr(cls, "cookie", "")
        if ck:
            h["Cookie"] = ck
        c.request(m, path, json.dumps(body) if body is not None else None, h)
        r = c.getresponse()
        raw = r.read()
        try:
            data = json.loads(raw)
        except ValueError:
            data = raw
        return r.status, (r.getheader("Set-Cookie") or "").split(";")[0], data

    def test_1_pages(self):
        s, _, body = self.req("GET", "/", cookie="")
        self.assertEqual(s, 200)
        self.assertIn(b"Treafix Proxy BB", body)
        self.assertEqual(self.req("GET", "/api/me", cookie="")[0], 401)
        self.assertEqual(self.req("POST", "/api/login", {"user": "admin", "password": "sai"}, cookie="")[0], 401)

    def test_2_site_bmc_preview(self):
        s, _, _ = self.req("POST", "/api/sites", {"key": "hcm", "label": "HCM", "domain": "proxy-hcm.example.net"})
        self.assertIn(s, (200, 201))
        b = {"site": "hcm", "port": 8001, "upstream": "https://10.0.0.5", "template": "idrac9", "note": "test"}
        self.assertIn(self.req("POST", "/api/bmcs", b)[0], (200, 201))
        s, _, txt = self.req("POST", "/api/render", {**b, "_orig": {"site": "hcm", "port": 8001}})
        self.assertEqual(s, 200, txt)
        self.assertIn(b"10.0.0.5", txt if isinstance(txt, bytes) else json.dumps(txt).encode())
        views = self.req("GET", "/api/bmcs")[2]
        self.assertTrue(any(v["port"] == 8001 for v in views))

    def test_3_login_info(self):
        self.assertEqual(self.req("GET", "/api/login-info", cookie="")[2], {"ldap": False, "domain": ""})

    def test_4_password_change_drops_other_sessions(self):
        from gw_common import hash_password
        pw = "U-" + secrets.token_hex(8)
        with self.st.lock:
            self.st.users["u1"] = {**hash_password(pw), "role": "viewer", "sites": []}
            self.st.save("users.json")
        a = self.req("POST", "/api/login", {"user": "u1", "password": pw}, cookie="")[1]
        b = self.req("POST", "/api/login", {"user": "u1", "password": pw, "remember": True}, cookie="")[1]
        new = "N-" + secrets.token_hex(8)
        s, _, d = self.req("POST", "/api/password", {"old": pw, "new": new}, cookie=a)
        self.assertEqual((s, d.get("dropped")), (200, 1))
        self.assertEqual(self.req("GET", "/api/me", cookie=a)[0], 200)   # phien dang doi van dung
        self.assertEqual(self.req("GET", "/api/me", cookie=b)[0], 401)   # phien khac bi dang xuat

    def test_5_account_lockout(self):
        from gw_common import hash_password
        import gw_controller
        pw = "L-" + secrets.token_hex(8)
        with self.st.lock:
            self.st.users["u2"] = {**hash_password(pw), "role": "viewer", "sites": []}
            self.st.save("users.json")
        app = None
        for _ in range(gw_controller.ACCOUNT_MAX_FAILS):
            s = self.req("POST", "/api/login", {"user": "u2", "password": "sai"}, cookie="")[0]
            self.assertIn(s, (401, 429))
            # moi lan sai doi IP gia: xoa khoa theo IP de chi con khoa theo tai khoan
            import gc
            app = app or next(o for o in gc.get_objects() if isinstance(o, gw_controller.App))
            app.fails.clear()
        s, _, d = self.req("POST", "/api/login", {"user": "u2", "password": pw}, cookie="")
        self.assertEqual(s, 429, d)                       # dung mat khau van bi khoa
        app.acct_fails.clear()
        app.fails.clear()
        self.assertEqual(self.req("POST", "/api/login", {"user": "u2", "password": pw}, cookie="")[0], 200)


class AuditRotateTest(unittest.TestCase):
    def test_rotate_and_tail(self):
        import gw_controller
        from gw_controller import Store, load_controller_config, tail_lines
        tmp = tempfile.mkdtemp(prefix="bmcproxy-audit-")
        try:
            cfgp = os.path.join(tmp, "config.json")
            with open(cfgp, "w") as f:
                json.dump({"data_dir": os.path.join(tmp, "data"), "backup_dir": os.path.join(tmp, "bk")}, f)
            st = Store(load_controller_config(cfgp))
            old = gw_controller.AUDIT_MAX_BYTES
            gw_controller.AUDIT_MAX_BYTES = 4000
            try:
                for i in range(200):
                    st.audit("t", "x", f"dong {i}")
            finally:
                gw_controller.AUDIT_MAX_BYTES = old
            d = os.path.join(tmp, "data")
            self.assertTrue(os.path.exists(os.path.join(d, "audit.log.1")))
            self.assertFalse(os.path.exists(os.path.join(d, f"audit.log.{gw_controller.AUDIT_KEEP + 1}")))
            rows = st.read_audit(30)
            self.assertEqual(rows[0]["detail"], "dong 199")
            self.assertEqual(len(rows), 30)
            self.assertEqual(len(tail_lines(os.path.join(d, "audit.log"), 3)), 3)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class LdapMockTest(unittest.TestCase):
    def setUp(self):
        import gw_ldap
        if not gw_ldap.available():
            self.skipTest("chưa cài ldap3")
        import ldap3
        self.L, self.ldap3 = gw_ldap, ldap3
        self.srv = ldap3.Server("fake-dc")
        seed = ldap3.Connection(self.srv, user="cn=svc,dc=cty,dc=local", password="Svc1", client_strategy=ldap3.MOCK_SYNC)
        seed.strategy.add_entry("cn=svc,dc=cty,dc=local", {"objectClass": "person", "userPassword": "Svc1"})
        seed.strategy.add_entry("cn=khai,ou=u,dc=cty,dc=local", {
            "objectClass": ["person", "user"], "sAMAccountName": "khai", "userPassword": "Pw#1", "displayName": "Khai",
            "memberOf": ["CN=BMC-Admins,OU=G,DC=cty,DC=local"]})
        seed.strategy.add_entry("cn=nv,ou=u,dc=cty,dc=local", {
            "objectClass": ["person", "user"], "sAMAccountName": "nv", "userPassword": "Pw#2",
            "memberOf": ["CN=NOC-HCM,OU=G,DC=cty,DC=local"]})
        seed.bind()
        self.cfg = {**gw_ldap.LDAP_DEFAULTS, "enabled": True, "servers": "ldaps://fake-dc", "domain": "cty.local",
                    "base_dn": "dc=cty,dc=local", "bind_dn": "cn=svc,dc=cty,dc=local", "bind_password": "Svc1",
                    "group_admin": "BMC-Admins", "group_operator": "NOC-HCM", "site_groups": "NOC-HCM = hcm",
                    "nested": False}

    def auth(self, user, pw, **over):
        return self.L.authenticate({**self.cfg, **over}, user, pw, server=self.srv, strategy=self.ldap3.MOCK_SYNC)

    def test_roles(self):
        self.assertEqual(self.auth("CTY\\Khai", "Pw#1")["role"], "admin")
        r = self.auth("nv@cty.local", "Pw#2")
        self.assertEqual((r["role"], r["sites"]), ("operator", ["hcm"]))

    def test_rejects(self):
        for user, pw in (("khai", "sai"), ("khai", ""), ("khongco", "x"), ("*)(uid=*", "x")):
            with self.assertRaises(self.L.LdapError) as e:
                self.auth(user, pw)
            self.assertEqual(e.exception.kind, "bad", (user, pw))
        with self.assertRaises(self.L.LdapError) as e:
            self.auth("khai", "Pw#1", bind_password="sai")
        self.assertEqual(e.exception.kind, "config")

    def test_lookup_and_revoke(self):
        info = self.L.lookup(self.cfg, "nv", server=self.srv, strategy=self.ldap3.MOCK_SYNC)
        self.assertEqual(info["role"], "operator")
        self.assertIsNone(self.L.lookup(self.cfg, "khongco", server=self.srv, strategy=self.ldap3.MOCK_SYNC))
        # tai khoan web tu tao luc dang nhap AD, nay khong con thuoc nhom nao -> mat quyen
        with self.assertRaises(self.L.LdapError):
            self.L.decide(self.cfg, {"matched": False, "sites": []}, {"role": "admin", "created_by": "AD"})

    def test_recheck_logs_out_removed_user(self):
        import time
        import gw_controller
        from gw_controller import App, Store, load_controller_config
        tmp = tempfile.mkdtemp(prefix="bmcproxy-ad-")
        old_servers, old_sync = self.L._servers, self.ldap3.SYNC
        try:
            cfgp = os.path.join(tmp, "config.json")
            with open(cfgp, "w") as f:
                json.dump({"data_dir": os.path.join(tmp, "data"), "backup_dir": os.path.join(tmp, "bk")}, f)
            st = Store(load_controller_config(cfgp))
            st.auth["ldap"] = self.cfg
            st.users["ghost"] = {"source": "ldap", "role": "admin", "sites": [], "created_by": "AD"}  # da bi xoa tren AD
            st.users["nv"] = {"source": "ldap", "role": "viewer", "sites": [], "created_by": "AD"}    # nhom da doi
            app = App(st)
            self.L._servers = lambda cfg: self.srv
            self.ldap3.SYNC = self.ldap3.MOCK_SYNC
            tg, tn = app.new_session("ghost"), app.new_session("nv")
            self.assertEqual(app.session_user(tg), "ghost")   # lan dau: chay kiem tra nen
            app.session_user(tn)
            for _ in range(50):
                if not app.user_sessions("ghost") and st.users["nv"]["role"] == "operator":
                    break
                time.sleep(0.1)
            self.assertIsNone(app.session_user(tg))
            self.assertEqual(app.session_user(tn), "nv")
            self.assertEqual((st.users["nv"]["role"], st.users["nv"]["sites"]), ("operator", []))  # site hcm chua tao
        finally:
            self.L._servers, self.ldap3.SYNC = old_servers, old_sync
            shutil.rmtree(tmp, ignore_errors=True)

    def test_decide(self):
        with self.assertRaises(self.L.LdapError):
            self.L.decide(self.cfg, {"matched": False, "sites": []}, None)
        self.assertEqual(self.L.decide(self.cfg, {"matched": False, "sites": []},
                                       {"role": "viewer", "sites": [], "created_by": "admin"}),
                         ("viewer", []))


if __name__ == "__main__":
    unittest.main()
