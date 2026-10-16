#!/usr/bin/env python3
"""Sinh template Zabbix 6.0 "VMware Cluster HCM by vmware-cluster-exporter".

Chay:  python make_zabbix_template.py   -> ghi zabbix_template_vmware_cluster_hcm.yaml
Moi host Zabbix = 1 instance exporter (pool18 9821, pool25 9822, pool6 9823, core 9824):
  HTTP agent doc http://{HOST.CONN}:{$VMC.PORT}/metrics, LLD tu tim cluster theo metric vmware_cluster_hosts.
Nguong trigger = macro (giong nguong mau dashboard Grafana), doi theo tung cluster bang macro context
  vd {$VMC.CPU.WARN:"POOL17"} = 40.
UUID sinh co dinh tu key -> import lai (cap nhat) khong tao trung.
"""
import os
import uuid

import yaml

TPL = "VMware Cluster HCM by vmware-cluster-exporter"
GROUP = "Templates/VMware"
NS = uuid.UUID("6b1f3c4e-8a52-4d0e-9a6c-5e7d2f1b0c93")
C = "{#CLUSTER}"


def uid(*parts):
    # Zabbix chi nhan UUIDv4: lay bam co dinh (uuid5) roi dat lai bit version=4 / variant -> import lai khong trung
    return uuid.UUID(bytes=uuid.uuid5(NS, "|".join(parts)).bytes, version=4).hex


def pattern(metric, labeled=True, handler="DISCARD_VALUE"):
    expr = '%s{cluster="%s"}' % (metric, C) if labeled else metric
    return [{"type": "PROMETHEUS_PATTERN", "parameters": [expr, "value", ""],
             "error_handler": handler}]


def ref(key):
    return "/%s/%s" % (TPL, key)


MACROS = [
    ("{$VMC.PORT}", "9821", "Exporter port: pool18 9821, pool25 9822, pool6 9823, core 9824"),
    ("{$VMC.SCORE.WARN}", "80", "vSAN Skyline Health score below this -> Warning"),
    ("{$VMC.SCORE.CRIT}", "60", "vSAN Skyline Health score below this -> High"),
    ("{$VMC.CPU.WARN}", "20", "Cluster CPU usage (%) -> Warning"),
    ("{$VMC.CPU.CRIT}", "50", "Cluster CPU usage (%) -> High"),
    ("{$VMC.MEM.WARN}", "80", "Cluster memory usage (%) -> Warning"),
    ("{$VMC.MEM.CRIT}", "90", "Cluster memory usage (%) -> High"),
    ("{$VMC.VSAN.WARN}", "70", "vSAN used space (%) -> Warning"),
    ("{$VMC.VSAN.CRIT}", "80", "vSAN used space (%) -> High"),
    ("{$VMC.HOST.CPU.WARN}", "30", "Busiest host CPU (%) -> Warning"),
    ("{$VMC.HOST.CPU.CRIT}", "35", "Busiest host CPU (%) -> Average"),
    ("{$VMC.HOST.MEM.WARN}", "76", "Busiest host memory (%) -> Warning"),
    ("{$VMC.HOST.MEM.CRIT}", "80", "Busiest host memory (%) -> Average"),
    ("{$VMC.UPTIME.MAX}", "180d", "Host uptime above this -> Info (needs patching)"),
    ("{$VMC.RESYNC.TIME}", "30m", "vSAN resync running longer than this -> Warning"),
    ("{$VMC.NODATA}", "5m", "No data from /metrics for this long -> High"),
]

VALUEMAPS = {
    "VMware color status": [("0", "green"), ("1", "yellow"), ("2", "red"), ("3", "gray")],
    "vSAN health": [("0", "green"), ("1", "yellow"), ("2", "red"), ("3", "unknown")],
    "VMware DRS mode": [("0", "Disabled"), ("1", "Manual"), ("2", "Partially Automated"), ("3", "Fully Automated")],
    "Exporter up": [("0", "Error"), ("1", "OK")],
}


def trig(name, expr, priority, desc="", depends=None):
    t = {"uuid": uid("trigger", expr), "expression": expr, "name": name, "priority": priority}
    if desc:
        t["description"] = desc
    if depends:
        t["dependencies"] = [{"name": depends[0], "expression": depends[1]}]
    return t


