"""Canh bao qua Telegram / email.

Moi 60 giay doc trang thai (site mat lien lac, BMC mat ket noi, BMC sap het han) va chi bao khi trang thai
DOI (mat -> bao 1 lan, co lai -> bao "da on"). Su kien tuc thi (ap dung loi, khoa tai khoan, cap nhat agent)
goi notifier.event(...). Lan quet dau tien sau khi web khoi dong chi ghi nhan, khong bao (tranh bao don dap).
"""
import json
import queue
import re
import smtplib
import ssl
import threading
import time
import traceback
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from gw_common import ValidationError, now_iso

EVENTS = {
    "site_offline": "Site mất liên lạc / kết nối lại",
    "bmc_down": "BMC mất kết nối / kết nối lại",
    "bmc_expiring": "BMC sắp hết hạn (tóm tắt mỗi ngày lúc 8 giờ)",
    "apply_failed": "Áp dụng cấu hình lỗi",
    "login_locked": "Tài khoản bị khoá do sai mật khẩu nhiều lần",
    "agent_update": "Kết quả cập nhật agent",
}
NOTIFY_DEFAULTS = {
    "telegram": {"enabled": False, "bot_token": "", "chat_id": "", "api": "https://api.telegram.org"},
    "email": {"enabled": False, "host": "", "port": 587, "security": "starttls", "user": "", "password": "",
              "from": "", "to": ""},
    "events": {k: True for k in EVENTS},
    "bmc_down_minutes": 3,     # BMC mat ket noi lien tuc bao lau moi bao (tranh bao khi chap chon)
    "prefix": "Treafix Proxy BB",
}
SECRETS = (("telegram", "bot_token"), ("email", "password"))


def _bool(v):
    return v if isinstance(v, bool) else str(v).lower() in ("1", "true", "on", "yes")


def merged(cfg):
    c = json.loads(json.dumps(NOTIFY_DEFAULTS))
    for k, v in (cfg or {}).items():
        if isinstance(v, dict) and isinstance(c.get(k), dict):
            c[k].update(v)
        elif k in c:
            c[k] = v
    return c


def validate(data, old=None):
    old = merged(old)
    c = merged(old)
    tg, em = data.get("telegram") or {}, data.get("email") or {}
    c["telegram"]["enabled"] = _bool(tg.get("enabled", old["telegram"]["enabled"]))
    c["telegram"]["chat_id"] = str(tg.get("chat_id", old["telegram"]["chat_id"]) or "").strip()[:64]
    if tg.get("bot_token"):
        c["telegram"]["bot_token"] = str(tg["bot_token"]).strip()[:200]
    c["email"]["enabled"] = _bool(em.get("enabled", old["email"]["enabled"]))
    for k in ("host", "user", "from", "to"):
        c["email"][k] = str(em.get(k, old["email"][k]) or "").strip()[:300]
    if em.get("password"):
        c["email"]["password"] = str(em["password"])[:200]
    try:
        c["email"]["port"] = int(em.get("port", old["email"]["port"]) or 587)
    except (TypeError, ValueError):
        raise ValidationError("Cổng SMTP là số")
    c["email"]["security"] = str(em.get("security", old["email"]["security"]))
    if c["email"]["security"] not in ("starttls", "ssl", "none"):
        raise ValidationError("Bảo mật SMTP: starttls / ssl / none")
    ev = data.get("events") or {}
    c["events"] = {k: _bool(ev.get(k, old["events"].get(k, True))) for k in EVENTS}
    try:
        c["bmc_down_minutes"] = max(1, min(60, int(data.get("bmc_down_minutes", old["bmc_down_minutes"]))))
    except (TypeError, ValueError):
        raise ValidationError("Số phút BMC mất kết nối là số 1–60")
    c["prefix"] = str(data.get("prefix", old["prefix"]) or "Treafix Proxy BB").strip()[:60]
    if c["telegram"]["enabled"]:
        if not re.fullmatch(r"\d{5,20}:[A-Za-z0-9_-]{20,100}", c["telegram"]["bot_token"]):
            raise ValidationError("Telegram: bot token dạng 123456789:ABC... (lấy từ @BotFather)")
        if not re.fullmatch(r"-?\d{3,20}|@[A-Za-z0-9_]{4,64}", c["telegram"]["chat_id"]):
            raise ValidationError("Telegram: chat id là số (nhóm: số âm, vd -1001234567890) hoặc @tenkenh")
    if c["email"]["enabled"]:
        if not c["email"]["host"] or not c["email"]["to"]:
            raise ValidationError("Email: nhập máy chủ SMTP và người nhận")
        if not re.fullmatch(r"[^@\s,]+@[^@\s,]+(\s*,\s*[^@\s,]+@[^@\s,]+)*", c["email"]["to"]):
            raise ValidationError("Email người nhận sai (nhiều người cách nhau dấu phẩy)")
    return c


