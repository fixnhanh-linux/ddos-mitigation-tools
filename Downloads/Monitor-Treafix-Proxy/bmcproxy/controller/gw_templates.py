"""Mau BMC theo loai may (dung chung cho moi site) va nhap / xuat hang loat."""

import csv
import io
import re

from gw_common import RE_SITE_KEY, ValidationError, clean_text, to_port

RE_TPL_KEY = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
RE_IPHOST = re.compile(r"^[A-Za-z0-9.-]{1,253}$")

# Lay theo cac file mau nginx dang dung (nginx/template-config/).
# upstream: "default" = https://IP (cong 443) | "same" = https://IP:<cong proxy> | so = cong co dinh
# console:  "none" = khong co | "same" = https://IP:<cong console> | so = cong co dinh tren BMC
BUILTIN_TEMPLATES = {
    # iDRAC 9 kiem tra Host header: Host = ten mien proxy -> "QueryNotSupported" -> mac dinh Host = IP BMC
    "idrac9": {"label": "Dell iDRAC 9", "upstream": "default", "console": "none", "host_header": "upstream",
               "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "viewer.jnlp"},
    "idrac7-8": {"label": "Dell iDRAC 7 / 8", "upstream": "default", "console": "same",
                 "legacy_tls": False, "jsesp_cache": True, "java_ports": [5900], "jnlp_path": "viewer.jnlp"},
    "idrac6": {"label": "Dell iDRAC 6 (TLS cũ)", "upstream": "default", "console": "same",
               "legacy_tls": True, "jsesp_cache": False, "java_ports": [5900, 5901], "jnlp_path": "viewer.jnlp"},
    "dell-c6420": {"label": "Dell C6420 (BMC9)", "upstream": "same", "console": "same", "host_header": "upstream",
                   "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "viewer.jnlp"},
    "dell-r640": {"label": "Dell R640", "upstream": "same", "console": "none", "host_header": "upstream",
                  "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "viewer.jnlp"},
    "dell-r620": {"label": "Dell R620", "upstream": "same", "console": "same",
                  "legacy_tls": False, "jsesp_cache": True, "jnlp_path": "viewer.jnlp"},
    "ilo4-5": {"label": "HPE iLO 4 / 5", "upstream": "same", "console": "none",
               "legacy_tls": False, "jsesp_cache": False, "java_ports": [17990, 17988], "jnlp_path": "viewer.jnlp"},
    "lenovo": {"label": "Lenovo XCC / IMM", "upstream": "default", "console": "same",
               "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "viewer.jnlp"},
    "cisco-c220": {"label": "Cisco C220 (CIMC)", "upstream": "default", "console": 2068,
                   "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "viewer.jnlp"},
    "quanta-t42s": {"label": "Quanta T42S", "upstream": "default", "console": "none",
                    "legacy_tls": False, "jsesp_cache": False, "jnlp_path": "Java/jviewer.jnlp?EXTRNIP={host}&JNLPSTR=JViewer"},
    "qct-ami-java": {"label": "QCT / AMI MegaRAC (Java JViewer)", "upstream": "default", "console": "none",
                     "legacy_tls": False, "jsesp_cache": False, "java_ports": [7578, 5120, 5123], "max_conns": 4,
                     "jnlp_path": "Java/jviewer.jnlp?EXTRNIP={host}&JNLPSTR=JViewer"},
    "qct-ami-web": {"label": "QCT / AMI MegaRAC (console Java trên web)", "upstream": "default", "console": "none",
                    "legacy_tls": False, "jsesp_cache": False, "java_web": True, "max_conns": 4,
                    "jnlp_path": "Java/jviewer.jnlp?EXTRNIP={host}&JNLPSTR=JViewer"},
    "supermicro": {"label": "Supermicro / AMI MegaRAC", "upstream": "default", "console": "same",
                   "legacy_tls": False, "jsesp_cache": True, "java_ports": [5900, 623],
                   "jnlp_path": "cgi/url_redirect.cgi?url_name=man_ikvm&url_type=jwsk"},
    "supermicro-web": {"label": "Supermicro iKVM (console Java trên web)", "upstream": "default", "console": "none",
                       "legacy_tls": True, "jsesp_cache": False, "java_web": True,
                       "jnlp_path": "cgi/url_redirect.cgi?url_name=man_ikvm&url_type=jwsk"},
}


def validate_template(key, raw):
    if not RE_TPL_KEY.match(key or ""):
        raise ValidationError("Mã mẫu chỉ gồm a-z, 0-9, - _ (tối đa 32)")
    t = {"label": clean_text(raw.get("label"), 60) or key}
    for k in ("upstream", "console"):
        v = raw.get(k, "default" if k == "upstream" else "none")
        allowed = ("default", "same") if k == "upstream" else ("none", "same")
        if v in allowed:
            t[k] = v
        else:
            t[k] = to_port(v, "Cổng " + ("BMC" if k == "upstream" else "console"))
    t["legacy_tls"] = bool(raw.get("legacy_tls"))
    t["jsesp_cache"] = bool(raw.get("jsesp_cache"))
    t["java_web"] = bool(raw.get("java_web"))
    try:
        t["max_conns"] = max(0, min(32, int(raw.get("max_conns") or 0)))
    except (TypeError, ValueError):
        raise ValidationError("Số kết nối tối đa phải là số")
    t["host_header"] = "upstream" if raw.get("host_header") == "upstream" else "client"
    t["jnlp_path"] = str(raw.get("jnlp_path") or "").strip()[:200]
    jp = raw.get("java_ports") or []
    if isinstance(jp, str):
        jp = [x for x in re.split(r"[,;\s]+", jp) if x]
    t["java_ports"] = sorted({to_port(x, "Cổng Java") for x in jp})[:12]
    return t


def all_templates(custom):
    out = {}
    for k, t in BUILTIN_TEMPLATES.items():
        out[k] = {"host_header": "client", **t, "builtin": True}
    for k, t in (custom or {}).items():
        if k in BUILTIN_TEMPLATES:  # ban sao cu cua mau co san trong templates.json -> khong de de len mau moi
            continue
        out[k] = {"host_header": "client", **t, "builtin": False}
    return out


def apply_template(tpl, port, ip, console_port=None):
    """Tra ve cac truong BMC sinh tu mau + cong proxy + IP BMC."""
    ip = str(ip or "").strip()
    if not RE_IPHOST.match(ip):
        raise ValidationError("IP / tên BMC không hợp lệ")
    port = to_port(port, "Cổng")
    up = tpl["upstream"]
    upstream = f"https://{ip}" if up == "default" else f"https://{ip}:{port if up == 'same' else up}"
    fields = {"port": port, "upstream": upstream, "legacy_tls": tpl["legacy_tls"],
              "jsesp_cache": tpl["jsesp_cache"], "host_header": tpl.get("host_header", "client"),
              "console_port": None, "console_upstream": "", "java_ports": tpl.get("java_ports", []),
              "java_web": bool(tpl.get("java_web")), "max_conns": int(tpl.get("max_conns") or 0),
              "jnlp_path": tpl.get("jnlp_path", "")}
    cp = to_port(console_port, "Cổng console", allow_none=True)
    if cp and tpl["console"] != "none":
        target = cp if tpl["console"] == "same" else tpl["console"]
        fields.update(console_port=cp, console_upstream=f"https://{ip}:{target}")
    elif cp:
        fields.update(console_port=cp, console_upstream=f"https://{ip}:{cp}")
    return fields


# --------------------------------------------------------------------------- CSV
EXPORT_COLUMNS = ["site", "port", "link", "console_link", "upstream", "console_port", "console_upstream", "auth", "console_auth",
                  "legacy_tls", "jsesp_cache", "host_header", "enabled", "expected_target", "template",
                  "java_web", "max_conns", "tcp_ports", "tcp_allow_ips", "tags", "expires", "note"]
SHORT_COLUMNS = ["site", "port", "ip", "console", "template", "note"]
BOOL_TRUE = {"1", "true", "yes", "y", "co", "có", "x", "bat", "bật", "on"}


def export_csv(bmcs):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(EXPORT_COLUMNS)
    for b in bmcs:
        row = []
        for c in EXPORT_COLUMNS:
            v = b.get(c, "")
            if c == "tcp_ports":
                v = " ".join(f"{t['proxy']}:{t['bmc']}" if isinstance(t, dict) else str(t) for t in v or [])
            elif c == "tcp_allow_ips":
                v = " ".join(v or [])
            elif c == "tags":
                v = "; ".join(v or [])
            row.append("1" if v is True else "0" if v is False else "" if v is None else v)
        w.writerow(row)
    return "﻿" + buf.getvalue()  # BOM de Excel doc dung tieng Viet


def parse_rows(text):
    """Doc danh sach dan vao (CSV hoac tab tu Excel). Tra ve [(so dong, {cot: gia tri})].
    - Co dong tieu de (vd file xuat ra) -> dung ten cot.
    - Khong co -> thu tu: site, port, ip, console, template, note."""
    text = (text or "").lstrip("﻿")
    lines = [ln for ln in text.splitlines()]
    if not any(ln.strip() for ln in lines):
        return []
    sample = next(ln for ln in lines if ln.strip())
    delim = "\t" if "\t" in sample else ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delim)
    rows, header = [], None
    for n, cols in enumerate(reader, start=1):
        cols = [c.strip() for c in cols]
        if not any(cols) or cols[0].startswith("#"):
            continue
        low = [c.lower() for c in cols]
        if header is None and "site" in low and "port" in low:
            header = low
            continue
        names = header or SHORT_COLUMNS
        rows.append((n, {names[i]: cols[i] for i in range(min(len(names), len(cols)))}))
    return rows


def row_to_bmc(row, templates):
    """Chuyen 1 dong thanh truong BMC (chua kiem tra trung cong)."""
    site = row.get("site", "").strip()
    if not RE_SITE_KEY.match(site):
        raise ValidationError("thiếu hoặc sai mã site")
    tkey = row.get("template", "").strip()
    out = {"site": site, "note": row.get("note", "")}
    if row.get("upstream"):  # dinh dang day du (file xuat)
        out.update(port=row.get("port"), upstream=row["upstream"],
                   console_port=row.get("console_port") or None,
                   console_upstream=row.get("console_upstream", ""))
        for k in ("auth", "console_auth", "legacy_tls", "jsesp_cache", "enabled", "java_web"):
            if row.get(k, "") != "":
                out[k] = row[k].lower() in BOOL_TRUE
        for k in ("host_header", "expected_target", "tcp_ports", "tcp_allow_ips", "max_conns", "tags", "expires"):
            if row.get(k):
                out[k] = row[k]
    else:
        tpl = templates.get(tkey or "idrac9")
        if not tpl:
            raise ValidationError(f"không có mẫu '{tkey}'")
        out.update(apply_template(tpl, row.get("port"), row.get("ip"), row.get("console") or None))
    if tkey:
        if tkey not in templates:
            raise ValidationError(f"không có mẫu '{tkey}'")
        out["template"] = tkey
    return out