def two_level(label, key, warn, crit, func, crit_prio="HIGH", unit="%"):
    """Cap Warning + cap cao hon; Warning phu thuoc cap cao de khong bao 2 lan."""
    fn = func % ref(key)  # vd min(/Template/key,5m)
    ctx = lambda m: '{%s:"%s"}' % (m[1:-1], C)  # {$VMC.CPU.CRIT} -> {$VMC.CPU.CRIT:"{#CLUSTER}"}
    hi = ("Cluster %s: %s >= %s%s" % (C, label, ctx(crit), unit), "%s>=%s" % (fn, ctx(crit)))
    lo = ("Cluster %s: %s >= %s%s" % (C, label, ctx(warn), unit), "%s>=%s" % (fn, ctx(warn)))
    return [trig(hi[0], hi[1], crit_prio), trig(lo[0], lo[1], "WARNING", depends=hi)]


# (ten, key, metric, value_type, units, valuemap, mo ta)
RAW = [
    ("vCenter status", "vmc.cluster.status", "vmware_cluster_status", "UNSIGNED", "", "VMware color status",
     "Cluster overallStatus reported by vCenter"),
    ("vSAN overall health", "vmc.cluster.vsan.health", "vmware_cluster_vsan_health", "UNSIGNED", "", "vSAN health",
     "vSAN Skyline Health overallHealth - red as soon as one check is red"),
    ("vSAN health score", "vmc.cluster.vsan.score", "vmware_cluster_vsan_health_score", "UNSIGNED", "", None,
     "Cluster health score (0-100) shown in vCenter > Monitor > vSAN > Skyline Health"),
    ("DRS", "vmc.cluster.drs", "vmware_cluster_drs_mode", "UNSIGNED", "", "VMware DRS mode", ""),
    ("Hosts", "vmc.cluster.hosts", "vmware_cluster_hosts", "UNSIGNED", "", None, ""),
    ("Effective hosts", "vmc.cluster.hosts.effective", "vmware_cluster_hosts_effective", "UNSIGNED", "", None, ""),
    ("Total VMs", "vmc.cluster.vms", "vmware_cluster_vms_total", "UNSIGNED", "", None, "Includes powered-off VMs"),
    ("Powered-off VMs", "vmc.cluster.vms.off", "vmware_cluster_vms_powered_off", "UNSIGNED", "", None, ""),
    ("CPU total", "vmc.cluster.cpu.total", "vmware_cluster_cpu_total_hz", "FLOAT", "Hz", None, ""),
    ("CPU used", "vmc.cluster.cpu.used", "vmware_cluster_cpu_used_hz", "FLOAT", "Hz", None, ""),
    ("Memory total", "vmc.cluster.mem.total", "vmware_cluster_mem_total_bytes", "FLOAT", "B", None, ""),
    ("Memory used", "vmc.cluster.mem.used", "vmware_cluster_mem_used_bytes", "FLOAT", "B", None, ""),
    ("vSAN capacity", "vmc.cluster.vsan.total", "vmware_cluster_vsan_capacity_bytes", "FLOAT", "B", None, ""),
    ("vSAN free", "vmc.cluster.vsan.free", "vmware_cluster_vsan_free_bytes", "FLOAT", "B", None, ""),
    ("vSAN resync", "vmc.cluster.vsan.resync.bytes", "vmware_cluster_vsan_resync_bytes", "FLOAT", "B", None,
     "Bytes left to resync"),
    ("vSAN resync objects", "vmc.cluster.vsan.resync.objects", "vmware_cluster_vsan_resync_objects", "UNSIGNED", "",
     None, ""),
    ("Longest host uptime", "vmc.cluster.host.uptime.max", "vmware_cluster_host_uptime_max_seconds", "UNSIGNED",
     "uptime", None, ""),
    ("Busiest host CPU", "vmc.cluster.host.cpu.max", "vmware_cluster_host_cpu_max_percent", "FLOAT", "%", None, ""),
    ("Busiest host memory", "vmc.cluster.host.mem.max", "vmware_cluster_host_mem_max_percent", "FLOAT", "%", None, ""),
]
CALC = [
    ("CPU usage (%)", "vmc.cluster.cpu.pused",
     "last(//vmc.cluster.cpu.used[%s])/last(//vmc.cluster.cpu.total[%s])*100" % (C, C)),
    ("Memory usage (%)", "vmc.cluster.mem.pused",
     "last(//vmc.cluster.mem.used[%s])/last(//vmc.cluster.mem.total[%s])*100" % (C, C)),
    ("vSAN used (%)", "vmc.cluster.vsan.pused",
     "(last(//vmc.cluster.vsan.total[%s])-last(//vmc.cluster.vsan.free[%s]))/last(//vmc.cluster.vsan.total[%s])*100"
     % (C, C, C)),
]


