#!/usr/bin/env python3
"""Prometheus exporter so lieu tong tung cluster VMware cho dashboard "VMWARE CLUSTER HCM".

Doc lap voi esxi-host-exporter (dashboard MONITOR RESOURCE HOST ESXi): metric rieng vmware_cluster_*,
port rieng (mac dinh 9821), chi lay so lieu cap cluster nen nhe hon (khong lay disk health / NIC / vmk).

Cach dung:
  python vmware_cluster_exporter.py <vcenter> <user> [cluster|-] [port, mac dinh 9821] [interval_giay, mac dinh 60]
  Mat khau: bien moi truong VC_PASS, neu khong co se hoi khi chay.
  cluster = "-" -> lay tat ca cluster cua vCenter.
  VC_SLOW_INTERVAL=300 -> chu ky lay vSAN Skyline Health (vCenter chi cap nhat theo cache).

Metric xuat ra (nhan cluster):
  vmware_cluster_status, _vsan_health, _drs_mode, _hosts, _hosts_effective, _vms_total, _vms_powered_off,
  vmware_cluster_cpu_total_hz, _cpu_used_hz, _mem_total_bytes, _mem_used_bytes,
  vmware_cluster_vsan_capacity_bytes, _vsan_free_bytes, _vsan_resync_bytes, _vsan_resync_objects,
  vmware_cluster_host_uptime_max_seconds, _host_cpu_max_percent, _host_mem_max_percent,
  vmware_cluster_exporter_up / _build_info / _last_success_timestamp_seconds / _collect_duration_seconds
"""
import getpass
import os
import ssl
import sys
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from pyVim.connect import Disconnect, SmartConnect
from pyVmomi import SoapStubAdapter, VmomiSupport, vim, vmodl

# Tang moi lan phat hanh goi zip; kiem tra ban dang chay: curl -s localhost:9821/metrics | grep build_info
VERSION = "2026.10.16-1"

SLOW_INTERVAL = int(os.environ.get("VC_SLOW_INTERVAL", 300))

CLUSTER_PROPS = ["name", "summary", "overallStatus", "configurationEx", "datastore"]
HOST_PROPS = ["parent", "runtime.connectionState", "summary.quickStats", "summary.hardware"]
DRS_CODE = {"manual": 1, "partiallyAutomated": 2, "fullyAutomated": 3}  # 0 = DRS tat
COLOR_CODE = {"green": 0, "yellow": 1, "red": 2}  # con lai (gray/unknown) = 3

VSAN_VERSIONS = [
    "vsan.version.v9_1_0_0", "vsan.version.v9_0_0_0",
    "vsan.version.version23", "vsan.version.version22", "vsan.version.version21",
    "vsan.version.version20", "vsan.version.version19", "vsan.version.version18",
    "vsan.version.version17", "vsan.version.version16", "vsan.version.version15",
    "vsan.version.version14", "vsan.version.version13", "vsan.version.version12",
    "vsan.version.version11", "vsan.version.version10", "vsan.version.version3",
    "vim.version.version9",
]


def vsan_api_version(vc, ctx):
    """Chon version vSAN API moi nhat ma ca vCenter va pyVmomi deu ho tro."""
    try:
        url = "https://%s/sdk/vsanServiceVersions.xml" % vc
        supported = {v.text for v in ET.fromstring(urllib.request.urlopen(url, context=ctx, timeout=15).read()).iter("version")}
    except Exception:
        return "vim.version.version9"
    for v in VSAN_VERSIONS:
        if VmomiSupport.versionIdMap.get(v) in supported:
            return v
    return "vim.version.version9"


def vsan_mo(si, vc, ctx, mo_type, mo_id):
    stub = SoapStubAdapter(host=vc, port=443, path="/vsanHealth", version=vsan_api_version(vc, ctx), sslContext=ctx)
    stub.cookie = si._stub.cookie
    return mo_type(mo_id, stub)


