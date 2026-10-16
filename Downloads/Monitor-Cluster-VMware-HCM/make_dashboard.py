#!/usr/bin/env python3
"""Sinh dashboard Grafana "VMWARE CLUSTER HCM" - luoi o mau theo tung cluster.

Chay:  python make_dashboard.py            -> ghi vmware_cluster_hcm_grafana.json (+ ban trong vmware-cluster-exporter/)
Doi nguong mau: sua bang THRESHOLDS ben duoi roi chay lai, import lai Grafana (Overwrite).
Du lieu: metric vmware_cluster_* cua vmware-cluster-exporter (rieng, khong dung esxi-host-exporter).
"""
import json
import os

TITLE = "VMWARE CLUSTER HCM"
DS = {"type": "prometheus", "uid": "${datasource}"}
C = 'cluster="$cluster"'  # $cluster duoc thay bang ten tung cluster trong CLUSTERS

# Nguong mau (xanh -> cam -> do). None = khong dung muc do.
THRESHOLDS = {
    "CPU Used": (20, 50),         # % CPU dang dung cua ca cluster
    "Ram Used": (80, 90),         # % RAM dang dung cua ca cluster
    "vSAN Used": (70, 80),        # % dung luong vSAN da dung
    "Host - Uptime": (None, 180),  # ngay - host chay lau nhat, do khi >= 180 ngay (can va/patch)
    "CPU Host (Max)": (30, 35),    # % CPU cua host cao nhat
    "RAM Host (Max)": (76, 80),    # % RAM cua host cao nhat
}

# (ten o, PromQL, don vi, kieu mau)  - thu tu = thu tu hien tren o
TILES = [
    ("Cluster Status", "max(vmware_cluster_vsan_health{%s}) or max(vmware_cluster_status{%s})" % (C, C), "none", "status"),
    ("DRS", "max(vmware_cluster_drs_mode{%s})" % C, "none", "drs"),
    ("Total Host", "max(vmware_cluster_hosts{%s})" % C, "none", "fixed"),
    ("Total VM", "max(vmware_cluster_vms_total{%s})" % C, "none", "fixed"),
    ("CPU Total", "max(vmware_cluster_cpu_total_hz{%s})" % C, "hertz", "fixed"),
    ("CPU Used", "max(vmware_cluster_cpu_used_hz{%s}) / max(vmware_cluster_cpu_total_hz{%s}) * 100" % (C, C),
     "percent", "thr"),
    ("Ram Total", "max(vmware_cluster_mem_total_bytes{%s})" % C, "decbytes", "fixed"),
    ("Ram Used", "max(vmware_cluster_mem_used_bytes{%s}) / max(vmware_cluster_mem_total_bytes{%s}) * 100" % (C, C),
     "percent", "thr"),
    ("vSAN Total", "max(vmware_cluster_vsan_capacity_bytes{%s})" % C, "bytes", "fixed"),
    ("vSAN Used", "(max(vmware_cluster_vsan_capacity_bytes{%s}) - max(vmware_cluster_vsan_free_bytes{%s}))"
                  " / max(vmware_cluster_vsan_capacity_bytes{%s}) * 100" % (C, C, C), "percent", "thr"),
    ("vSAN Free", "max(vmware_cluster_vsan_free_bytes{%s})" % C, "bytes", "fixed"),
    ("vSAN Resync", "max(vmware_cluster_vsan_resync_bytes{%s})" % C, "bytes", "resync"),
    ("Host - Uptime", "max(vmware_cluster_host_uptime_max_seconds{%s}) / 86400" % C, "suffix: d", "thr"),
    ("CPU Host (Max)", "max(vmware_cluster_host_cpu_max_percent{%s})" % C, "percent", "thr"),
    ("RAM Host (Max)", "max(vmware_cluster_host_mem_max_percent{%s})" % C, "percent", "thr"),
]

GREEN, ORANGE, RED, GRAY = "green", "orange", "red", "#8e8e8e"


def steps(*pairs):
    return {"mode": "absolute", "steps": [{"color": c, "value": v} for v, c in pairs]}


