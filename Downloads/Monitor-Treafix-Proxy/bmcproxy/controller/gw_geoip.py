"""Tra cuu IP -> quoc gia + nha mang (ASN) bang du lieu DB-IP Lite (CC BY 4.0, https://db-ip.com), chay offline tren may web.

Web tu tai file csv.gz hang thang ve data/geoip/ (khong gui IP nguoi dung ra ngoai). Chua co du lieu: chi biet IP noi bo / cong cong.
"""

import array
import bisect
import datetime as dt
import gzip
import ipaddress
import os
import threading
import time
import urllib.request

SOURCES = {
    "country": "https://download.db-ip.com/free/dbip-country-lite-{ym}.csv.gz",
    "asn": "https://download.db-ip.com/free/dbip-asn-lite-{ym}.csv.gz",
}
MAX_AGE_DAYS = 35          # du lieu cu hon -> tai ban moi (DB-IP ra ban moi dau moi thang)
COUNTRY_NAMES = {
    "VN": "Việt Nam", "US": "Mỹ", "CN": "Trung Quốc", "SG": "Singapore", "JP": "Nhật Bản", "KR": "Hàn Quốc",
    "HK": "Hồng Kông", "TW": "Đài Loan", "TH": "Thái Lan", "MY": "Malaysia", "ID": "Indonesia", "PH": "Philippines",
    "KH": "Campuchia", "LA": "Lào", "IN": "Ấn Độ", "AU": "Úc", "DE": "Đức", "FR": "Pháp", "GB": "Anh", "NL": "Hà Lan",
    "RU": "Nga", "UA": "Ukraina", "BR": "Brazil", "CA": "Canada", "IR": "Iran", "TR": "Thổ Nhĩ Kỳ", "PL": "Ba Lan",
    "SE": "Thuỵ Điển", "FI": "Phần Lan", "IT": "Ý", "ES": "Tây Ban Nha", "BG": "Bulgaria", "RO": "Romania",
    "SC": "Seychelles", "PA": "Panama", "ZA": "Nam Phi", "MX": "Mexico", "AR": "Argentina", "PK": "Pakistan",
    "BD": "Bangladesh", "AE": "UAE", "SA": "Ả Rập Xê Út", "IL": "Israel", "CH": "Thuỵ Sĩ", "AT": "Áo", "BE": "Bỉ",
    "CZ": "Séc", "DK": "Đan Mạch", "NO": "Na Uy", "IE": "Ireland", "LT": "Litva", "MD": "Moldova", "ZZ": "Không rõ",
}


class _Table:
    """Cac khoang IP da sap xep, tim bang bisect. Luu bang array 64-bit cho nhe RAM; IPv6 chi giu 64 bit dau (/64)."""

    def __init__(self):
        self.v4s, self.v4e, self.v4v = array.array("Q"), array.array("Q"), []
        self.v6s, self.v6e, self.v6v = array.array("Q"), array.array("Q"), []

    @staticmethod
    def _key(addr):
        return int(addr) if addr.version == 4 else int(addr) >> 64

    def add(self, a, b, val):
        s, e, v = (self.v4s, self.v4e, self.v4v) if a.version == 4 else (self.v6s, self.v6e, self.v6v)
        s.append(self._key(a))
        e.append(self._key(b))
        v.append(val)

    def find(self, addr):
        s, e, v = (self.v4s, self.v4e, self.v4v) if addr.version == 4 else (self.v6s, self.v6e, self.v6v)
        n = self._key(addr)
        i = bisect.bisect_right(s, n) - 1
        if i >= 0 and n <= e[i]:
            return v[i]
        return None

    def __len__(self):
        return len(self.v4v) + len(self.v6v)


def _load_csv(path, asn):
    t = _Table()
    names = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split(",", 3 if asn else 2)
            if len(parts) < 3:
                continue
            try:
                a, b = ipaddress.ip_address(parts[0]), ipaddress.ip_address(parts[1])
            except ValueError:
                continue
            if asn:
                org = parts[3].strip('"').replace('""', '"') if len(parts) > 3 else ""
                val = names.setdefault((parts[2], org), (int(parts[2]) if parts[2].isdigit() else 0, org))
            else:
                val = names.setdefault(parts[2], parts[2])
            t.add(a, b, val)
    return t