def k(key):
    return "%s[%s]" % (key, C)


def item_prototypes():
    out = []
    for name, key, metric, vt, units, vmap, desc in RAW:
        it = {"uuid": uid("proto", key), "name": "Cluster %s: %s" % (C, name), "type": "DEPENDENT", "key": k(key),
              "delay": "0", "history": "30d", "value_type": vt,
              "preprocessing": pattern(metric), "master_item": {"key": "vmc.metrics"},
              "tags": [{"tag": "component", "value": "cluster"}, {"tag": "cluster", "value": C}]}
        if units:
            it["units"] = units
        if desc:
            it["description"] = desc
        if vmap:
            it["valuemap"] = {"name": vmap}
        out.append(it)
    for name, key, formula in CALC:
        out.append({"uuid": uid("proto", key), "name": "Cluster %s: %s" % (C, name), "type": "CALCULATED",
                    "key": k(key), "delay": "1m", "history": "30d", "value_type": "FLOAT", "units": "%",
                    "params": formula,
                    "tags": [{"tag": "component", "value": "cluster"}, {"tag": "cluster", "value": C}]})
    by_key = {i["key"]: i for i in out}

    def add(key, triggers):
        by_key[k(key)].setdefault("trigger_prototypes", []).extend(triggers)

    score = ref(k("vmc.cluster.vsan.score"))
    hi = ("Cluster %s: vSAN health score < {$VMC.SCORE.CRIT}" % C,
          'last(%s)<{$VMC.SCORE.CRIT:"%s"}' % (score, C))
    add("vmc.cluster.vsan.score", [
        trig(hi[0], hi[1], "HIGH", "Check vCenter > Cluster > Monitor > vSAN > Skyline Health"),
        trig("Cluster %s: vSAN health score < {$VMC.SCORE.WARN}" % C,
             'last(%s)<{$VMC.SCORE.WARN:"%s"}' % (score, C), "WARNING", depends=hi)])
    add("vmc.cluster.vsan.health", [trig(
        "Cluster %s: vSAN Skyline Health has a red check" % C, "last(%s)=2" % ref(k("vmc.cluster.vsan.health")), "INFO",
        "vSAN overall health is red (at least one Unhealthy finding). Main alerting uses the health score.")])
    add("vmc.cluster.status", [trig(
        "Cluster %s: vCenter reports status red" % C, "last(%s)=2" % ref(k("vmc.cluster.status")), "AVERAGE")])
    add("vmc.cluster.drs", [trig(
        "Cluster %s: DRS is disabled" % C, "last(%s)=0" % ref(k("vmc.cluster.drs")), "INFO")])
    add("vmc.cluster.cpu.pused", two_level("CPU used", k("vmc.cluster.cpu.pused"),
                                           "{$VMC.CPU.WARN}", "{$VMC.CPU.CRIT}", "min(%s,5m)"))
    add("vmc.cluster.mem.pused", two_level("Memory used", k("vmc.cluster.mem.pused"),
                                           "{$VMC.MEM.WARN}", "{$VMC.MEM.CRIT}", "min(%s,5m)"))
    add("vmc.cluster.vsan.pused", two_level("vSAN used", k("vmc.cluster.vsan.pused"),
                                            "{$VMC.VSAN.WARN}", "{$VMC.VSAN.CRIT}", "last(%s)"))
    add("vmc.cluster.host.cpu.max", two_level("Busiest host CPU", k("vmc.cluster.host.cpu.max"),
                                              "{$VMC.HOST.CPU.WARN}", "{$VMC.HOST.CPU.CRIT}", "min(%s,5m)", "AVERAGE"))
    add("vmc.cluster.host.mem.max", two_level("Busiest host memory", k("vmc.cluster.host.mem.max"),
                                              "{$VMC.HOST.MEM.WARN}", "{$VMC.HOST.MEM.CRIT}", "min(%s,5m)", "AVERAGE"))
    add("vmc.cluster.vsan.resync.bytes", [trig(
        "Cluster %s: vSAN resync running longer than {$VMC.RESYNC.TIME}" % C,
        "min(%s,{$VMC.RESYNC.TIME})>0" % ref(k("vmc.cluster.vsan.resync.bytes")), "WARNING")])
    add("vmc.cluster.host.uptime.max", [trig(
        "Cluster %s: a host has been up longer than {$VMC.UPTIME.MAX}" % C,
        'last(%s)>={$VMC.UPTIME.MAX:"%s"}' % (ref(k("vmc.cluster.host.uptime.max")), C), "INFO",
        "Long-running hosts should be patched / rebooted")])
    return out