def tile_override(ref, name, unit, kind):
    props = [{"id": "displayName", "value": name}, {"id": "unit", "value": unit}]
    if kind == "status":
        props += [{"id": "mappings", "value": [{"type": "value", "options": {
            "0": {"text": "HEALTHY", "color": GREEN, "index": 0},
            "1": {"text": "WARNING", "color": ORANGE, "index": 1},
            "2": {"text": "ERROR", "color": RED, "index": 2},
            "3": {"text": "UNKNOWN", "color": GRAY, "index": 3}}}]},
                  {"id": "thresholds", "value": steps((None, GREEN), (1, ORANGE), (2, RED), (3, GRAY))}]
    elif kind == "drs":
        props += [{"id": "mappings", "value": [{"type": "value", "options": {
            "0": {"text": "Tắt", "color": ORANGE, "index": 0},
            "1": {"text": "Manual", "color": GREEN, "index": 1},
            "2": {"text": "Partially Automated", "color": GREEN, "index": 2},
            "3": {"text": "Fully Automated", "color": GREEN, "index": 3}}}]},
                  {"id": "thresholds", "value": steps((None, ORANGE), (1, GREEN))}]
    elif kind == "resync":
        props += [{"id": "thresholds", "value": steps((None, GREEN), (1, ORANGE))}]
    elif kind == "thr":
        warn, crit = THRESHOLDS[name]
        st = [(None, GREEN)] + ([(warn, ORANGE)] if warn is not None else []) + [(crit, RED)]
        props += [{"id": "thresholds", "value": steps(*st)}, {"id": "decimals", "value": 0 if unit.startswith("suffix") else 1}]
    else:  # fixed
        props += [{"id": "thresholds", "value": steps((None, GREEN))}]
    if unit in ("hertz", "decbytes", "bytes"):
        props.append({"id": "decimals", "value": 2 if unit == "hertz" else 1})
    return {"matcher": {"id": "byFrameRefID", "options": ref}, "properties": props}


# Ten cluster dung nhu tren vCenter (nhan cluster cua metric). Them/bot cluster: sua danh sach roi chay lai.
CLUSTERS = ["CORE", "POOL17", "POOL18-XD", "POOL23", "POOL25", "VC1_POOL6"]
PER_ROW = 3          # so cluster moi hang
TILE_W, TILE_H = 2, 3  # 1 o = 2/24 chieu ngang -> 4 o / cluster / hang
# Bo cuc 1 cluster (4 cot x 4 hang): Cluster Status rong gap doi, 14 o con lai moi o 1 cot
WIDTHS = [2] + [1] * (len(TILES) - 1)


def tile_panel(pid, cluster, x, y, w, tile):
    name, expr, unit, kind = tile
    props = tile_override("A", name, unit, kind)["properties"]
    defaults = {"color": {"mode": "thresholds"}, "noValue": "–"}
    for prop in props:
        defaults[prop["id"]] = prop["value"]
    return {
        "id": pid, "type": "stat", "title": "", "datasource": DS, "transparent": False,
        "gridPos": {"x": x, "y": y, "w": w, "h": TILE_H},
        "targets": [{"datasource": DS, "refId": "A", "expr": expr.replace("$cluster", cluster),
                     "legendFormat": name, "instant": True, "range": False}],
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {"colorMode": "background", "graphMode": "none", "textMode": "value_and_name",
                    "justifyMode": "center", "orientation": "auto", "wideLayout": True,
                    "text": {"titleSize": 12, "valueSize": 16},
                    "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}},
    }


panels = [{"id": 1, "type": "row", "title": TITLE, "collapsed": False,
           "gridPos": {"x": 0, "y": 0, "w": 24, "h": 1}, "panels": []}]
block_w = 24 // PER_ROW
block_h = 1 + TILE_H * 4
pid = 2
for i, cluster in enumerate(CLUSTERS):
    bx, by = (i % PER_ROW) * block_w, 1 + (i // PER_ROW) * block_h
    panels.append({  # thanh tieu de cua cluster (chi co title + link sang dashboard host)
        "id": pid, "type": "text", "title": cluster, "transparent": True,
        "gridPos": {"x": bx, "y": by, "w": block_w, "h": 1},
        "links": [{"title": "Chi tiết host của " + cluster,
                   "url": "/d/esxi-host-resource/?var-cluster=%s&${datasource:queryparam}" % cluster}],
        "options": {"mode": "markdown", "content": ""}})
    pid += 1
    col, row = 0, 0
    for tile, w in zip(TILES, WIDTHS):
        if col + w > 4:
            col, row = 0, row + 1
        panels.append(tile_panel(pid, cluster, bx + col * TILE_W, by + 1 + row * TILE_H, w * TILE_W, tile))
        pid += 1
        col += w

dash = {
    "title": TITLE, "uid": "vmware-cluster-hcm", "tags": ["vmware", "vsan", "cluster", "vmware-cluster-exporter"],
    "description": "Tổng quan từng cluster VMware: trạng thái, DRS, host, VM, CPU/RAM, vSAN, resync, host cao nhất.",
    "timezone": "browser", "editable": True, "refresh": "1m", "schemaVersion": 39, "version": 1,
    "time": {"from": "now-1h", "to": "now"},
    "templating": {"list": [
        {"name": "datasource", "label": "Prometheus", "type": "datasource", "query": "prometheus",
         "current": {}, "refresh": 1},
    ]},
    "annotations": {"list": []},
    "panels": panels,
}

here = os.path.dirname(os.path.abspath(__file__))
for out in (os.path.join(here, "vmware_cluster_hcm_grafana.json"),
            os.path.join(here, "vmware-cluster-exporter", "vmware_cluster_hcm_grafana.json")):
    with open(out, "w", encoding="utf-8") as f:
        json.dump(dash, f, ensure_ascii=False, indent=2)
    print("Da ghi", out, "-", len(CLUSTERS), "cluster x", len(TILES), "o")
