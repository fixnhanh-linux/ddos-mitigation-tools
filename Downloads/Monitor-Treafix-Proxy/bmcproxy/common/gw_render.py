"""Sinh cau hinh Traefik tu mot 'release' (du lieu cua 1 site) va tham so cua agent."""

import hashlib
import json
import urllib.parse

from gw_common import (BMC_DEFAULTS, KVM_CTL_PATH, KVM_PATH, kvm_local_port, limit_local_port, to_yaml,
                       upstream_host_port)

# File .jnlp: duong dan *.jnlp (AMI, iDRAC, iLO...) hoac Supermicro /cgi/url_redirect.cgi?url_type=jwsk
JNLP_RULE = (r"PathRegexp(`(?i)\.jnlp`) || "
             "(Path(`/cgi/url_redirect.cgi`) && (Query(`url_type`, `jwsk`) || Query(`url_name`, `ikvm`) || Query(`url_name`, `man_ikvm`)))")

COMMON_FILE = "00-bmcproxy-common.yml"
DASHBOARD_FILE = "00-bmcproxy-dashboard.yml"

# Go (Traefik) khong ho tro DHE: BMC chi co DHE se khong ket noi duoc.
LEGACY_CIPHERS = [
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA",
    "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA",
    "TLS_RSA_WITH_AES_128_GCM_SHA256",
    "TLS_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_RSA_WITH_AES_128_CBC_SHA",
    "TLS_RSA_WITH_AES_256_CBC_SHA",
    "TLS_RSA_WITH_3DES_EDE_CBC_SHA",
]
CORS_HEADERS = ["DNT", "User-Agent", "X-Requested-With", "If-Modified-Since",
                "Cache-Control", "Content-Type", "Range"]

# Tham so rieng cua tung server (agent bao len controller)
DEFAULT_PARAMS = {
    "dynamic_dir": "/etc/traefik/dynamic",
    "auth_host": "127.0.0.1",
    "auth_port": 9444,
    "api": "http://127.0.0.1:18080",
    "entrypoint_host": "",
}


# Tang khi doi cach sinh file Traefik -> rev doi -> site hien "cho ap dung" de agent sinh lai file
RENDER_VERSION = 9


def release_rev(domain, settings, bmcs, dashboard=None):
    """Ma phien ban: doi khi bat ky du lieu nao cua site (hoac cach sinh file) thay doi."""
    data = {"domain": domain, "settings": settings, "bmcs": bmcs, "render": RENDER_VERSION}
    if dashboard and dashboard.get("enabled"):
        data["dashboard"] = dashboard
    blob = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:12]


def active_bmcs(release):
    return [{**BMC_DEFAULTS, **b} for b in (release or {}).get("bmcs", []) if b.get("enabled", True)]


def dashboard_of(release):
    d = (release or {}).get("dashboard") or {}
    return d if d.get("enabled") else None


def ep_name(port):
    return f"p{port}"


def entry_ports(release):
    ports = []
    for b in active_bmcs(release):
        ports.append(b["port"])
        if b["console_port"]:
            ports.append(b["console_port"])
        ports.extend(t["proxy"] for t in b.get("tcp_ports") or [])
    d = dashboard_of(release)
    if d:
        ports.append(d["port"])
    return sorted(ports)


def expected_routers(release):
    names = []
    for b in active_bmcs(release):
        n = f"bmc-{b['port']}"
        names.append(n)
        if b["jsesp_cache"]:
            names.append(n + "-jsesp")
        if b["console_port"]:
            names.append(n + "-console")
        if b.get("jnlp_rewrite", True) or b.get("java_web"):
            names.append(n + "-jnlp")
        if b.get("jnlp_rewrite", True):
            names.append(n + "-jar")
        if b.get("java_web"):
            names.append(n + "-kvm")
    if dashboard_of(release):
        names.append("bmc-dashboard")
    return names


def render_static(release, params):
    s = release["settings"]
    api = urllib.parse.urlparse(params.get("api") or DEFAULT_PARAMS["api"])
    eps = {"traefik": {"address": f"{api.hostname or '127.0.0.1'}:{api.port or 18080}",
                       "http": {"aliasHeadersStrategy": "delete"}}}
    host = params.get("entrypoint_host") or ""
    dash = dashboard_of(release)
    for p in entry_ports(release):
        if dash and p == dash["port"]:
            eps["dashboard"] = {"address": f"{host}:{p}", "http": {"aliasHeadersStrategy": "delete"}}
            continue
        eps[ep_name(p)] = {
            "address": f"{host}:{p}",
            # Tat gioi han 60s mac dinh cua Traefik v3 (upload ISO / virtual media)
            "transport": {"respondingTimeouts": {"readTimeout": 0, "writeTimeout": 0,
                                                 "idleTimeout": "180s"}},
            # Xoa header ten co "_" / "." (vd Token_user) de client khong gia mao Token-*
            "http": {"aliasHeadersStrategy": "delete"},
        }
    static = {
        "global": {"checkNewVersion": False, "sendAnonymousUsage": False},
        "log": {"level": s["log_level"]},
        "accessLog": {"filePath": s["access_log"], "format": "json"},
        "api": {"dashboard": True, "insecure": True},
        "ping": {"entryPoint": "traefik"},
        "metrics": {"prometheus": {"entryPoint": "traefik"}},
        "entryPoints": eps,
        "providers": {"file": {"directory": params["dynamic_dir"], "watch": True}},
    }
    return to_yaml(static, [f"Site {release['site']} - cau hinh tinh. Them/bot cong can restart Traefik."])