def retrieve(si, obj_type, props):
    """Lay nhieu thuoc tinh cua moi doi tuong trong 1-2 lan goi (thay vi goi tung thuoc tinh)."""
    pc = si.content.propertyCollector
    view = si.content.viewManager.CreateContainerView(si.content.rootFolder, [obj_type], True)
    PC = vmodl.query.PropertyCollector
    try:
        spec = PC.FilterSpec(
            objectSet=[PC.ObjectSpec(obj=view, skip=True, selectSet=[
                PC.TraversalSpec(name="v", path="view", skip=False, type=vim.view.ContainerView)])],
            propSet=[PC.PropertySpec(type=obj_type, pathSet=props)])
        out = []
        res = pc.RetrievePropertiesEx([spec], PC.RetrieveOptions())
        while res:
            for o in res.objects:
                out.append((o.obj, {p.name: p.val for p in o.propSet or []}))
            res = pc.ContinueRetrievePropertiesEx(res.token) if res.token else None
        return out
    finally:
        view.Destroy()


def collect(vc, user, pwd, cluster_filter, cache):
    """Lay so lieu 1 vong. cache giu vSAN health giua cac vong, lam moi moi SLOW_INTERVAL."""
    ctx = ssl._create_unverified_context()
    si = SmartConnect(host=vc, user=user, pwd=pwd, sslContext=ctx)
    try:
        cl_props = [(o, p) for o, p in retrieve(si, vim.ClusterComputeResource, CLUSTER_PROPS)
                    if cluster_filter is None or p["name"] == cluster_filter]
        ds = {o._moId: p for o, p in retrieve(si, vim.Datastore, ["summary.type", "summary.capacity",
                                                                   "summary.freeSpace"])}
        vsan_cl = [o for o, p in cl_props
                   if getattr(getattr(p.get("configurationEx"), "vsanConfigInfo", None), "enabled", False)]

        # Tong CPU/RAM dang dung + host cao nhat (chi host connected)
        agg = {}
        for _, p in retrieve(si, vim.HostSystem, HOST_PROPS):
            if p.get("runtime.connectionState") != "connected" or p.get("parent") is None:
                continue
            qs, hw = p["summary.quickStats"], p["summary.hardware"]
            cpu_cap = (hw.cpuMhz or 0) * (hw.numCpuCores or 0)
            a = agg.setdefault(p["parent"]._moId, {"cpu": 0, "mem": 0, "uptime": 0, "cpu_max": 0, "mem_max": 0})
            a["cpu"] += (qs.overallCpuUsage or 0) * 1e6          # MHz -> Hz
            a["mem"] += (qs.overallMemoryUsage or 0) * 1048576   # MB -> bytes
            a["uptime"] = max(a["uptime"], qs.uptime or 0)
            if cpu_cap:
                a["cpu_max"] = max(a["cpu_max"], (qs.overallCpuUsage or 0) / cpu_cap * 100)
            if hw.memorySize:
                a["mem_max"] = max(a["mem_max"], (qs.overallMemoryUsage or 0) / (hw.memorySize / 1048576) * 100)

        if vsan_cl and time.time() - cache.get("slow_ts", 0) >= SLOW_INTERVAL:
            overall = {}
            try:
                hs = vsan_mo(si, vc, ctx, vim.cluster.VsanVcClusterHealthSystem, "vsan-cluster-health-system")
                for c in vsan_cl:
                    s = hs.VsanQueryVcClusterHealthSummary(cluster=c, fetchFromCache=True, fields=["overallHealth"])
                    overall[c.name] = s.overallHealth
                cache.update(vsan_overall=overall, slow_ts=time.time())
            except Exception as e:
                print("Khong lay duoc vSAN health: %s" % (getattr(e, "msg", None) or e), flush=True)
        vsan_overall = cache.get("vsan_overall", {})

        resync = {}
        if vsan_cl:
            try:
                obj_sys = vsan_mo(si, vc, ctx, vim.cluster.VsanObjectSystem, "vsan-cluster-object-system")
                for c in vsan_cl:
                    r = obj_sys.QuerySyncingVsanObjectsSummary(cluster=c)
                    resync[c.name] = (r.totalObjectsToSync or 0, r.totalBytesToSync or 0)
            except Exception as e:
                print("Khong lay duoc resync: %s" % (getattr(e, "msg", None) or e), flush=True)

        out = []
        for o, p in cl_props:
            s, cfg = p["summary"], p.get("configurationEx")
            drs = getattr(cfg, "drsConfig", None)
            us = getattr(s, "usageSummary", None)
            vds = [ds[d._moId] for d in p.get("datastore") or [] if ds.get(d._moId, {}).get("summary.type") == "vsan"]
            a = agg.get(o._moId, {})
            out.append({
                "cluster": p["name"],
                "status": COLOR_CODE.get(str(p.get("overallStatus")), 3),
                "vsan_health": COLOR_CODE.get(vsan_overall.get(p["name"]), 3) if p["name"] in vsan_overall else None,
                "drs": DRS_CODE.get(str(drs.defaultVmBehavior), 1) if drs and drs.enabled else 0,
                "hosts": s.numHosts or 0,
                "hosts_effective": s.numEffectiveHosts or 0,
                "vms_total": us.totalVmCount if us else None,
                "vms_off": us.poweredOffVmCount if us else None,
                "cpu_total_hz": (s.totalCpu or 0) * 1e6,
                "cpu_used_hz": a.get("cpu", 0),
                "mem_total_bytes": s.totalMemory or 0,
                "mem_used_bytes": a.get("mem", 0),
                "vsan_capacity": sum(d["summary.capacity"] for d in vds) if vds else None,
                "vsan_free": sum(d["summary.freeSpace"] for d in vds) if vds else None,
                "resync": resync.get(p["name"]),
                "host_uptime_max": a.get("uptime") if a else None,
                "host_cpu_max": a.get("cpu_max") if a else None,
                "host_mem_max": a.get("mem_max") if a else None,
            })
        return out
    finally:
        Disconnect(si)


