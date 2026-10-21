"""Dang nhap bang tai khoan cong ty (Active Directory / LDAP).

Can thu vien ldap3 (Ubuntu: apt install python3-ldap3). Khong co ldap3 thi web van chay, chi tat dang nhap AD.

Luong dang nhap:
  - co tai khoan dich vu (bind_dn): bind dich vu -> tim user -> bind lai bang mat khau user
  - khong co: bind thang bang user@domain (AD) hoac user_dn_template (LDAP) roi doc thong tin chinh user do
  - nhom (memberOf, nhom long nhau cua AD, nhom member/uniqueMember/memberUid cua OpenLDAP) -> vai tro + site
"""
import re
import ssl

try:
    import ldap3
    from ldap3.core.exceptions import LDAPException
    from ldap3.utils.conv import escape_filter_chars
    from ldap3.utils.dn import escape_rdn
except ImportError:  # pragma: no cover - web van chay, chi tat AD
    ldap3 = None

    class LDAPException(Exception):
        pass

from gw_common import RE_USER, ValidationError

ROLES_ORDER = ("admin", "operator", "viewer")
LDAP_DEFAULTS = {
    "enabled": False,
    "mode": "ad",                 # ad | ldap
    "servers": "",                # ldaps://dc01.cty.local ldaps://dc02.cty.local (dong / dau cach / dau phay)
    "starttls": False,            # ldap:// + StartTLS
    "verify_tls": True,
    "ca_file": "",                # file CA noi bo tren server web (.pem / .crt)
    "domain": "",                 # AD: cty.local -> dang nhap bang user@cty.local
    "base_dn": "",                # de trong (AD) = tu suy ra tu domain
    "user_filter": "",            # de trong = mac dinh theo mode
    "user_dn_template": "",       # LDAP khong co tai khoan dich vu: uid={user},ou=people,dc=cty,dc=local
    "bind_dn": "",                # tai khoan dich vu (khong bat buoc)
    "bind_password": "",
    "group_admin": "",            # ten nhom (CN) hoac DN, nhieu nhom cach nhau dau phay / xuong dong
    "group_operator": "",
    "group_viewer": "",
    "site_groups": "",            # moi dong: Nhom = hcm, hn
    "default_role": "",           # "" = khong thuoc nhom nao thi tu choi
    "nested": True,               # AD: tinh ca nhom long nhau
    "timeout": 5,
}
DEFAULT_FILTER = {"ad": "(&(objectClass=user)(sAMAccountName={user}))",
                  "ldap": "(|(uid={user})(cn={user}))"}
AD_NESTED_OID = "1.2.840.113556.1.4.1941"


class LdapError(Exception):
    """kind: bad (sai tai khoan / mat khau), denied (khong thuoc nhom), down (khong ket noi duoc), config."""

    def __init__(self, msg, kind="config"):
        super().__init__(msg)
        self.kind = kind


def available():
    return ldap3 is not None


def _bool(v):
    return v if isinstance(v, bool) else str(v).lower() in ("1", "true", "on", "yes")


def server_urls(cfg):
    return [u for u in re.split(r"[\s,;]+", cfg.get("servers") or "") if u]


def split_groups(text):
    """'A, B' -> [A, B]; DN (co dau =) thi chi tach theo xuong dong / dau cham phay."""
    out = []
    for part in re.split(r"[\n;]+", text or ""):
        part = part.strip()
        if not part:
            continue
        out.extend([part] if "=" in part else [p.strip() for p in part.split(",") if p.strip()])
    return out