def render_common(release):
    s = release["settings"]
    cert = {"certFile": s["cert_file"], "keyFile": s["key_file"]}
    common = {
        "tls": {
            "certificates": [cert],
            "stores": {"default": {"defaultCertificate": cert}},
            # Chi HTTP/1.1 voi trinh duyet: HTTP/2 cho trinh duyet gui moi request cung luc -> Traefik mo
            # moi request 1 ket noi TLS toi BMC -> web BMC (AMI/QCT...) qua tai, 502, treo. HTTP/1.1 = toi da
            # 6 ket noi / trinh duyet, giong luc vao thang IP BMC.
            "options": {"default": {"minVersion": "VersionTLS12", "sniStrict": False,
                                    "alpnProtocols": ["http/1.1"]}},
        },
        "http": {
            "middlewares": {
                "bmc-cors": {"headers": {
                    "accessControlAllowOriginList": ["*"],
                    "accessControlAllowMethods": ["GET", "POST", "OPTIONS"],
                    "accessControlAllowHeaders": CORS_HEADERS,
                    "accessControlExposeHeaders": ["Content-Length", "Content-Range"],
                    "accessControlMaxAge": 1728000,
                }},
                # BMC (AMI/QCT, iDRAC cu) chi chiu vai ket noi cung luc, hay dong ngang ket noi -> 502.
                # Thu lai khi loi ket noi (chua nhan duoc tra loi tu BMC).
                "bmc-retry": {"retry": {"attempts": 2, "initialInterval": "200ms"}},
                "bmc-headers": {"headers": {
                    # Bo X-Frame-Options cua BMC de nhung duoc vao portal; an header Server
                    "customResponseHeaders": {"X-Frame-Options": "", "Server": ""},
                    "customRequestHeaders": {"X-Forwarded-Protocol": "https"},
                }},
                "bmc-jsesp": {"headers": {"customResponseHeaders": {
                    "Content-Type": "application/javascript",
                    "Cache-Control": "public, max-age=31536000",
                }}},
            },
            "serversTransports": {
                # BMC dong ket noi ranh rat som -> bo ket noi ranh sau 10s de khoi dung lai ket noi da chet
                "bmc-insecure": {"insecureSkipVerify": True,
                                 "forwardingTimeouts": {"idleConnTimeout": "10s", "dialTimeout": "3s"}},
                "bmc-legacy": {
                    "insecureSkipVerify": True,
                    "forwardingTimeouts": {"idleConnTimeout": "10s", "dialTimeout": "3s"},
                    "minVersion": "VersionTLS10",
                    "maxVersion": "VersionTLS13",
                    "cipherSuites": LEGACY_CIPHERS,
                },
            },
        },
    }
    tr = common["http"]["serversTransports"]
    for k in list(tr):  # ban "-nokeep": moi request 1 ket noi, dong ngay (dung voi bo gioi han ket noi)
        tr[k + "-nokeep"] = {**tr[k], "maxIdleConnsPerHost": -1}
    return to_yaml(common, [f"Site {release['site']} - chung chi, CORS, header, transport."])


