#!/usr/bin/env python3
"""Chay file .jnlp ma khong can Java Web Start: tai cac .jar tu BMC roi goi java truc tiep.

Dung trong container bmcgw-kvm (Java 8). Cung chay duoc ngoai container de thu:
    python3 jnlp_run.py viewer.jnlp            # tai jar + chay
    python3 jnlp_run.py viewer.jnlp --dry-run  # chi in lenh java
"""

import os
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

WORK = os.environ.get("KVM_WORK", "/tmp/kvm")
OVERRIDE = "/opt/kvm/java.security.override"
LINUX_ARCH = {"amd64", "x86_64", "x86-64"}


def _parse_xml(text):
    text = text.lstrip("﻿")
    try:
        return ET.fromstring(text)
    except ET.ParseError:  # BMC hay de '&' tran trong tham so
        return ET.fromstring(re.sub(r"&(?!(?:[A-Za-z]+|#\d+|#x[0-9A-Fa-f]+);)", "&amp;", text))


def _for_linux(res):
    oses = (res.get("os") or "").lower().split()
    arches = (res.get("arch") or "").lower().split()
    if oses and not any(o.startswith("linux") for o in oses):
        return False
    if arches and not (set(arches) & LINUX_ARCH):
        return False
    return True


def plan(text, base_url=""):
    """Doc .jnlp -> {codebase, jars, natives, main, args, props, vmargs}."""
    root = _parse_xml(text)
    if root.tag.lower() != "jnlp":
        raise ValueError("không phải file .jnlp")
    codebase = (root.get("codebase") or base_url or "").strip()
    if codebase and not codebase.endswith("/"):
        codebase += "/"
    out = {"codebase": codebase, "jars": [], "natives": [], "main": "", "main_jar": "",
           "args": [], "props": {}, "vmargs": []}

    def url(href):
        return urllib.parse.urljoin(codebase, href.strip())

    for res in root.iter("resources"):
        if not _for_linux(res):
            continue
        for el in res:
            tag = el.tag.lower()
            if tag == "jar" and el.get("href"):
                u = url(el.get("href"))
                if u not in out["jars"]:
                    out["jars"].append(u)
                if (el.get("main") or "").lower() == "true":
                    out["main_jar"] = u
            elif tag == "nativelib" and el.get("href"):
                if url(el.get("href")) not in out["natives"]:
                    out["natives"].append(url(el.get("href")))
            elif tag == "property" and el.get("name"):
                out["props"][el.get("name")] = el.get("value") or ""
            elif tag in ("j2se", "java"):
                if el.get("max-heap-size"):
                    out["vmargs"].append("-Xmx" + el.get("max-heap-size"))
                for a in (el.get("java-vm-args") or "").split():
                    if a.startswith(("-X", "-D")):
                        out["vmargs"].append(a)
    app = root.find("application-desc")
    if app is None:
        if root.find("applet-desc") is not None:
            raise ValueError("file .jnlp dạng applet-desc (applet) chưa được hỗ trợ")
        raise ValueError("file .jnlp không có application-desc")
    out["main"] = (app.get("main-class") or "").strip()
    out["args"] = [(a.text or "").strip() for a in app.findall("argument")]
    if not out["main_jar"] and out["jars"]:
        out["main_jar"] = out["jars"][0]
    return out


def _ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        ctx.set_ciphers("DEFAULT:@SECLEVEL=0")
    except (ValueError, ssl.SSLError, AttributeError):
        pass
    return ctx


def download(u, dest_dir):
    name = re.sub(r"[^A-Za-z0-9._-]", "_", urllib.parse.urlparse(u).path.rsplit("/", 1)[-1]) or "file.jar"
    path = os.path.join(dest_dir, name)
    n = 1
    while os.path.exists(path):  # 2 jar trung ten o thu muc khac nhau
        path = os.path.join(dest_dir, f"{n}_{name}")
        n += 1
    req = urllib.request.Request(u, headers={"User-Agent": "JNLP/6.0 javaws/1.6.0 (bmcgw-kvm)"})
    with urllib.request.urlopen(req, timeout=60, context=_ctx()) as r, open(path, "wb") as f:
        f.write(r.read())
    return path


def _unpack200():
    for c in (shutil.which("unpack200"), os.path.join(os.environ.get("JAVA_HOME", ""), "bin", "unpack200")):
        if c and os.path.exists(c):
            return c
    return "unpack200"


def fetch_jar(u, dest_dir, packed_first=False):
    """Tai 1 jar. Supermicro iKVM chi co ban nen pack200 (<jar>.pack.gz) -> giai bang unpack200."""
    def plain():
        try:
            path = download(u, dest_dir)
        except urllib.error.HTTPError:
            return None
        if zipfile.is_zipfile(path):
            return path
        os.remove(path)  # BMC tra trang loi / HTML thay vi jar
        return None

    def packed():
        try:
            gz = download(u + ".pack.gz", dest_dir)
        except urllib.error.HTTPError:
            return None
        out = gz[:-len(".pack.gz")]
        if not out.lower().endswith(".jar"):
            out += ".jar"
        subprocess.check_call([_unpack200(), gz, out])
        os.remove(gz)
        return out if zipfile.is_zipfile(out) else None

    for f in ((packed, plain) if packed_first else (plain, packed)):
        path = f()
        if path:
            return path
    raise OSError(f"không tải được {u} (cả .jar và .jar.pack.gz)")


