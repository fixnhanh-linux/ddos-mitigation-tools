#!/usr/bin/env python3
"""Dong goi vmware-cluster-exporter-linux.zip (+ .sha256).

Chay:  python make_dashboard.py && python build_package.py [goi_zip_co_vendor]
Thu vien pyVmomi (vendor/) lay tu goi esxi-host-exporter-linux.zip (mac dinh o thu muc
"../Monitor-Healthy  Disk vCenter"), chep sang ten moi vmware-cluster-exporter/vendor/.
"""
import hashlib
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = "vmware-cluster-exporter"
SRC = os.path.join(HERE, NAME)
OUT = os.path.join(HERE, NAME + "-linux.zip")
VENDOR_ZIP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, "..", "Monitor-Healthy  Disk vCenter", "esxi-host-exporter-linux.zip")
VENDOR_PREFIX = "esxi-host-exporter/vendor/"


def add(z, arc, data):
    zi = zipfile.ZipInfo(arc, date_time=(2026, 10, 16, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.create_system = 3  # 3 = Unix: unzip moi doc quyen file ben duoi (dong goi tren Windows mac dinh la 0)
    zi.external_attr = ((0o755 if arc.endswith(".sh") else 0o644) | 0o100000) << 16  # quyen file khi unzip tren Linux
    z.writestr(zi, data)


with zipfile.ZipFile(OUT, "w") as z:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = sorted(d for d in dirs if d != "__pycache__")
        for f in sorted(files):
            p = os.path.join(root, f)
            data = open(p, "rb").read()
            if f.endswith((".sh", ".service", ".py", ".yml")):
                data = data.replace(b"\r\n", b"\n")  # bash/systemd tren Linux khong chiu CRLF
            add(z, NAME + "/" + os.path.relpath(p, SRC).replace(os.sep, "/"), data)
    n = 0
    with zipfile.ZipFile(VENDOR_ZIP) as vz:
        for i in vz.infolist():
            if i.filename.startswith(VENDOR_PREFIX) and not i.is_dir():
                add(z, NAME + "/vendor/" + i.filename[len(VENDOR_PREFIX):], vz.read(i))
                n += 1
    if not n:
        sys.exit("Khong tim thay vendor/ trong " + VENDOR_ZIP)

digest = hashlib.sha256(open(OUT, "rb").read()).hexdigest()
with open(OUT + ".sha256", "w", newline="\n") as f:
    f.write("%s  %s\n" % (digest, os.path.basename(OUT)))
print("Da ghi", OUT, "(%d file vendor)" % n, digest)