def public_view(cfg):
    c = merged(cfg)
    for sec, key in SECRETS:
        c[sec]["has_" + key] = bool(c[sec].pop(key, ""))
    return {**c, "event_names": EVENTS}


# ---------------------------------------------------------------- gui
def send_telegram(c, text, timeout=10):
    t = c["telegram"]
    url = f"{t.get('api') or 'https://api.telegram.org'}/bot{t['bot_token']}/sendMessage"
    body = urllib.parse.urlencode({"chat_id": t["chat_id"], "text": text[:4000],
                                   "disable_web_page_preview": "true"}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read() or b"{}")
        except ValueError:
            data = {}
        raise OSError(f"Telegram {e.code}: {data.get('description') or e.reason}")
    if not data.get("ok"):
        raise OSError(f"Telegram: {data.get('description') or data}")


def send_email(c, subject, text, timeout=15):
    e = c["email"]
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = e["from"] or e["user"]
    msg["To"] = e["to"]
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid("bmcproxy")
    msg.set_content(text)
    ctx = ssl.create_default_context()
    if e["security"] == "ssl":
        srv = smtplib.SMTP_SSL(e["host"], int(e["port"]), timeout=timeout, context=ctx)
    else:
        srv = smtplib.SMTP(e["host"], int(e["port"]), timeout=timeout)
    try:
        if e["security"] == "starttls":
            srv.starttls(context=ctx)
        if e["user"]:
            srv.login(e["user"], e["password"])
        srv.send_message(msg)
    finally:
        try:
            srv.quit()
        except Exception:
            pass


def deliver(c, title, text):
    """Gui ngay qua moi kenh dang bat -> {kenh: "ok" | loi}."""
    out = {}
    full = f"[{c['prefix']}] {title}\n{text}".strip()
    if c["telegram"]["enabled"]:
        try:
            send_telegram(c, full)
            out["telegram"] = "ok"
        except Exception as ex:
            out["telegram"] = f"{type(ex).__name__}: {ex}"
    if c["email"]["enabled"]:
        try:
            send_email(c, f"[{c['prefix']}] {title}", text or title)
            out["email"] = "ok"
        except Exception as ex:
            out["email"] = f"{type(ex).__name__}: {ex}"
    return out


