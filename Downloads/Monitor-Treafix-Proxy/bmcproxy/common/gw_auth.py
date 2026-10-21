"""Dich vu forwardAuth cho Traefik (chay tren tung server, thay cho authenticate.js cua nginx)."""

import copy
import http.server
import json
import re
import socketserver
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from gw_common import RE_HEADER_NAME, SETTINGS_DEFAULTS, now_iso, ssl_context


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        err = sys.exc_info()[1]
        if isinstance(err, (OSError, ValueError)):  # client ngat, TLS sai, timeout...
            sys.stderr.write(f"{client_address[0]} - kết nối lỗi: {type(err).__name__}: {err}\n")
            return
        super().handle_error(request, client_address)


class AuthGateway:
    """Hoi dich vu auth-token bang cookie proxyauthcookie, cache ket qua 200."""

    def __init__(self, get_release):
        self.get_release = get_release
        self.cache = {}
        self.key_locks = {}
        self.lock = threading.Lock()
        self.stats = {}

    def _settings(self):
        rel = self.get_release() or {}
        return {**SETTINGS_DEFAULTS, **rel.get("settings", {})}

    def _bmc(self, port):
        rel = self.get_release() or {}
        for b in rel.get("bmcs", []):
            if b.get("port") == port:
                return b
        return None

    def _count(self, port, kind):
        with self.lock:
            s = self.stats.setdefault(port, {"ok": 0, "deny": 0, "error": 0, "last": None})
            s[kind] += 1
            s["last"] = now_iso()

    def _key_lock(self, cookie):
        with self.lock:
            if len(self.key_locks) > 50000:
                self.key_locks.clear()
            return self.key_locks.setdefault(cookie, threading.Lock())

    def _fetch(self, cookie, s):
        req = urllib.request.Request(
            s["auth_url"], data=b"", method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded",
                     "X-Original-COOKIE": cookie})
        ctx = ssl_context(s["auth_verify_tls"]) if s["auth_url"].startswith("https") else None
        try:
            with urllib.request.urlopen(req, timeout=s["auth_timeout"], context=ctx) as r:
                return r.status, r.read(65536)
        except urllib.error.HTTPError as e:
            return e.code, b""

    def lookup(self, cookie):
        s = self._settings()
        ttl = s["auth_cache_seconds"]
        now = time.time()
        with self.lock:
            hit = self.cache.get(cookie)
            if hit and hit[0] > now:
                return 200, hit[1]
        with self._key_lock(cookie):
            with self.lock:
                hit = self.cache.get(cookie)
                if hit and hit[0] > now:
                    return 200, hit[1]
            status, body = self._fetch(cookie, s)
            if status != 200:
                return status, None
            try:
                payload = json.loads(body.decode("utf-8"))
            except ValueError:
                return 502, None
            if not isinstance(payload, dict):
                return 502, None
            if ttl:
                with self.lock:
                    if len(self.cache) > 20000:
                        self.cache = {k: v for k, v in self.cache.items() if v[0] > now}
                        if len(self.cache) > 20000:
                            self.cache.clear()
                    self.cache[cookie] = (now + ttl, payload)
            return 200, payload

    def check(self, port, cookie):
        """Tra ve (ma HTTP cho Traefik, header them vao request toi BMC)."""
        bmc = self._bmc(port)
        if not bmc or not bmc.get("enabled", True):
            self._count(port, "deny")
            return 403, {}
        if not cookie:
            self._count(port, "deny")
            return 401, {}
        try:
            status, payload = self.lookup(cookie)
        except (OSError, ValueError) as e:
            print(f"auth service error: {e}", file=sys.stderr)
            self._count(port, "error")
            return 401, {}
        if status != 200 or payload is None:
            self._count(port, "error")
            return 401, {}
        if payload.get("active") is not True:
            self._count(port, "deny")
            return 403, {}
        expected = bmc.get("expected_target")
        if expected and str(payload.get("target")) != expected:
            self._count(port, "deny")
            return 403, {}
        headers = {}
        for k, v in payload.items():
            if v is None or isinstance(v, (dict, list)) or not RE_HEADER_NAME.match(str(k)):
                continue
            if isinstance(v, bool):
                v = "true" if v else "false"
            headers["Token-" + str(k)] = re.sub(r"[\r\n]", " ", str(v))[:1024]
        self._count(port, "ok")
        return 200, headers

    def get_stats(self):
        with self.lock:
            return copy.deepcopy(self.stats)

    def clear_cache(self):
        with self.lock:
            n = len(self.cache)
            self.cache.clear()
        return n


