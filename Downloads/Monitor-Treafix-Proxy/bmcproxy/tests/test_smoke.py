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

    def test_decide(self):
        with self.assertRaises(self.L.LdapError):
            self.L.decide(self.cfg, {"matched": False, "sites": []}, None)
        self.assertEqual(self.L.decide(self.cfg, {"matched": False, "sites": []}, {"role": "viewer", "sites": []}),
                         ("viewer", []))


if __name__ == "__main__":
    unittest.main()