def _lbl(**kv):
    esc = lambda v: str(v if v is not None else "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return "{" + ",".join('%s="%s"' % (k, esc(v)) for k, v in kv.items()) + "}"


def prometheus_text(state):
    m = {}

    def add(name, help_, labels, value):
        m.setdefault(name, (help_, []))[1].append("%s%s %s" % (name, _lbl(**labels) if labels else "", value))

    for c in state["clusters"]:
        C = {"cluster": c["cluster"]}
        add("vmware_cluster_status", "Trang thai cluster tren vCenter (0=green,1=yellow,2=red,3=gray)", C, c["status"])
        if c["vsan_health"] is not None:
            add("vmware_cluster_vsan_health", "Health tong vSAN - Skyline (0=green,1=yellow,2=red,3=unknown)",
                C, c["vsan_health"])
        add("vmware_cluster_drs_mode", "DRS (0=tat,1=manual,2=partiallyAutomated,3=fullyAutomated)", C, c["drs"])
        add("vmware_cluster_hosts", "So host trong cluster", C, c["hosts"])
        add("vmware_cluster_hosts_effective", "So host dang hoat dong (effective)", C, c["hosts_effective"])
        if c["vms_total"] is not None:
            add("vmware_cluster_vms_total", "Tong so VM trong cluster", C, c["vms_total"])
            add("vmware_cluster_vms_powered_off", "So VM dang tat", C, c["vms_off"])
        add("vmware_cluster_cpu_total_hz", "Tong CPU cua cluster (Hz)", C, int(c["cpu_total_hz"]))
        add("vmware_cluster_cpu_used_hz", "CPU dang dung cua cac host (Hz)", C, int(c["cpu_used_hz"]))
        add("vmware_cluster_mem_total_bytes", "Tong RAM cua cluster (bytes)", C, c["mem_total_bytes"])
        add("vmware_cluster_mem_used_bytes", "RAM dang dung cua cac host (bytes)", C, int(c["mem_used_bytes"]))
        if c["vsan_capacity"] is not None:
            add("vmware_cluster_vsan_capacity_bytes", "Dung luong vSAN datastore (bytes)", C, c["vsan_capacity"])
            add("vmware_cluster_vsan_free_bytes", "Dung luong vSAN con trong (bytes)", C, c["vsan_free"])
        if c["resync"] is not None:
            add("vmware_cluster_vsan_resync_objects", "So object vSAN dang resync", C, c["resync"][0])
            add("vmware_cluster_vsan_resync_bytes", "Dung luong con phai resync (bytes)", C, c["resync"][1])
        if c["host_uptime_max"] is not None:
            add("vmware_cluster_host_uptime_max_seconds", "Uptime cua host chay lau nhat (giay)", C, c["host_uptime_max"])
            add("vmware_cluster_host_cpu_max_percent", "CPU (%) cua host cao nhat", C, round(c["host_cpu_max"], 2))
            add("vmware_cluster_host_mem_max_percent", "RAM (%) cua host cao nhat", C, round(c["host_mem_max"], 2))

    add("vmware_cluster_exporter_up", "Lan lay du lieu gan nhat thanh cong (1/0)", None, state["up"])
    add("vmware_cluster_exporter_last_success_timestamp_seconds", "Thoi diem lay du lieu thanh cong gan nhat",
        None, state["last_success"])
    add("vmware_cluster_exporter_collect_duration_seconds", "Thoi gian lay du lieu 1 vong", None, state["duration"])
    add("vmware_cluster_exporter_build_info", "Phien ban exporter dang chay (gia tri = 1)", {"version": VERSION}, 1)

    lines = []
    for name, (help_, samples) in m.items():
        lines += ["# HELP %s %s" % (name, help_), "# TYPE %s gauge" % name] + samples
    return "\n".join(lines) + "\n"


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    vc = sys.argv[1].replace("https://", "").split("/")[0]
    user = sys.argv[2]
    cluster = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "-" else None
    port = int(sys.argv[4]) if len(sys.argv) > 4 else 9821
    interval = int(sys.argv[5]) if len(sys.argv) > 5 else 60
    pwd = os.environ.get("VC_PASS") or getpass.getpass("Password: ")

    state = {"clusters": [], "up": 0, "last_success": 0, "duration": 0}
    lock = threading.Lock()
    cache = {}

    def loop():
        while True:
            t0 = time.time()
            try:
                cl = collect(vc, user, pwd, cluster, cache)
                with lock:
                    state.update(clusters=cl, up=1, last_success=int(time.time()), duration=round(time.time() - t0, 2))
                print("[%s] OK: %d cluster (%.1fs)" % (time.strftime("%H:%M:%S"), len(cl), time.time() - t0), flush=True)
            except vim.fault.InvalidLogin:
                print("Dang nhap that bai: sai user hoac mat khau. Dung exporter.", flush=True)
                os._exit(3)  # ma 3 = sai mat khau; systemd RestartPreventExitStatus=3 -> khong thu lai, tranh khoa tai khoan
            except Exception as e:  # giu du lieu cu, bao up=0
                with lock:
                    state.update(up=0, duration=round(time.time() - t0, 2))
                print("[%s] LOI: %s" % (time.strftime("%H:%M:%S"), getattr(e, "msg", None) or e), flush=True)
            time.sleep(max(1, interval - (time.time() - t0)))

    class Handler(BaseHTTPRequestHandler):
        def send(self, body, ctype):
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/metrics":
                with lock:
                    body = prometheus_text(state)
                self.send(body.encode("utf-8"), "text/plain; version=0.0.4; charset=utf-8")
            elif path in ("/", "/index.html"):
                self.send(("VMware cluster exporter v%s - vCenter %s - xem /metrics\n" % (VERSION, vc)).encode(),
                          "text/plain; charset=utf-8")
            else:
                self.send_error(404, "Dung /metrics")

        def log_message(self, *a):
            pass

    threading.Thread(target=loop, daemon=True).start()
    print("VMware cluster exporter v%s: Prometheus http://0.0.0.0:%d/metrics (lay du lieu moi %ds)"
          % (VERSION, port, interval), flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Da dung.")