def make_auth_handler(gateway):
    class AuthHandler(http.server.BaseHTTPRequestHandler):
        server_version = "bmcproxy-auth"
        sys_version = ""
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):
            pass

        def serve_jnlp(self, tag):
            """Traefik chuyen file .jnlp cua BMC toi day (header X-Bmcproxy-Bmc do middleware gan)."""
            from gw_java import fetch_jnlp
            bmc = gateway._bmc(int(tag)) if tag.isdigit() else None
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            mode = (query.get("__bmcgw") or [""])[0]
            ctl = re.match(r"^/__kvmctl/(status|wait)$", urllib.parse.urlparse(self.path).path)
            if ctl:
                mode = ctl.group(1)
            path = re.sub(r"[?&]__bmcgw=[^&]*$", "", self.path)
            web = bool(bmc and bmc.get("java_web")) and mode != "download"
            if not bmc or not (bmc.get("jnlp_rewrite", True) or web):
                code, headers, body = 404, {"Content-Type": "text/plain; charset=utf-8"}, b"Not found"
            elif self.command == "HEAD" and not mode:
                # Trang launch cua AMI goi HEAD truoc GET: tra loi ngay, khong goi BMC / khong chay console 2 lan
                ctype = "text/html; charset=utf-8" if web else "application/x-java-jnlp-file"
                code, headers, body = 200, {"Content-Type": ctype, "Cache-Control": "no-store"}, b""
            elif web and mode == "status":
                import gw_kvm
                code, headers, body = gw_kvm.status_response(bmc["port"], self.headers.get("Cookie"))
            elif web and mode == "wait":  # trang cho, mo o cua so chinh (khi .jnlp bi goi trong iframe)
                import gw_kvm
                code, headers, body = gw_kvm.wait_response(bmc)
            else:
                try:
                    if web:  # console Java chay tren server proxy, xem qua noVNC
                        import gw_kvm
                        code, headers, body = gw_kvm.launch(bmc, path, self.headers,
                                                            self.headers.get("Host") or "")
                    else:
                        code, headers, body = fetch_jnlp(bmc, path, self.headers,
                                                         self.headers.get("Host") or "")
                except OSError as e:
                    sys.stderr.write(f"jnlp {tag}: {e}\n")
                    code, headers, body = 502, {"Content-Type": "text/plain; charset=utf-8"}, \
                        "Không tải được file .jnlp từ BMC".encode("utf-8")
            self.send_response(code)
            for k, v in headers.items():
                for one in (v if isinstance(v, list) else [v]):
                    self.send_header(k, one)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def serve_error(self):
            """Trang loi IPMI cho middleware errors cua Traefik (BMC tra 502/503/504)."""
            import gw_errpage
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            port = (q.get("port") or [""])[0]
            bmc = gateway._bmc(int(port)) if port.isdigit() else None
            try:
                code, headers, body = gw_errpage.page(bmc, (q.get("status") or ["502"])[0],
                                                      (q.get("kind") or ["web"])[0])
            except Exception as e:  # khong de trang loi lam hong them
                sys.stderr.write(f"errpage {port}: {e}\n")
                code, headers, body = 200, {"Content-Type": "text/plain; charset=utf-8"}, b"Bad Gateway"
            self.send_response(code)
            for k, v in headers.items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def handle_any(self):
            if urllib.parse.urlparse(self.path).path == "/__bmcgw/error":
                return self.serve_error()
            m = re.match(r"^/auth/(\d{1,5})$", urllib.parse.urlparse(self.path).path)
            tag = (self.headers.get("X-Bmcproxy-Bmc") or "").strip()
            if not m and tag:
                return self.serve_jnlp(tag)
            if not m:
                code, headers = 404, {}
            else:
                cookie = ""
                for part in (self.headers.get("Cookie") or "").split(";"):
                    k, _, v = part.strip().partition("=")
                    if k == "proxyauthcookie":
                        cookie = v
                code, headers = gateway.check(int(m.group(1)), cookie)
            body = b"" if code == 200 else {401: b"Unauthorized", 403: b"Forbidden"}.get(
                code, b"Not found")
            self.send_response(code)
            for k, v in headers.items():
                self.send_header(k, v)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = handle_any

    return AuthHandler


def start_auth_server(gateway, host, port):
    srv = ThreadingServer((host, port), make_auth_handler(gateway))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
