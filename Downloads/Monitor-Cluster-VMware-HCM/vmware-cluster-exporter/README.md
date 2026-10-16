# vmware-cluster-exporter

Exporter Prometheus số liệu tổng từng cluster VMware cho dashboard Grafana **VMWARE CLUSTER HCM**.
Cài song song với `esxi-host-exporter` — không dùng chung thư mục, service, user hay port.

| | vmware-cluster-exporter (mới) | esxi-host-exporter (cũ, giữ nguyên) |
|---|---|---|
| Service | `vmware-cluster-exporter@<tên>` | `esxi-host-exporter@<tên>` |
| Chương trình | `/opt/vmware-cluster-exporter` | `/opt/esxi-host-exporter` |
| Cấu hình | `/etc/vmware-cluster-exporter/<tên>.env` | `/etc/esxi-host-exporter/<tên>.env` |
| User | `vmware-cluster` | `esxi-exporter` |
| Port | 9821–9824 | 9811–9814 |
| Metric | `vmware_cluster_*` | `esxi_host_*`, `esxi_vsan_*`, `vsan_disk_*` |
| Dashboard | VMWARE CLUSTER HCM (`vmware-cluster-hcm`) | MONITOR RESOURCE HOST ESXi |

Cài:  `sudo ./install.sh` (hỏi từng thông tin, mật khẩu vCenter nhập tay).
Gỡ:   `sudo /opt/vmware-cluster-exporter/uninstall.sh [tên]` — chỉ gỡ bộ mới.

Trong gói: `install.sh`, `uninstall.sh`, `vmware-cluster-exporter@.service`, `app/vmware_cluster_exporter.py`,
`vendor/` (pyVmomi), `prometheus-vmware-cluster.yml` (scrape job `vmware_cluster`),
`vmware_cluster_hcm_grafana.json` (dashboard).