class Notifier:
    """Chay nen trong web. get_cfg() -> cau hinh hien tai; snapshot() -> trang thai de so sanh."""

    def __init__(self, get_cfg, snapshot, on_result=None, interval=60):
        self.get_cfg = get_cfg
        self.snapshot = snapshot
        self.on_result = on_result or (lambda *a: None)
        self.interval = interval
        self.q = queue.Queue(maxsize=500)
        self.state = None          # key -> True (dang loi)
        self.since = {}            # key -> luc bat dau loi
        self.last_digest = ""      # ngay da gui tom tat het han
        self.sent = []             # 30 thong bao gan nhat (hien tren web)

    def start(self):
        threading.Thread(target=self._send_loop, daemon=True, name="notify-send").start()
        threading.Thread(target=self._watch_loop, daemon=True, name="notify-watch").start()

    def enabled(self, kind):
        c = merged(self.get_cfg())
        return (c["telegram"]["enabled"] or c["email"]["enabled"]) and c["events"].get(kind, True)

    def event(self, kind, title, text=""):
        if not self.enabled(kind):
            return
        try:
            self.q.put_nowait((kind, title, text))
        except queue.Full:
            pass

    def _send_loop(self):
        while True:
            kind, title, text = self.q.get()
            try:
                res = deliver(merged(self.get_cfg()), title, text)
            except Exception as ex:
                res = {"error": f"{type(ex).__name__}: {ex}"}
            self.sent.insert(0, {"at": now_iso(), "kind": kind, "title": title, "result": res})
            del self.sent[30:]
            self.on_result(kind, title, res)

    def _watch_loop(self):
        while True:
            try:
                self.check()
            except Exception:
                traceback.print_exc()
            time.sleep(self.interval)

    def check(self, now=None):
        """So trang thai hien tai voi lan truoc -> su kien. Tra ve danh sach (kind, title, text) da xep hang."""
        now = now or time.time()
        c = merged(self.get_cfg())
        snap = self.snapshot()
        cur = {}
        for s in snap["sites"]:
            if s["token_set"] and s["seen"]:
                cur[("site", s["key"])] = (not s["online"], s)
            for b in s["bmcs"]:
                cur[("bmc", s["key"], b["port"])] = (b["down"], {**b, "site": s["key"], "site_label": s["label"],
                                                                 "maint": b.get("maint") or s.get("maint")})
        events = []
        first = self.state is None
        prev = self.state or {}
        new_state = {}
        for key, (bad, info) in cur.items():
            was = prev.get(key, False)
            if info.get("maint"):  # dang bao tri: khong bao, giu trang thai cu (het bao tri ma van loi -> bao)
                new_state[key] = was
                continue
            if bad and key not in self.since:
                self.since[key] = now
            if not bad:
                self.since.pop(key, None)
            if key[0] == "bmc":  # chi tinh la loi sau N phut lien tuc
                bad = bad and now - self.since.get(key, now) >= c["bmc_down_minutes"] * 60
            new_state[key] = bad
            if first or bad == was:
                continue
            if key[0] == "site":
                events.append(("site_offline",
                               f"🔴 Site {info['label']} mất liên lạc" if bad else f"🟢 Site {info['label']} đã kết nối lại",
                               f"Agent {info['key']} ({info.get('hostname') or '?'}) "
                               + ("không báo về web." if bad else "báo về bình thường.")))
            else:
                where = f"{info['site_label']} · cổng {info['port']}" + (f" · {info['note']}" if info.get("note") else "")
                events.append(("bmc_down", f"🔴 BMC mất kết nối: {where}" if bad else f"🟢 BMC kết nối lại: {where}",
                               f"{info.get('upstream', '')}" + (f"\n{info['error']}" if bad and info.get("error") else "")))
        self.state = new_state
        for k in [k for k in self.since if k not in cur]:
            del self.since[k]
        # tom tat BMC sap het han: 1 lan / ngay, tu 8 gio
        lt = time.localtime(now)
        today = time.strftime("%Y-%m-%d", lt)
        if not first and lt.tm_hour >= 8 and self.last_digest != today:
            self.last_digest = today
            items = snap.get("expiring") or []
            if items:
                events.append(("bmc_expiring", f"⏰ {len(items)} BMC hết hạn trong 7 ngày",
                               "\n".join(f"- {x['site']} · cổng {x['port']} · {x['expires']}"
                                         + (f" · {x['note']}" if x.get("note") else "") for x in items[:40])))
        elif first:
            self.last_digest = today if lt.tm_hour >= 8 else ""
        for ev in events:
            self.event(*ev)
        return events