def trigger_prototypes():
    eff, hosts = ref(k("vmc.cluster.hosts.effective")), ref(k("vmc.cluster.hosts"))
    return [trig("Cluster %s: some hosts are not effective" % C, "last(%s)<last(%s)" % (eff, hosts), "AVERAGE",
                 "Effective hosts < total hosts: a host is disconnected, in maintenance or not responding")]


def graph_prototypes():
    items = [("vmc.cluster.cpu.pused", "1A7C11"), ("vmc.cluster.mem.pused", "2774A4"),
             ("vmc.cluster.vsan.pused", "F63100"), ("vmc.cluster.host.cpu.max", "A54F10"),
             ("vmc.cluster.host.mem.max", "6C59DC")]
    return [{"uuid": uid("graph", "usage"), "name": "Cluster %s: resource usage (%%)" % C,
             "ymin_type_1": "FIXED", "ymax_type_1": "FIXED", "yaxismax": "100",
             "graph_items": [{"sortorder": str(i), "color": c, "item": {"host": TPL, "key": k(key)}}
                             for i, (key, c) in enumerate(items)]}]


def exporter_items():
    up = ref("vmc.exporter.up")
    nodata = ("Exporter: no data from /metrics for {$VMC.NODATA}", "nodata(%s,{$VMC.NODATA})=1" % up)
    return [
        {"uuid": uid("item", "vmc.metrics"), "name": "Exporter: /metrics", "type": "HTTP_AGENT", "key": "vmc.metrics",
         "delay": "1m", "history": "0", "trends": "0", "value_type": "TEXT", "timeout": "15s",
         "url": "http://{HOST.CONN}:{$VMC.PORT}/metrics",
         "description": "Master item: all metrics from vmware-cluster-exporter (no history kept)",
         "tags": [{"tag": "component", "value": "raw"}]},
        {"uuid": uid("item", "vmc.exporter.up"), "name": "Exporter: vCenter collection", "type": "DEPENDENT",
         "key": "vmc.exporter.up", "delay": "0", "history": "7d", "value_type": "UNSIGNED",
         "master_item": {"key": "vmc.metrics"}, "valuemap": {"name": "Exporter up"},
         "preprocessing": pattern("vmware_cluster_exporter_up", labeled=False, handler=None),
         "tags": [{"tag": "component", "value": "exporter"}],
         "triggers": [
             trig("Exporter: cannot collect data from vCenter", "last(%s)=0" % up, "HIGH",
                  "Check the log: journalctl -u vmware-cluster-exporter@<instance> -n 50", depends=nodata),
             trig(nodata[0], nodata[1], "HIGH", "Check the vmware-cluster-exporter service and firewall port {$VMC.PORT}"),
         ]},
        {"uuid": uid("item", "vmc.exporter.last_success"), "name": "Exporter: last successful collection",
         "type": "DEPENDENT", "key": "vmc.exporter.last_success", "delay": "0", "history": "7d",
         "value_type": "UNSIGNED", "units": "unixtime", "master_item": {"key": "vmc.metrics"},
         "preprocessing": pattern("vmware_cluster_exporter_last_success_timestamp_seconds", labeled=False, handler=None),
         "tags": [{"tag": "component", "value": "exporter"}],
         "triggers": [trig("Exporter: data older than 10 minutes",
                           "fuzzytime(%s,10m)=0" % ref("vmc.exporter.last_success"), "WARNING",
                           depends=nodata)]},
        {"uuid": uid("item", "vmc.exporter.duration"), "name": "Exporter: collection duration", "type": "DEPENDENT",
         "key": "vmc.exporter.duration", "delay": "0", "history": "7d", "value_type": "FLOAT", "units": "s",
         "master_item": {"key": "vmc.metrics"},
         "preprocessing": pattern("vmware_cluster_exporter_collect_duration_seconds", labeled=False, handler=None),
         "tags": [{"tag": "component", "value": "exporter"}]},
        {"uuid": uid("item", "vmc.exporter.version"), "name": "Exporter: version", "type": "DEPENDENT",
         "key": "vmc.exporter.version", "delay": "0", "history": "7d", "trends": "0", "value_type": "CHAR",
         "master_item": {"key": "vmc.metrics"},
         "preprocessing": [{"type": "PROMETHEUS_PATTERN",
                            "parameters": ["vmware_cluster_exporter_build_info", "label", "version"]},
                           {"type": "DISCARD_UNCHANGED_HEARTBEAT", "parameters": ["1d"]}],
         "tags": [{"tag": "component", "value": "exporter"}]},
    ]