class GeoIP:
    def __init__(self, data_dir, log=print):
        self.dir = os.path.join(data_dir, "geoip")
        self.log = log
        self.lock = threading.Lock()
        self.country = None
        self.asn = None
        self.info = {"country": None, "asn": None}   # {file, date, rows}
        self.cache = {}
        self.busy = False
        self.error = ""

    # ------------------------------------------------------------ du lieu
    def _path(self, kind):
        return os.path.join(self.dir, f"dbip-{kind}-lite.csv.gz")

    def load(self):
        for kind in ("country", "asn"):
            p = self._path(kind)
            if not os.path.exists(p):
                continue
            try:
                t0 = time.time()
                tbl = _load_csv(p, kind == "asn")
                with self.lock:
                    setattr(self, kind, tbl)
                    self.info[kind] = {"date": dt.datetime.fromtimestamp(os.path.getmtime(p)).isoformat(timespec="minutes"),
                                       "rows": len(tbl), "size": os.path.getsize(p)}
                    self.cache.clear()
                self.log(f"geoip: đã nạp {kind} ({len(tbl)} khoảng IP, {time.time() - t0:.1f} giây)")
            except (OSError, EOFError, ValueError) as e:
                self.error = f"{kind}: {e}"
                self.log(f"geoip: lỗi đọc {p}: {e}")

    def outdated(self):
        for kind in ("country", "asn"):
            p = self._path(kind)
            if not os.path.exists(p) or time.time() - os.path.getmtime(p) > MAX_AGE_DAYS * 86400:
                return True
        return False

    def download(self):
        """Tai ban moi nhat (thang nay, khong co thi thang truoc). Tra ve thong bao."""
        if self.busy:
            return "đang tải"
        self.busy = True
        try:
            os.makedirs(self.dir, exist_ok=True)
            today = dt.date.today()
            months = [today.strftime("%Y-%m"), (today.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")]
            got = []
            for kind, url in SOURCES.items():
                last = ""
                for ym in months:
                    try:
                        req = urllib.request.Request(url.format(ym=ym), headers={"User-Agent": "bmcproxy-geoip/1"})
                        with urllib.request.urlopen(req, timeout=120) as r:
                            data = r.read()
                        if len(data) < 1000 or data[:2] != b"\x1f\x8b":
                            raise ValueError("file tải về không phải csv.gz")
                        tmp = self._path(kind) + ".tmp"
                        with open(tmp, "wb") as f:
                            f.write(data)
                        os.replace(tmp, self._path(kind))
                        got.append(f"{kind} {ym}")
                        last = ""
                        break
                    except (OSError, ValueError) as e:
                        last = f"{kind}: {e}"
                if last:
                    self.error = last
            if got:
                self.error = ""
                self.load()
            return ("đã tải " + ", ".join(got)) if got else f"không tải được ({self.error})"
        finally:
            self.busy = False

    def start(self, auto_download=True):
        """Nap du lieu dang co roi (neu cu / chua co) tai ban moi - chay nen, khong cham khoi dong web."""
        def run():
            self.load()
            while True:
                if auto_download and self.outdated():
                    msg = self.download()
                    self.log(f"geoip: {msg}")
                time.sleep(6 * 3600)
        threading.Thread(target=run, name="geoip", daemon=True).start()

    def ranges(self, codes):
        """Cac dai IP (khoa 64-bit nhu _Table) cua cac nuoc -> gui agent loc quoc gia. Gop dai lien nhau."""
        codes = sorted({c.upper() for c in codes})
        with self.lock:
            tbl, date = self.country, (self.info["country"] or {}).get("date", "")
        if not tbl or not codes:
            return None
        key = (tuple(codes), date)
        hit = getattr(self, "_ranges_cache", None)
        if hit and hit[0] == key:
            return hit[1]
        want = set(codes)
        out = {}
        for name, s, e, v in (("v4", tbl.v4s, tbl.v4e, tbl.v4v), ("v6", tbl.v6s, tbl.v6e, tbl.v6v)):
            merged = []
            for i, cc in enumerate(v):
                if cc in want:
                    a, b = s[i], e[i]
                    if merged and a <= merged[-1][1] + 1:
                        merged[-1][1] = max(merged[-1][1], b)
                    else:
                        merged.append([a, b])
            out[name] = merged
        out["id"] = f"{','.join(codes)}@{date}"
        self._ranges_cache = (key, out)
        return out

    def status(self):
        with self.lock:
            return {"ready": bool(self.country), "country": self.info["country"], "asn": self.info["asn"],
                    "busy": self.busy, "error": self.error, "source": "DB-IP Lite (CC BY 4.0)"}

    # ------------------------------------------------------------ tra cuu
    def lookup(self, ip):
        ip = (ip or "").strip()
        hit = self.cache.get(ip)
        if hit is not None:
            return hit
        out = {"cc": "", "country": "", "asn": 0, "org": "", "scope": "public"}
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            out["scope"] = "unknown"
            return out
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            out.update(scope="private", country="Nội bộ")
        else:
            with self.lock:
                c, a = self.country, self.asn
            cc = c.find(addr) if c else None
            if cc:
                out.update(cc=cc, country=COUNTRY_NAMES.get(cc, cc))
            hit_asn = a.find(addr) if a else None
            if hit_asn:
                out.update(asn=hit_asn[0], org=hit_asn[1])
        if len(self.cache) > 20000:
            self.cache.clear()
        self.cache[ip] = out
        return out
