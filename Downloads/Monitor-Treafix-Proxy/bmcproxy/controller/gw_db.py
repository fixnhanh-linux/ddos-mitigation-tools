"""Luu du lieu web (controller) vao MySQL thay cho file JSON (tuy chon).

config.json:
    "db": {"type": "mysql", "host": "103.48.194.52", "port": 3306, "user": "bmcproxy",
           "password_file": "/etc/bmcproxy/db.pass", "database": "bmcproxy",
           "ssl": true, "ssl_verify": false, "ssl_ca": ""}
    ssl true = ma hoa ket noi (MySQL 8 co san TLS). ssl_verify + ssl_ca = kiem tra chung chi MySQL (CA rieng).

Moi "file" cu (bmc.json, sites.json, users.json...) la 1 dong trong bang bmcproxy_docs (JSON + so phien ban),
nhat ky nam o bang bmcproxy_audit; ban cau hinh da phat hanh (release), ban sao luu, phien dang nhap
nam o bang bmcproxy_blobs (kind + name). "type": "sqlite" (+ "path") dung de thu nghiem khong can MySQL.
Can thu vien PyMySQL:  apt install -y python3-pymysql
"""

import json
import os
import threading

from gw_common import ValidationError

DOCS = "bmcproxy_docs"
AUDIT = "bmcproxy_audit"
BLOBS = "bmcproxy_blobs"


def db_password(c):
    if c.get("password_file"):
        try:
            with open(c["password_file"], encoding="utf-8") as f:
                return f.read().strip()
        except OSError as e:
            raise ValidationError(f"Không đọc được file mật khẩu MySQL {c['password_file']}: {e}")
    return os.environ.get("BMCPROXY_DB_PASSWORD") or c.get("password", "")