def clean(items):
    for it in items:
        for p in it.get("preprocessing", []):
            if p.get("error_handler") is None:
                p.pop("error_handler", None)
    return items


template = {
    "uuid": uid("template", TPL), "template": TPL, "name": TPL,
    "description": "Per-cluster VMware totals from vmware-cluster-exporter (vmware_cluster_* metrics).\n"
                   "One host per exporter instance: set macro {$VMC.PORT} (9821 pool18, 9822 pool25, 9823 pool6, "
                   "9824 core) and an interface with IP 10.16.16.38.\n"
                   "Thresholds are macros matching the Grafana dashboard VMWARE CLUSTER HCM colors.",
    "groups": [{"name": GROUP}],
    "items": clean(exporter_items()),
    "discovery_rules": [{
        "uuid": uid("lld", "vmc.cluster.discovery"), "name": "Cluster discovery", "type": "DEPENDENT",
        "key": "vmc.cluster.discovery", "delay": "0", "master_item": {"key": "vmc.metrics"},
        "lifetime": "7d",
        "preprocessing": [{"type": "PROMETHEUS_TO_JSON", "parameters": ["vmware_cluster_hosts"]}],
        "lld_macro_paths": [{"lld_macro": C, "path": "$.labels.cluster"}],
        "item_prototypes": clean(item_prototypes()),
        "trigger_prototypes": trigger_prototypes(),
        "graph_prototypes": graph_prototypes(),
    }],
    "tags": [{"tag": "class", "value": "virtualization"}, {"tag": "target", "value": "vmware-cluster"}],
    "macros": [{"macro": m, "value": v, "description": d} for m, v, d in MACROS],
    "valuemaps": [{"uuid": uid("valuemap", n), "name": n,
                   "mappings": [{"value": v, "newvalue": t} for v, t in maps]} for n, maps in VALUEMAPS.items()],
}

doc = {"zabbix_export": {"version": "6.0", "date": "2026-10-17T00:00:00Z",
                         "groups": [{"uuid": uid("group", GROUP), "name": GROUP}],
                         "templates": [template]}}


class Dumper(yaml.SafeDumper):
    pass


Dumper.add_representer(str, lambda d, s: d.represent_scalar(
    "tag:yaml.org,2002:str", s, style="|" if "\n" in s else ("'" if any(c in s for c in "{}[]:#,\"'&*!|>%@`") or
                                                              s.isdigit() or s in ("", "0") else None)))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zabbix_template_vmware_cluster_hcm.yaml")
with open(out, "w", encoding="utf-8", newline="\n") as f:
    yaml.dump(doc, f, Dumper=Dumper, allow_unicode=True, sort_keys=False, width=200, indent=2)
print("Da ghi", out)