def parse_site_groups(text):
    """'NOC-HCM = hcm, hn' moi dong -> [(nhom, [site...])]."""
    out = []
    for i, line in enumerate((text or "").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValidationError(f"Nhóm → site dòng {i}: dạng `Tên nhóm = hcm, hn`")
        g, sites = line.rsplit("=", 1)
        sites = [s.strip() for s in sites.split(",") if s.strip()]
        if not g.strip() or not sites:
            raise ValidationError(f"Nhóm → site dòng {i}: thiếu tên nhóm hoặc site")
        out.append((g.strip(), sites))
    return out


def domain_base(domain):
    return ",".join(f"dc={p}" for p in (domain or "").split(".") if p)


def validate(data, old=None, site_keys=()):
    old = {**LDAP_DEFAULTS, **(old or {})}
    c = {}
    for k, dv in LDAP_DEFAULTS.items():
        v = data.get(k, old[k])
        if isinstance(dv, bool):
            c[k] = _bool(v)
        elif isinstance(dv, int):
            try:
                c[k] = max(1, min(30, int(v)))
            except (TypeError, ValueError):
                raise ValidationError("Timeout AD là số giây 1–30")
        else:
            c[k] = str(v or "").strip()[:4000]
    if not str(data.get("bind_password") or ""):  # o trong = giu mat khau cu
        c["bind_password"] = old["bind_password"]
    if data.get("clear_bind_password"):
        c["bind_password"] = ""
    if c["mode"] not in DEFAULT_FILTER:
        raise ValidationError("Loại máy chủ: ad hoặc ldap")
    if c["default_role"] not in ("",) + ROLES_ORDER:
        raise ValidationError("Vai trò mặc định không hợp lệ")
    for u in server_urls(c):
        if not re.fullmatch(r"ldaps?://[A-Za-z0-9.\-\[\]:]+(:\d{1,5})?/?", u):
            raise ValidationError(f"Địa chỉ máy chủ AD sai: {u} (vd ldaps://dc01.cty.local)")
    for name, sites in parse_site_groups(c["site_groups"]):
        bad = [s for s in sites if s not in site_keys]
        if site_keys and bad:
            raise ValidationError(f"Nhóm {name}: không có site {', '.join(bad)}")
    if c["enabled"]:
        if not available():
            raise ValidationError("Server web chưa có thư viện ldap3: chạy `sudo apt install -y python3-ldap3` rồi restart web")
        if not server_urls(c):
            raise ValidationError("Nhập địa chỉ máy chủ AD / LDAP")
        if c["mode"] == "ad" and not (c["domain"] or c["bind_dn"]):
            raise ValidationError("AD: nhập tên miền (vd cty.local)")
        if c["mode"] == "ldap" and not (c["user_dn_template"] or c["bind_dn"]):
            raise ValidationError("LDAP: nhập mẫu DN người dùng hoặc tài khoản dịch vụ")
        if c["bind_dn"] and not c["bind_password"]:
            raise ValidationError("Nhập mật khẩu tài khoản dịch vụ")
        if not (c["base_dn"] or (c["mode"] == "ad" and c["domain"])):
            raise ValidationError("Nhập Base DN (vd dc=cty,dc=local)")
        if not any(c[k] for k in ("group_admin", "group_operator", "group_viewer")) and not c["default_role"]:
            raise ValidationError("Chọn ít nhất 1 nhóm AD cho vai trò, hoặc vai trò mặc định")
    return c


def public_view(cfg):
    c = {**LDAP_DEFAULTS, **(cfg or {})}
    has = bool(c.pop("bind_password", ""))
    return {**c, "has_bind_password": has, "available": available()}


def normalize_user(raw):
    """'CTY\\khai.tq' / 'khai.tq@cty.local' / 'Khai.TQ' -> 'khai.tq'."""
    s = str(raw or "").strip()
    if "\\" in s:
        s = s.split("\\", 1)[1]
    if "@" in s:
        s = s.split("@", 1)[0]
    s = s.lower()
    return s if RE_USER.match(s) else ""


# ---------------------------------------------------------------- ket noi
def _servers(cfg):
    t = int(cfg.get("timeout") or 5)
    tls = ldap3.Tls(validate=ssl.CERT_REQUIRED if cfg.get("verify_tls", True) else ssl.CERT_NONE,
                    ca_certs_file=cfg.get("ca_file") or None)
    servers = [ldap3.Server(u, use_ssl=u.lower().startswith("ldaps://"), tls=tls, get_info=ldap3.NONE,
                            connect_timeout=t) for u in server_urls(cfg)]
    if len(servers) == 1:
        return servers[0]
    return ldap3.ServerPool(servers, ldap3.FIRST, active=1, exhaust=False)


def _bind(server, cfg, who, password, strategy=None):
    """-> Connection da bind. Sai mat khau -> LdapError(bad)."""
    if not password:  # bind voi mat khau rong = "unauthenticated bind" -> AD van bao thanh cong!
        raise LdapError("Sai tài khoản hoặc mật khẩu", "bad")
    try:
        conn = ldap3.Connection(server, user=who, password=password, authentication=ldap3.SIMPLE,
                                read_only=True, auto_referrals=False, raise_exceptions=False,
                                receive_timeout=int(cfg.get("timeout") or 5),
                                client_strategy=strategy or ldap3.SYNC)
        conn.open()
        if cfg.get("starttls") and not conn.server.ssl:
            if not conn.start_tls():
                raise LdapError(f"StartTLS lỗi: {conn.result.get('description')}", "down")
        if conn.bind():
            return conn
        desc = (conn.result or {}).get("description", "")
        msg = (conn.result or {}).get("message", "")
        conn.unbind()
    except LdapError:
        raise
    except LDAPException as e:
        raise LdapError(f"Không kết nối được máy chủ AD/LDAP: {type(e).__name__}: {e}", "down")
    except (OSError, ssl.SSLError) as e:
        raise LdapError(f"Không kết nối được máy chủ AD/LDAP: {e}", "down")
    if desc == "invalidCredentials":
        # AD: data 532 = mat khau het han, 533 = bi khoa, 701/775 = het han / khoa
        for code, why in (("532", "mật khẩu AD đã hết hạn, đổi trên Windows trước"),
                          ("533", "tài khoản AD đã bị tắt"), ("701", "tài khoản AD đã hết hạn"),
                          ("773", "AD yêu cầu đổi mật khẩu, đổi trên Windows trước"),
                          ("775", "tài khoản AD đang bị khoá")):
            if f"data {code}" in msg:
                raise LdapError(f"Không đăng nhập được: {why}", "bad")
        raise LdapError("Sai tài khoản hoặc mật khẩu", "bad")
    raise LdapError(f"Máy chủ AD/LDAP từ chối: {desc} {msg}".strip(), "down" if desc in ("unavailable", "busy") else "config")


def _first(entry, attr):
    v = entry.get("attributes", {}).get(attr)
    if isinstance(v, list):
        v = v[0] if v else ""
    return str(v or "")


def _cn(dn):
    m = re.match(r"\s*cn=((?:\\.|[^,])+)", dn or "", re.I)
    return (m.group(1) if m else dn or "").replace("\\", "").strip()


def _group_hit(wanted, groups):
    """wanted: danh sach ten nhom / DN trong cai dat; groups: DN nhom cua user."""
    gl = {g.lower() for g in groups} | {_cn(g).lower() for g in groups}
    return [w for w in wanted if w.lower() in gl]


def authenticate(cfg, raw_user, password, server=None, strategy=None):
    """-> {name, full_name, email, dn, groups, role, sites, matched}. Loi -> LdapError."""
    cfg = {**LDAP_DEFAULTS, **(cfg or {})}
    if not available():
        raise LdapError("Server web chưa cài ldap3 (apt install python3-ldap3)", "config")
    name = normalize_user(raw_user)
    if not name:
        raise LdapError("Sai tài khoản hoặc mật khẩu", "bad")
    mode = cfg["mode"]
    server = server or _servers(cfg)
    base = cfg["base_dn"] or domain_base(cfg["domain"])
    flt = (cfg["user_filter"] or DEFAULT_FILTER[mode]).replace("{user}", escape_filter_chars(name))
    attrs = ["displayName", "cn", "mail", "memberOf"] + (["sAMAccountName", "userPrincipalName"] if mode == "ad" else ["uid"])

    svc = None
    try:
        if cfg["bind_dn"]:
            try:
                svc = _bind(server, cfg, cfg["bind_dn"], cfg["bind_password"], strategy)
            except LdapError as e:
                if e.kind == "bad":
                    raise LdapError("Tài khoản dịch vụ AD (bind DN) sai mật khẩu - kiểm tra trang Cài đặt", "config")
                raise
            svc.search(base, flt, attributes=attrs, size_limit=2)
            found = [e for e in svc.response or [] if e.get("type") == "searchResEntry"]
            if len(found) != 1:
                raise LdapError("Sai tài khoản hoặc mật khẩu", "bad")  # khong tiet lo user co / khong
            entry = found[0]
            user_conn = _bind(server, cfg, entry["dn"], password, strategy)
            user_conn.unbind()
            reader = svc
        else:
            who = (f"{name}@{cfg['domain']}" if mode == "ad"
                   else cfg["user_dn_template"].replace("{user}", escape_rdn(name)))
            reader = _bind(server, cfg, who, password, strategy)
            reader.search(base, flt, attributes=attrs, size_limit=2)
            found = [e for e in reader.response or [] if e.get("type") == "searchResEntry"]
            if not found and mode == "ldap":
                reader.search(who, "(objectClass=*)", search_scope=ldap3.BASE, attributes=attrs)
                found = [e for e in reader.response or [] if e.get("type") == "searchResEntry"]
            if len(found) != 1:
                reader.unbind()
                raise LdapError("Đăng nhập AD được nhưng không tìm thấy tài khoản trong Base DN - kiểm tra Base DN / bộ lọc", "config")
            entry = found[0]

        dn = entry["dn"]
        groups = list(entry.get("attributes", {}).get("memberOf") or [])
        if mode == "ad" and cfg["nested"]:
            reader.search(base, f"(&(objectClass=group)(member:{AD_NESTED_OID}:={escape_filter_chars(dn)}))",
                          attributes=["cn"], size_limit=1000)
            groups += [e["dn"] for e in reader.response or [] if e.get("type") == "searchResEntry"]
        elif mode == "ldap":
            reader.search(base, "(|(member={0})(uniqueMember={0})(memberUid={1}))".format(
                escape_filter_chars(dn), escape_filter_chars(name)), attributes=["cn"], size_limit=1000)
            groups += [e["dn"] for e in reader.response or [] if e.get("type") == "searchResEntry"]
        reader.unbind()
    finally:
        if svc is not None and svc.bound:
            svc.unbind()

    groups = sorted(set(groups), key=str.lower)
    role = next((r for r in ROLES_ORDER if _group_hit(split_groups(cfg[f"group_{r}"]), groups)), "")
    sites = []
    for g, ss in parse_site_groups(cfg["site_groups"]):
        if _group_hit([g], groups):
            sites += [s for s in ss if s not in sites]
    return {"name": name, "dn": dn, "groups": groups, "role": role, "matched": bool(role), "sites": sites,
            "full_name": _first(entry, "displayName") or _first(entry, "cn"), "email": _first(entry, "mail")}


def test_connection(cfg, server=None, strategy=None):
    """Nut "Kiem tra ket noi": mo ket noi (+ bind tai khoan dich vu neu co) -> chuoi ket qua."""
    cfg = {**LDAP_DEFAULTS, **(cfg or {})}
    server = server or _servers(cfg)
    if cfg["bind_dn"]:
        try:
            conn = _bind(server, cfg, cfg["bind_dn"], cfg["bind_password"], strategy)
        except LdapError as e:
            if e.kind == "bad":
                raise LdapError("Kết nối được nhưng tài khoản dịch vụ sai DN / mật khẩu", "config")
            raise
        conn.unbind()
        return "Kết nối được, tài khoản dịch vụ đăng nhập đúng"
    try:
        conn = ldap3.Connection(server, read_only=True, raise_exceptions=False, auto_referrals=False,
                                receive_timeout=int(cfg["timeout"]), client_strategy=strategy or ldap3.SYNC)
        conn.open()
        if cfg["starttls"] and not conn.server.ssl and not conn.start_tls():
            raise LdapError(f"StartTLS lỗi: {conn.result.get('description')}", "down")
        conn.unbind()
    except LDAPException as e:
        raise LdapError(f"Không kết nối được: {type(e).__name__}: {e}", "down")
    except (OSError, ssl.SSLError) as e:
        raise LdapError(f"Không kết nối được: {e}", "down")
    return "Kết nối được máy chủ (chưa thử đăng nhập - nhập tài khoản thử bên dưới)"


def lookup(cfg, raw_user, server=None, strategy=None):
    """Kiem tra lai tai khoan (khong can mat khau user, can tai khoan dich vu).
    -> info nhu authenticate (khong co mat khau) | None neu khong con / bi tat. Loi ket noi -> LdapError."""
    cfg = {**LDAP_DEFAULTS, **(cfg or {})}
    name = normalize_user(raw_user)
    if not (name and cfg["bind_dn"] and available()):
        raise LdapError("Cần tài khoản dịch vụ để kiểm tra lại", "config")
    mode = cfg["mode"]
    server = server or _servers(cfg)
    base = cfg["base_dn"] or domain_base(cfg["domain"])
    flt = (cfg["user_filter"] or DEFAULT_FILTER[mode]).replace("{user}", escape_filter_chars(name))
    attrs = ["displayName", "cn", "mail", "memberOf"] + (["userAccountControl"] if mode == "ad" else [])
    try:
        svc = _bind(server, cfg, cfg["bind_dn"], cfg["bind_password"], strategy)
    except LdapError as e:
        raise LdapError(str(e), "down" if e.kind == "down" else "config")
    try:
        svc.search(base, flt, attributes=attrs, size_limit=2)
        found = [e for e in svc.response or [] if e.get("type") == "searchResEntry"]
        if len(found) != 1:
            return None
        entry = found[0]
        try:
            if mode == "ad" and int(_first(entry, "userAccountControl") or 0) & 2:  # ACCOUNTDISABLE
                return None
        except ValueError:
            pass
        dn = entry["dn"]
        groups = list(entry.get("attributes", {}).get("memberOf") or [])
        if mode == "ad" and cfg["nested"]:
            svc.search(base, f"(&(objectClass=group)(member:{AD_NESTED_OID}:={escape_filter_chars(dn)}))",
                       attributes=["cn"], size_limit=1000)
            groups += [e["dn"] for e in svc.response or [] if e.get("type") == "searchResEntry"]
        elif mode == "ldap":
            svc.search(base, "(|(member={0})(uniqueMember={0})(memberUid={1}))".format(
                escape_filter_chars(dn), escape_filter_chars(name)), attributes=["cn"], size_limit=1000)
            groups += [e["dn"] for e in svc.response or [] if e.get("type") == "searchResEntry"]
    finally:
        svc.unbind()
    groups = sorted(set(groups), key=str.lower)
    role = next((r for r in ROLES_ORDER if _group_hit(split_groups(cfg[f"group_{r}"]), groups)), "")
    sites = []
    for g, ss in parse_site_groups(cfg["site_groups"]):
        if _group_hit([g], groups):
            sites += [s for s in ss if s not in sites]
    return {"name": name, "dn": dn, "groups": groups, "role": role, "matched": bool(role), "sites": sites,
            "full_name": _first(entry, "displayName") or _first(entry, "cn"), "email": _first(entry, "mail")}


def decide(cfg, info, rec):
    """Vai tro / site sau khi AD xac thuc dung.
    Thuoc nhom da khai bao -> theo nhom. Khong thuoc nhom nao: tai khoan QUAN TRI tao san tren web -> giu
    vai tro tren web; con lai (ke ca tai khoan web tu tao luc dang nhap AD truoc day) -> vai tro mac dinh;
    khong co vai tro mac dinh -> tu choi (bi rut khoi nhom AD la mat quyen)."""
    if info["matched"]:
        role, sites = info["role"], info["sites"]
    elif rec and rec.get("created_by") and rec.get("created_by") != "AD":
        role, sites = rec.get("role", "viewer"), rec.get("sites") or []
    elif cfg.get("default_role"):
        role, sites = cfg["default_role"], info["sites"]
    else:
        raise LdapError("Tài khoản AD chưa được cấp quyền vào web (không thuộc nhóm nào). Liên hệ quản trị viên.", "denied")
    return role, ([] if role == "admin" else sites)