class DocDB:
    def __init__(self, cfg):
        self.cfg = dict(cfg)
        self.kind = self.cfg.get("type", "mysql")
        if self.kind not in ("mysql", "sqlite"):
            raise ValidationError(f"db.type không hỗ trợ: {self.kind}")
        self.lock = threading.RLock()
        self.conn = None
        self.ph = "%s" if self.kind == "mysql" else "?"

    def describe(self):
        c = self.cfg
        if self.kind == "sqlite":
            return f"sqlite {c.get('path')}"
        return f"mysql {c.get('user')}@{c.get('host')}:{c.get('port', 3306)}/{c.get('database', 'bmcproxy')}"

    # ------------------------------------------------------------ ket noi
    def _connect(self):
        c = self.cfg
        if self.kind == "sqlite":
            import sqlite3
            conn = sqlite3.connect(c.get("path") or "bmcproxy.db", check_same_thread=False, timeout=10)
            conn.isolation_level = None  # autocommit
            return conn
        try:
            import pymysql
        except ImportError:
            raise ValidationError("Thiếu thư viện PyMySQL: sudo apt install -y python3-pymysql")
        kw = dict(host=c.get("host", "127.0.0.1"), port=int(c.get("port", 3306)), user=c.get("user", "bmcproxy"),
                  password=db_password(c), database=c.get("database", "bmcproxy"), charset="utf8mb4",
                  autocommit=True, connect_timeout=int(c.get("connect_timeout", 5)),
                  read_timeout=int(c.get("read_timeout", 15)), write_timeout=int(c.get("read_timeout", 15)))
        if c.get("ssl"):
            import ssl
            ctx = ssl.create_default_context(cafile=c.get("ssl_ca") or None)
            if not c.get("ssl_verify", True):
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
            kw["ssl"] = ctx
        return pymysql.connect(**kw)

    def _exec(self, sql, args=(), fetch=False):
        """Chay 1 cau lenh; mat ket noi thi noi lai 1 lan."""
        with self.lock:
            for attempt in (1, 2):
                try:
                    if self.conn is None:
                        self.conn = self._connect()
                    cur = self.conn.cursor()
                    try:
                        cur.execute(sql, args)
                        return cur.fetchall() if fetch else cur.rowcount
                    finally:
                        cur.close()
                except ValidationError:
                    raise
                except Exception:
                    try:
                        if self.conn is not None:
                            self.conn.close()
                    except Exception:
                        pass
                    self.conn = None
                    if attempt == 2:
                        raise

    # ------------------------------------------------------------ bang
    def init_schema(self):
        if self.kind == "mysql":
            self._exec(f"""CREATE TABLE IF NOT EXISTS {DOCS} (
                name VARCHAR(64) NOT NULL PRIMARY KEY,
                data LONGTEXT NOT NULL,
                version BIGINT NOT NULL DEFAULT 1,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
            self._exec(f"""CREATE TABLE IF NOT EXISTS {AUDIT} (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ts VARCHAR(32) NOT NULL,
                user VARCHAR(64) NOT NULL DEFAULT '',
                action VARCHAR(64) NOT NULL DEFAULT '',
                site VARCHAR(64) NOT NULL DEFAULT '',
                detail TEXT,
                ip VARCHAR(64) NOT NULL DEFAULT '',
                ua VARCHAR(80) NOT NULL DEFAULT '',
                KEY idx_ts (ts)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
            self._exec(f"""CREATE TABLE IF NOT EXISTS {BLOBS} (
                kind VARCHAR(16) NOT NULL,
                name VARCHAR(160) NOT NULL,
                data LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (kind, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
        else:
            self._exec(f"CREATE TABLE IF NOT EXISTS {DOCS} (name TEXT PRIMARY KEY, data TEXT NOT NULL, "
                       "version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)")
            self._exec(f"CREATE TABLE IF NOT EXISTS {AUDIT} (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, "
                       "user TEXT NOT NULL DEFAULT '', action TEXT NOT NULL DEFAULT '', site TEXT NOT NULL DEFAULT '', "
                       "detail TEXT, ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '')")
            self._exec(f"CREATE TABLE IF NOT EXISTS {BLOBS} (kind TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL, "
                       "updated_at TEXT NOT NULL, PRIMARY KEY (kind, name))")

        self._add_audit_columns()

    def _add_audit_columns(self):
        """Bang nhat ky tao tu ban cu (chua co cot ip / ua) -> them cot."""
        if self.kind == "mysql":
            have = {r[0].lower() for r in self._exec(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                f"AND TABLE_NAME = '{AUDIT}'", fetch=True)}
            for col, ddl in (("ip", "VARCHAR(64) NOT NULL DEFAULT ''"), ("ua", "VARCHAR(80) NOT NULL DEFAULT ''")):
                if col not in have:
                    self._exec(f"ALTER TABLE {AUDIT} ADD COLUMN {col} {ddl}")
        else:
            have = {r[1].lower() for r in self._exec(f"PRAGMA table_info({AUDIT})", fetch=True)}
            for col in ("ip", "ua"):
                if col not in have:
                    self._exec(f"ALTER TABLE {AUDIT} ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")

    # ------------------------------------------------------------ tai lieu
    def versions(self):
        return {r[0]: int(r[1]) for r in self._exec(f"SELECT name, version FROM {DOCS}", fetch=True)}

    def load_all(self):
        out = {}
        for name, data, version in self._exec(f"SELECT name, data, version FROM {DOCS}", fetch=True):
            try:
                out[name] = (json.loads(data), int(version))
            except ValueError:
                pass
        return out

    def save(self, name, obj):
        data = json.dumps(obj, ensure_ascii=False, sort_keys=True)
        p = self.ph
        if self.kind == "mysql":
            self._exec(f"INSERT INTO {DOCS} (name, data, version, updated_at) VALUES ({p}, {p}, 1, NOW()) "
                       "ON DUPLICATE KEY UPDATE data = VALUES(data), version = version + 1, updated_at = NOW()",
                       (name, data))
        else:
            self._exec(f"INSERT INTO {DOCS} (name, data, version, updated_at) VALUES ({p}, {p}, 1, datetime('now')) "
                       "ON CONFLICT(name) DO UPDATE SET data = excluded.data, version = version + 1, "
                       "updated_at = datetime('now')", (name, data))
        rows = self._exec(f"SELECT version FROM {DOCS} WHERE name = {p}", (name,), fetch=True)
        return int(rows[0][0]) if rows else None

    # ------------------------------------------------------------ blob (release / sao luu / phien)
    def blob_put(self, kind, name, obj):
        data = json.dumps(obj, ensure_ascii=False, sort_keys=True)
        p = self.ph
        if self.kind == "mysql":
            self._exec(f"INSERT INTO {BLOBS} (kind, name, data, updated_at) VALUES ({p}, {p}, {p}, NOW()) "
                       "ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()", (kind, name, data))
        else:
            self._exec(f"INSERT INTO {BLOBS} (kind, name, data, updated_at) VALUES ({p}, {p}, {p}, datetime('now')) "
                       "ON CONFLICT(kind, name) DO UPDATE SET data = excluded.data, updated_at = datetime('now')",
                       (kind, name, data))

    def blob_get(self, kind, name, default=None):
        p = self.ph
        rows = self._exec(f"SELECT data FROM {BLOBS} WHERE kind = {p} AND name = {p}", (kind, name), fetch=True)
        try:
            return json.loads(rows[0][0]) if rows else default
        except ValueError:
            return default

    def blob_names(self, kind, prefix=""):
        p = self.ph
        rows = self._exec(f"SELECT name FROM {BLOBS} WHERE kind = {p} AND name LIKE {p} ORDER BY name",
                          (kind, prefix.replace("%", "").replace("_", "\\_") + "%"), fetch=True)
        return [r[0] for r in rows]

    def blob_delete(self, kind, name):
        p = self.ph
        self._exec(f"DELETE FROM {BLOBS} WHERE kind = {p} AND name = {p}", (kind, name))

    def blob_counts(self):
        return {r[0]: int(r[1]) for r in self._exec(f"SELECT kind, COUNT(*) FROM {BLOBS} GROUP BY kind", fetch=True)}

    # ------------------------------------------------------------ nhat ky
    def audit_add(self, rec):
        p = self.ph
        self._exec(f"INSERT INTO {AUDIT} (ts, user, action, site, detail, ip, ua) "
                   f"VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p})",
                   (rec["ts"], rec.get("user", "")[:64], rec.get("action", "")[:64], rec.get("site", "")[:64],
                    str(rec.get("detail", "")), str(rec.get("ip") or "")[:64], str(rec.get("ua") or "")[:80]))

    def audit_read(self, limit=500):
        rows = self._exec(f"SELECT ts, user, action, site, detail, ip, ua FROM {AUDIT} ORDER BY id DESC "
                          f"LIMIT {int(limit)}", fetch=True)
        return [{"ts": r[0], "user": r[1], "action": r[2], "site": r[3], "detail": r[4] or "", "ip": r[5] or "",
                 "ua": r[6] or ""} for r in rows]

    def audit_count(self):
        return int(self._exec(f"SELECT COUNT(*) FROM {AUDIT}", fetch=True)[0][0])