def manifest_main(jar):
    try:
        with zipfile.ZipFile(jar) as z:
            mf = z.read("META-INF/MANIFEST.MF").decode("utf-8", "replace")
    except (KeyError, zipfile.BadZipFile, OSError):
        return ""
    m = re.search(r"^Main-Class:\s*(\S+)", mf, re.M | re.I)
    return m.group(1) if m else ""


def extract_natives(jar, dest):
    with zipfile.ZipFile(jar) as z:
        for info in z.infolist():
            name = info.filename
            if info.is_dir() or name.upper().startswith("META-INF/"):
                continue
            target = os.path.join(dest, os.path.basename(name))
            if os.path.basename(name):
                with z.open(info) as src, open(target, "wb") as f:
                    f.write(src.read())


def build_cmd(p, jar_paths, native_dir, main):
    cmd = ["java"]
    if os.path.exists(OVERRIDE):
        cmd.append("-Djava.security.properties=" + OVERRIDE)
    cmd += ["-Djdk.tls.client.protocols=TLSv1,TLSv1.1,TLSv1.2", "-Djava.library.path=" + native_dir,
            "-Dsun.java2d.xrender=false", "-Djava.net.preferIPv4Stack=true",
            "-Duser.home=" + WORK, "-Djava.util.prefs.userRoot=" + os.path.join(WORK, "prefs"),
            "-Djava.util.prefs.systemRoot=" + os.path.join(WORK, "prefs")]
    cmd += [f"-D{k}={v}" for k, v in p["props"].items()]
    cmd += p["vmargs"]
    cmd += ["-cp", os.pathsep.join(jar_paths), main] + p["args"]
    return cmd


def run_javaws(jnlp_path):
    """Du phong giong cach chay tay tren Windows: IcedTea-Web javaws + Java 8 (ho tro ca applet-desc)."""
    javaws = shutil.which("javaws")
    if not javaws:
        print("không có javaws (icedtea-netx) để chạy dự phòng", flush=True)
        return 1
    cmd = [javaws, "-Xnofork", "-nosecurity", "-Xtrustall", "-verbose"]
    if os.path.exists(OVERRIDE):
        cmd.append("-J-Djava.security.properties=" + OVERRIDE)
    cmd.append(jnlp_path)
    print("chạy dự phòng: javaws", jnlp_path, flush=True)
    return subprocess.call(cmd)


def run_direct(p):
    jar_dir, native_dir = os.path.join(WORK, "jars"), os.path.join(WORK, "native")
    os.makedirs(jar_dir, exist_ok=True)
    os.makedirs(native_dir, exist_ok=True)
    jar_paths, main_path = [], ""
    packed_first = p["props"].get("jnlp.packEnabled", "").lower() == "true"
    for u in p["jars"]:
        print("tải", u, flush=True)
        path = fetch_jar(u, jar_dir, packed_first)
        jar_paths.append(path)
        if u == p["main_jar"]:
            main_path = path
    for u in p["natives"]:
        print("tải", u, flush=True)
        path = fetch_jar(u, jar_dir, packed_first)
        jar_paths.append(path)
        extract_natives(path, native_dir)
    main_class = p["main"] or manifest_main(main_path)
    if not main_class:
        raise ValueError("không tìm thấy main-class")
    cmd = build_cmd(p, jar_paths, native_dir, main_class)
    shown, hide = [], False
    for a in cmd:  # khong in token / mat khau ra log
        secret = re.search(r"token|pass|session|ssi", a, re.I)
        shown.append("***" if hide or (secret and "=" in a) else a)
        hide = bool(secret) and a.startswith("-") and "=" not in a
    print("chạy:", " ".join(shown), flush=True)
    return subprocess.call(cmd)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    jnlp_path = sys.argv[1]
    text = open(jnlp_path, encoding="utf-8", errors="replace").read()
    if os.environ.get("KVM_MODE") == "javaws":
        sys.exit(run_javaws(jnlp_path))
    try:
        p = plan(text)
    except (ValueError, ET.ParseError) as e:
        print("không chạy trực tiếp được:", e, flush=True)
        sys.exit(run_javaws(jnlp_path))
    if "--dry-run" in sys.argv:
        print(build_cmd(p, [os.path.basename(u) for u in p["jars"] + p["natives"]], "native",
                        p["main"] or "<Main-Class trong jar>"))
        return
    t0 = time.time()
    try:
        rc = run_direct(p)
    except (OSError, ValueError, zipfile.BadZipFile) as e:
        print("chạy trực tiếp lỗi:", e, flush=True)
        rc, t0 = 1, time.time()
    # Java thoat ngay (loi jar / lop / TLS) -> thu javaws; dong cua so sau khi dung lau -> ket thuc
    if rc != 0 and time.time() - t0 < 20:
        rc = run_javaws(jnlp_path)
    sys.exit(rc)


if __name__ == "__main__":
    main()