def render_bmc(b, params):
    b = {**BMC_DEFAULTS, **b}
    name = f"bmc-{b['port']}"
    transport = "bmc-legacy" if b["legacy_tls"] else "bmc-insecure"
    limited = int(b.get("max_conns") or 0) > 0
    if limited:  # khong giu ket noi ranh -> xong request la nha cho trong bo gioi han cua agent
        transport += "-nokeep"
    routers, services, middlewares = {}, {}, {}
    if b["auth"] or (b["console_port"] and b["console_auth"]):
        middlewares[f"{name}-auth"] = {"forwardAuth": {
            "address": f"http://{params['auth_host']}:{params['auth_port']}/auth/{b['port']}",
            "authResponseHeadersRegex": "^Token-",
            "trustForwardHeader": False,
            "maxResponseBodySize": 65536,
        }}

    # BMC loi 502/503/504 (mat mang, treo, TLS) -> trang loi IPMI do agent chan doan
    services[f"{name}-errpage"] = {"loadBalancer": {
        "servers": [{"url": f"http://{params['auth_host']}:{params['auth_port']}"}]}}
    for kind in ("web", "console"):
        middlewares[f"{name}-err-{kind}"] = {"errors": {
            "status": ["502-504"], "service": f"{name}-errpage",
            "query": f"/__bmcgw/error?status={{status}}&port={b['port']}&kind={kind}"}}

    def chain(auth, kind="web"):
        return ["bmc-cors", "bmc-headers"] + ([f"{name}-auth"] if auth else []) + [f"{name}-err-{kind}", "bmc-retry"]

    def service(url):
        return {"loadBalancer": {
            "servers": [{"url": url}],
            "serversTransport": transport,
            "passHostHeader": b["host_header"] == "client",
        }}

    routers[name] = {"entryPoints": [ep_name(b["port"])], "rule": "PathPrefix(`/`)",
                     "service": name, "middlewares": chain(b["auth"]), "tls": {}}
    services[name] = service(b["upstream"])
    if limited:
        # Traefik -> bo gioi han cua agent (127.0.0.1) -> BMC; TLS van di thang toi BMC
        bhost, bport = upstream_host_port(b["upstream"])
        scheme = b["upstream"].split("://", 1)[0]
        services[name] = service(f"{scheme}://127.0.0.1:{limit_local_port(b['port'])}")
        if b["host_header"] != "client":  # giu Host = IP BMC (khong de thanh 127.0.0.1)
            default = 443 if scheme == "https" else 80
            middlewares[f"{name}-host"] = {"headers": {"customRequestHeaders": {
                "Host": bhost if bport == default else f"{bhost}:{bport}"}}}
            services[name]["loadBalancer"]["passHostHeader"] = True
            routers[name]["middlewares"] = routers[name]["middlewares"] + [f"{name}-host"]
    if b["jsesp_cache"]:
        routers[f"{name}-jsesp"] = {
            "entryPoints": [ep_name(b["port"])],
            "rule": r"PathRegexp(`^/(ImageLoader|userpriv|functions|sysSummary|sensors)\.jsesp$`)",
            "service": name, "middlewares": chain(b["auth"]) + ["bmc-jsesp"],
            "priority": 1000, "tls": {},
        }
    if b["console_port"]:
        routers[f"{name}-console"] = {
            "entryPoints": [ep_name(b["console_port"])], "rule": "PathPrefix(`/`)",
            "service": f"{name}-console", "middlewares": chain(b["console_auth"], "console"), "tls": {}}
        services[f"{name}-console"] = service(b["console_upstream"])
    tcp = None
    if b.get("tcp_ports"):
        host, _ = upstream_host_port(b["upstream"])
        allow = b.get("tcp_allow_ips") or []
        tcp = {"routers": {}, "services": {}}
        if allow:
            tcp["middlewares"] = {f"{name}-javaip": {"ipAllowList": {"sourceRange": allow}}}
            middlewares[f"{name}-javaip-http"] = {"ipAllowList": {"sourceRange": allow}}
        for t in b["tcp_ports"]:
            rn = f"{name}-tcp-{t['proxy']}"
            tcp["routers"][rn] = {"entryPoints": [ep_name(t["proxy"])], "rule": "HostSNI(`*`)",
                                  "service": rn, **({"middlewares": [f"{name}-javaip"]} if allow else {})}
            tcp["services"][rn] = {"loadBalancer": {"servers": [{"address": f"{host}:{t['bmc']}"}]}}
    allow = b.get("tcp_allow_ips") or []
    if allow and f"{name}-javaip-http" not in middlewares:
        middlewares[f"{name}-javaip-http"] = {"ipAllowList": {"sourceRange": allow}}
    if b.get("jnlp_rewrite", True):
        # File .jar do Java Web Start tai (khong co cookie portal) -> khong bat xac thuc portal
        routers[f"{name}-jar"] = {
            "entryPoints": [ep_name(b["port"])], "rule": r"PathRegexp(`(?i)\.jar(\?|$)`)",
            "service": name, "priority": 2900, "tls": {},
            "middlewares": ["bmc-cors", "bmc-headers", "bmc-retry"] + ([f"{name}-javaip-http"] if allow else [])}
    if b.get("jnlp_rewrite", True) or b.get("java_web"):
        # File .jnlp: agent tai tu BMC; sua IP noi bo -> ten mien proxy, hoac (java_web) mo console tren web
        middlewares[f"{name}-jnlp-tag"] = {"headers": {"customRequestHeaders": {"X-Bmcproxy-Bmc": str(b["port"])}}}
        routers[f"{name}-jnlp"] = {
            "entryPoints": [ep_name(b["port"])],
            "rule": JNLP_RULE + (f" || PathPrefix(`{KVM_CTL_PATH}/`)" if b.get("java_web") else ""),
            "service": f"{name}-jnlp", "priority": 3000, "tls": {},
            "middlewares": chain(b["auth"]) + [f"{name}-jnlp-tag"]
            + ([f"{name}-javaip-http"] if allow and b.get("java_web") else [])}
        services[f"{name}-jnlp"] = {"loadBalancer": {
            "servers": [{"url": f"http://{params['auth_host']}:{params['auth_port']}"}],
            "passHostHeader": True}}
    if b.get("java_web"):
        # noVNC cua container console Java (chi nghe 127.0.0.1) - cung xac thuc voi cong web
        middlewares[f"{name}-kvm-strip"] = {"stripPrefix": {"prefixes": [KVM_PATH]}}
        routers[f"{name}-kvm"] = {
            "entryPoints": [ep_name(b["port"])], "rule": f"PathPrefix(`{KVM_PATH}/`)",
            "service": f"{name}-kvm", "priority": 3100, "tls": {},
            "middlewares": [m for m in chain(b["auth"]) if m != f"{name}-err-web"]
            + ([f"{name}-javaip-http"] if allow else []) + [f"{name}-kvm-strip"]}
        services[f"{name}-kvm"] = {"loadBalancer": {
            "servers": [{"url": f"http://127.0.0.1:{kvm_local_port(b['port'])}"}], "passHostHeader": True}}
    http = {"routers": routers, "services": services}
    if middlewares:
        http["middlewares"] = middlewares
    header = [f"Site {b['site']} | BMC {b['port']} -> {b['upstream']}" +
              (f" | {b['note']}" if b["note"] else "")]
    if b.get("tcp_ports"):
        header.append("Console Java TCP: " + ", ".join(f"{t['proxy']}->{t['bmc']}" for t in b["tcp_ports"])
                      + (f" | IP: {', '.join(b.get('tcp_allow_ips') or [])}" if b.get("tcp_allow_ips")
                         else " | CANH BAO: moi IP deu vao duoc"))
    if b.get("java_web"):
        header.append(f"Console Java tren web: {KVM_PATH}/ -> container 127.0.0.1:{kvm_local_port(b['port'])}"
                      + ("" if b["auth"] else " | khong xac thuc portal: bao ve bang mat khau VNC moi lan Launch"))
    if limited:
        header.append(f"Toi da {b['max_conns']} ket noi toi BMC (qua agent 127.0.0.1:{limit_local_port(b['port'])})")
    if b["console_port"]:
        header.append(f"Console {b['console_port']} -> {b['console_upstream']}")
    if not b["auth"]:
        header.append("CANH BAO: cong web KHONG co xac thuc")
    if b["console_port"] and not b["console_auth"]:
        header.append("CANH BAO: cong console KHONG co xac thuc")
    return to_yaml({"http": http, **({"tcp": tcp} if tcp else {})}, header)


