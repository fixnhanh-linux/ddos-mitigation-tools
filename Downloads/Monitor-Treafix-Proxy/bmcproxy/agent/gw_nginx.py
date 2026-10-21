"""Doc config nginx cu (cac file conf.d/80xx-*.conf) de nhap BMC sang Traefik."""

import os
import re

from gw_common import read_text

DISABLED_SUFFIX = ".disabled-by-bmcproxy"


def nginx_tokens(text):
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
        elif c == "#":
            while i < n and text[i] != "\n":
                i += 1
        elif c in "{};":
            yield c
            i += 1
        elif c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            yield text[i + 1:j]
            i = j + 1
        else:
            j = i
            while j < n and not text[j].isspace() and text[j] not in "{};":
                j += 1
            yield text[i:j]
            i = j


def nginx_parse(text):
    """Tra ve danh sach directive dang (ten, [tham so], [con] hoac None)."""
    stack, cur = [[]], []
    for tok in nginx_tokens(text):
        if tok == ";":
            if cur:
                stack[-1].append((cur[0], cur[1:], None))
            cur = []
        elif tok == "{":
            node = (cur[0] if cur else "", cur[1:], [])
            stack[-1].append(node)
            stack.append(node[2])
            cur = []
        elif tok == "}":
            if len(stack) > 1:
                stack.pop()
            cur = []
        else:
            cur.append(tok)
    return stack[0]


def find(nodes, name):
    return [n for n in nodes if n[0] == name]


def analyse_server(node):
    body = node[2] or []
    ports = set()
    for d in find(body, "listen"):
        m = re.search(r"(\d+)$", d[1][0]) if d[1] else None
        if m:
            ports.add(int(m.group(1)))
    names = [a for d in find(body, "server_name") for a in d[1]]
    info = {
        "ports": sorted(ports),
        "server_name": names[0] if names else "",
        "auth": any(d[1] and d[1][0] != "off" for d in find(body, "auth_request")),
        "upstream": "", "legacy_tls": False, "host_header": "client",
        "jsesp": False, "auth_url": "",
    }
    for loc in find(body, "location"):
        args, inner = loc[1], loc[2] or []
        joined = " ".join(args)
        pp = [d[1][0] for d in find(inner, "proxy_pass") if d[1]]
        if args in (["/"], ["=", "/"]):
            if any(d[1] and d[1][0] != "off" for d in find(inner, "auth_request")):
                info["auth"] = True
            if pp:
                info["upstream"] = pp[0].rstrip("/")
            for d in find(inner, "proxy_ssl_ciphers"):
                if "SECLEVEL=0" in " ".join(d[1]):
                    info["legacy_tls"] = True
            for d in find(inner, "proxy_set_header"):
                if len(d[1]) >= 2 and d[1][0].lower() == "host" and d[1][1] == "$proxy_host":
                    info["host_header"] = "upstream"
        elif ".jsesp" in joined:
            info["jsesp"] = True
        elif "_auth_send_request" in joined and pp:
            info["auth_url"] = pp[0]
    return info


def scan_nginx_dir(conf_dir):
    """Tra ve (danh sach BMC tim thay, danh sach file bo qua).
    Moi BMC: {"file", "raw": {truong BMC}, "had_auth", "had_console_auth", "auth_url", "server_name"}"""
    found, skipped = [], []
    if not os.path.isdir(conf_dir):
        return found, [{"file": conf_dir, "reason": "không thấy thư mục"}]
    for fname in sorted(os.listdir(conf_dir)):
        path = os.path.join(conf_dir, fname)
        if not fname.endswith(".conf") or not os.path.isfile(path):
            continue
        servers = [analyse_server(n) for n in find(nginx_parse(read_text(path)), "server")]
        bmc_servers = [s for s in servers if s["upstream"] and s["ports"]]
        if not bmc_servers:
            skipped.append({"file": fname, "reason": "không phải proxy BMC"})
            continue
        if len(bmc_servers) > 2 or len(bmc_servers) != len(servers):
            skipped.append({"file": fname, "reason": "cấu trúc lạ, cần nhập tay"})
            continue
        main = bmc_servers[0]
        cons = bmc_servers[1] if len(bmc_servers) > 1 else None
        found.append({
            "file": fname,
            "server_name": main["server_name"],
            "auth_url": main["auth_url"],
            "had_auth": main["auth"],
            "had_console_auth": cons["auth"] if cons else None,
            "raw": {
                "port": main["ports"][0], "upstream": main["upstream"],
                "console_port": cons["ports"][0] if cons else None,
                "console_upstream": cons["upstream"] if cons else "",
                "auth": True, "console_auth": True,
                "legacy_tls": main["legacy_tls"], "jsesp_cache": main["jsesp"],
                "host_header": main["host_header"],
                "note": re.sub(r"^\d+[-_.]?", "", fname[:-5]),
            },
        })
    return found, skipped


def nginx_ports(conf_dir):
    """Cong nginx dang nghe (chi tinh file .conf con hoat dong)."""
    out = {}
    if not conf_dir or not os.path.isdir(conf_dir):
        return out
    for fname in os.listdir(conf_dir):
        path = os.path.join(conf_dir, fname)
        if not fname.endswith(".conf") or not os.path.isfile(path):
            continue
        for s in find(nginx_parse(read_text(path)), "server"):
            for p in analyse_server(s)["ports"]:
                out[p] = fname
    return out
