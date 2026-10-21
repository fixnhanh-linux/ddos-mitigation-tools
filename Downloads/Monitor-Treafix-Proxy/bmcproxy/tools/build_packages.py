#!/usr/bin/env python3
"""Dong goi code thanh 2 goi rieng tu cung mot nguon:

    dist/bmc-gateway-web-<phien ban>.tar.gz / .zip     -> server frontend (giao dien web quan ly)
    dist/bmc-gateway-agent-<phien ban>.tar.gz / .zip   -> server backend (Traefik + agent)

Chay (trong thu muc bmcproxy/):  python tools/build_packages.py

Ma nguon chia thu muc (common/ controller/ agent/ deploy/ docs/), con goi cai dat de PHANG nhu cu:
moi file .py nam canh bmcproxy.py + install.sh, web/ va kvm/ la thu muc con -> server dang chay cap nhat
binh thuong, khong phai doi duong dan.
"""

import io
import os
import shutil
import sys
import tarfile
import zipfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # thu muc bmcproxy/
sys.path.insert(0, os.path.join(HERE, "common"))
from gw_common import VERSION  # noqa: E402

# duong dan trong ma nguon -> trong goi chi lay ten file (goi phang)
COMMON = ["bmcproxy.py", "common/gw_common.py", "deploy/install.sh", "docs/HUONG-DAN-CAI-DAT.md"]
PACKAGES = {
    "web": {
        "files": COMMON + ["controller/gw_controller.py", "controller/gw_db.py", "controller/gw_ldap.py",
                           "controller/gw_templates.py", "common/gw_render.py", "common/gw_auth.py",
                           "deploy/systemd/bmcproxy.service", "deploy/config.example.json"],
        "dirs": {"controller/web": "web"},
        "readme": """Treafix Proxy BB {v} - GOI WEB (frontend, server quan ly)

Cai tren server web:
    sudo bash install.sh web
    (chung chi khac /etc/nginx: sudo CERT=/duong/dan.cer KEY=/duong/dan.key bash install.sh web)

Neu may nay truoc day da chay ca Traefik (install.sh all), go phan Traefik nhung GIU web:
    sudo bash install.sh remove-agent

Cap nhat phien ban moi: giai nen goi moi roi chay lai  sudo bash install.sh web
(giu nguyen config.json, tai khoan, danh sach BMC, site, token).

Mo firewall cong 9443 cho mang quan tri / VPN va IP cac server Traefik.
Chi tiet: HUONG-DAN-CAI-DAT.md
""",
    },
    "agent": {
        "files": COMMON + ["agent/gw_agent.py", "common/gw_auth.py", "agent/gw_errpage.py", "agent/gw_java.py",
                           "agent/gw_kvm.py", "agent/gw_limit.py", "agent/gw_nginx.py", "common/gw_render.py",
                           "deploy/systemd/traefik.service", "deploy/systemd/bmcproxy-agent.service",
                           "deploy/agent.example.json"],
        "dirs": {"agent/kvm": "kvm"},
        "readme": """Treafix Proxy BB {v} - GOI AGENT (backend, server Traefik)

1. Tren web: Site -> + Them site (IP duoc phep = IP public cua server nay) -> Sao chep.
2. Dan noi dung vao /root/agent.json, sua "controller_url": "https://<ten-mien-web>:9443"
3. Cai:
       sudo bash install.sh agent
   (tu tai Traefik, kiem tra SHA-256, cai agent, thu ket noi web)

Cap nhat phien ban moi: giai nen goi moi roi chay lai  sudo bash install.sh agent
(giu nguyen agent.json va cau hinh Traefik dang chay, khong restart Traefik).

Console Java tren web (khong tai .jnlp ve may): can Docker tren server nay
       sudo bash install.sh kvm
   roi tren web bat "Mo console Java ngay tren web" cho BMC.

Chi tiet: HUONG-DAN-CAI-DAT.md
""",
    },
}


def add_bytes(tar, name, data, mode=0o644):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = mode
    info.mtime = int(os.path.getmtime(__file__))
    tar.addfile(info, io.BytesIO(data))


def read_lf(path):
    data = open(path, "rb").read()
    return data.replace(b"\r\n", b"\n")  # file chay tren Linux: xuong dong LF


def build(kind, spec, out_dir):
    top = f"bmc-gateway-{kind}"
    files = [(rel, os.path.basename(rel)) for rel in spec["files"]]  # (nguon, ten trong goi)
    for d, dest in spec["dirs"].items():
        for root, _, names in os.walk(os.path.join(HERE, d)):
            if "__pycache__" in root:
                continue
            for n in sorted(names):
                rel = os.path.relpath(os.path.join(root, n), HERE).replace("\\", "/")
                files.append((rel, dest + rel[len(d):]))
    entries = []  # (ten trong goi, noi dung, quyen)
    for rel, name in files:
        src = os.path.join(HERE, rel)
        if not os.path.isfile(src):
            sys.exit(f"Thiếu file {rel}")
        mode = 0o755 if name.endswith(".sh") or name == "bmcproxy.py" else 0o644
        entries.append((f"{top}/{name}", read_lf(src), mode))
    for rel, path in spec.get("extra", lambda: [])():  # vd goi agent nam trong goi web
        entries.append((f"{top}/{rel}", open(path, "rb").read(), 0o644))
    entries.append((f"{top}/README.txt", spec["readme"].format(v=VERSION).encode("utf-8"), 0o644))
    entries.append((f"{top}/VERSION", f"{VERSION}\n".encode(), 0o644))

    tgz = os.path.join(out_dir, f"{top}-{VERSION}.tar.gz")
    with tarfile.open(tgz, "w:gz") as tar:
        for name, data, mode in entries:
            add_bytes(tar, name, data, mode)

    zp = os.path.join(out_dir, f"{top}-{VERSION}.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data, mode in entries:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = (0o100000 | mode) << 16  # giu quyen file khi giai nen tren Linux
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    return [tgz, zp], len(entries)


def main():
    out_dir = os.path.join(HERE, "dist")
    os.makedirs(out_dir, exist_ok=True)
    # Goi agent truoc, roi nhet goi agent vao goi web (lenh cai agent 1 dong tai tu web)
    for kind in sorted(PACKAGES, key=lambda k: k != "agent"):
        spec = PACKAGES[kind]
        if kind == "web":
            agent_zip = os.path.join(out_dir, f"bmc-gateway-agent-{VERSION}.zip")
            spec["extra"] = lambda: [(f"agent-package/bmc-gateway-agent-{VERSION}.zip", agent_zip)]
        outs, n = build(kind, spec, out_dir)
        for out in outs:
            print(f"{kind:5s}: {os.path.relpath(out, HERE)}  ({n} file, {os.path.getsize(out) // 1024} KB)")
        if kind == "agent":  # web chay tu ma nguon (may dev) cung co goi agent cho lenh cai 1 dong
            dev = os.path.join(HERE, "controller", "agent-package")
            os.makedirs(dev, exist_ok=True)
            shutil.copy2(outs[1], dev)


if __name__ == "__main__":
    main()