def render_dashboard(release):
    """Dashboard Traefik qua HTTPS, chi IP duoc phep + mat khau (basicAuth)."""
    d = dashboard_of(release)
    mws = ["bmc-dash-ip", "bmc-dash-auth"]
    conf = {"http": {
        "routers": {
            "bmc-dashboard": {
                "entryPoints": ["dashboard"],
                "rule": "PathPrefix(`/api`) || PathPrefix(`/dashboard`)",
                "service": "api@internal", "middlewares": mws, "tls": {}},
            "bmc-dashboard-root": {
                "entryPoints": ["dashboard"], "rule": "Path(`/`)", "priority": 1,
                "service": "api@internal", "middlewares": mws + ["bmc-dash-redirect"], "tls": {}},
        },
        "middlewares": {
            "bmc-dash-ip": {"ipAllowList": {"sourceRange": d["allow_ips"]}},
            "bmc-dash-auth": {"basicAuth": {"users": [f"{u}:{h}" for u, h in sorted(d["users"].items())],
                                            "realm": "Traefik dashboard"}},
            "bmc-dash-redirect": {"redirectRegex": {"regex": "^(https?://[^/]+)/?$",
                                                    "replacement": "${1}/dashboard/"}},
        },
    }}
    return to_yaml(conf, [f"Site {release['site']} - dashboard Traefik cong {d['port']}, "
                          f"IP: {', '.join(d['allow_ips'])}"])


def render_files(release, params):
    """Tra ve (noi dung traefik.yml, {ten file dynamic: noi dung})."""
    params = {**DEFAULT_PARAMS, **(params or {})}
    if not release:
        return "", {}
    dyn = {COMMON_FILE: render_common(release)}
    for b in active_bmcs(release):
        dyn[f"bmc-{b['port']}.yml"] = render_bmc(b, params)
    if dashboard_of(release):
        dyn[DASHBOARD_FILE] = render_dashboard(release)
    return render_static(release, params), dyn
