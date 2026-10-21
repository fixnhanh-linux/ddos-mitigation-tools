"""Gioi han so ket noi dong thoi toi BMC (BMC co "max_conns" > 0).

Web server cua BMC (AMI/QCT, iDRAC cu...) chi chiu vai ket noi; bi dom nhieu ket noi TLS cung luc
la dong ngang (502), hong file (ERR_CONTENT_DECODING_FAILED) hoac chet han cong 443.
Traefik khong co tuy chon gioi han so ket noi toi backend, nen agent dung giua:

    Traefik --TCP--> 127.0.0.1:(20000 + cong BMC) [agent: toi da N ket noi, du thi xep hang] --> IP-BMC:443

TLS van di thang tu Traefik toi BMC (agent chi chuyen byte), Traefik khong giu ket noi ranh
(transport *-nokeep) de ket noi xong la nha cho ngay cho request dang cho.
"""

import socket
import sys
import threading
import time

from gw_common import limit_local_port, upstream_host_port

QUEUE_WAIT = 25      # giay cho toi da khi BMC dang du ket noi
CONNECT_TIMEOUT = 5


def log(msg):
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} limit: {msg}", flush=True)


class Limiter:
    def __init__(self, port, host, bmc_port, max_conns, bind_host="127.0.0.1"):
        self.port = port
        self.local = limit_local_port(port)
        self.bind_host = bind_host
        self.stats = {"active": 0, "waiting": 0, "total": 0, "rejected": 0, "errors": 0}
        self.lock = threading.Lock()
        self.update(host, bmc_port, max_conns)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((bind_host, self.local))
        self.sock.listen(128)
        self.closed = False
        threading.Thread(target=self._accept, daemon=True).start()

    def update(self, host, bmc_port, max_conns):
        with self.lock:
            self.target = (host, bmc_port)
            if getattr(self, "max_conns", None) != max_conns:
                self.max_conns = max_conns
                self.sem = threading.BoundedSemaphore(max_conns)

    def close(self):
        self.closed = True
        try:
            self.sock.close()
        except OSError:
            pass

    def _accept(self):
        while not self.closed:
            try:
                c, _ = self.sock.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(c,), daemon=True).start()

    def _count(self, k, d):
        with self.lock:
            self.stats[k] += d

    def _handle(self, client):
        sem, target = self.sem, self.target
        self._count("waiting", 1)
        got = sem.acquire(timeout=QUEUE_WAIT)
        self._count("waiting", -1)
        if not got:
            self._count("rejected", 1)
            client.close()  # Traefik bao 502 -> trang loi IPMI "BMC dong ket noi"
            return
        self._count("active", 1)
        self._count("total", 1)
        try:
            up = socket.create_connection(target, timeout=CONNECT_TIMEOUT)
        except OSError:
            self._count("errors", 1)
            self._count("active", -1)
            sem.release()
            client.close()
            return
        up.settimeout(None)
        done = threading.Event()

        def pipe(src, dst):
            try:
                while True:
                    data = src.recv(65536)
                    if not data:
                        break
                    dst.sendall(data)
            except OSError:
                pass
            finally:
                for s in (src, dst):
                    try:
                        s.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass
                done.set()

        t = threading.Thread(target=pipe, args=(up, client), daemon=True)
        t.start()
        pipe(client, up)
        t.join(timeout=60)
        for s in (client, up):
            try:
                s.close()
            except OSError:
                pass
        self._count("active", -1)
        sem.release()


class LimitManager:
    def __init__(self):
        self.items = {}
        self.lock = threading.Lock()

    def wanted(self, release):
        out = {}
        for b in (release or {}).get("bmcs", []):
            n = int(b.get("max_conns") or 0)
            if n > 0 and b.get("enabled", True):
                host, bport = upstream_host_port(b["upstream"])
                if host:
                    out[b["port"]] = (host, bport, n)
        return out

    def sync(self, *releases):
        """Bat bo gioi han cho moi BMC can trong cac ban phat hanh truyen vao, tat phan con lai."""
        want = {}
        for r in releases:
            want.update(self.wanted(r))
        errors = []
        with self.lock:
            for port in list(self.items):
                if port not in want:
                    self.items.pop(port).close()
                    log(f"tắt giới hạn BMC {port}")
            for port, (host, bport, n) in want.items():
                cur = self.items.get(port)
                if cur:
                    cur.update(host, bport, n)
                    continue
                try:
                    self.items[port] = Limiter(port, host, bport, n)
                    log(f"BMC {port}: tối đa {n} kết nối tới {host}:{bport} (nghe 127.0.0.1:{limit_local_port(port)})")
                except OSError as e:
                    errors.append(f"BMC {port}: không mở được cổng {limit_local_port(port)} ({e})")
                    sys.stderr.write(f"limit {port}: {e}\n")
        return errors

    def stats(self):
        with self.lock:
            return {str(p): {**l.stats, "max": l.max_conns} for p, l in self.items.items()}
