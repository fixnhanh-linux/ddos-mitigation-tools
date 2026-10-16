# VMWARE CLUSTER HCM — dashboard lưới ô theo cluster

Dashboard Grafana tổng quan từng cluster VMware: mỗi cluster 1 khối gồm 15 ô màu
(xanh = tốt, cam = cảnh báo, đỏ = lỗi), cố định 4 cột × 4 hàng (ô Cluster Status rộng gấp đôi), 3 cluster / hàng.

Danh sách cluster nằm trong `CLUSTERS` của `make_dashboard.py` (tên đúng như trên vCenter):
`CORE`, `POOL17`, `POOL18-XD`, `POOL23`, `POOL25`, `VC1_POOL6`. POOL23 hiện chưa có trong exporter nào
(9811–9814 chỉ thấy 5 cluster trên) nên khối POOL23 sẽ hiện "–" cho tới khi có vCenter chứa nó.
Thêm/bớt/đổi tên cluster: sửa `CLUSTERS`, chạy `python make_dashboard.py`, import lại (Overwrite).

Bộ này **tách riêng hoàn toàn** khỏi bộ cũ *MONITOR RESOURCE HOST ESXi* (`esxi-host-exporter`):
exporter, service, thư mục, user, port, metric, scrape job và dashboard đều có tên riêng,
cài song song mà không đụng tới exporter cũ đang chạy trên 10.16.16.38.

| | Bộ mới (thư mục này) | Bộ cũ (giữ nguyên) |
|---|---|---|
| Gói cài | `vmware-cluster-exporter-linux.zip` + `.sha256` | `esxi-host-exporter-linux.zip` |
| Service | `vmware-cluster-exporter@<tên>` | `esxi-host-exporter@<tên>` |
| Chương trình / cấu hình | `/opt/vmware-cluster-exporter`, `/etc/vmware-cluster-exporter/` | `/opt/esxi-host-exporter`, `/etc/esxi-host-exporter/` |
| User chạy service | `vmware-cluster` | `esxi-exporter` |
| Port | **9821** pool18 · **9822** pool25 · **9823** pool6 · **9824** core | 9811 · 9812 · 9813 · 9814 |
| Metric | `vmware_cluster_*` | `esxi_host_*`, `esxi_vsan_*`, `vsan_disk_*` |
| Prometheus job | `vmware_cluster` (`vmware-cluster.yml`) | `esxi_host_resource` (`esxi-host-resource.yml`) |
| Dashboard | **VMWARE CLUSTER HCM** (uid `vmware-cluster-hcm`) | MONITOR RESOURCE HOST ESXi |

Exporter mới chỉ lấy số liệu cấp cluster (không lấy disk health, NIC, vmk) nên nhẹ cho vCenter.

| File | Dùng để |
|---|---|
| `vmware-cluster-exporter-linux.zip` + `.sha256` | Gói cài exporter mới (bản 2026.10.16-2) |
| `vmware_cluster_hcm_grafana.json` | Dashboard để import vào Grafana (cũng có trong gói zip) |
| `vmware-cluster-exporter/` | Mã nguồn gói: exporter, install/uninstall, systemd unit, scrape config |
| `make_dashboard.py` | Sinh lại dashboard khi đổi ngưỡng màu / thứ tự ô |
| `build_package.py` | Đóng gói lại zip + sha256 (lấy pyVmomi từ gói esxi-host-exporter) |

## 1. Cài exporter mới trên server (song song với bộ cũ)

```bash
scp vmware-cluster-exporter-linux.zip vmware-cluster-exporter-linux.zip.sha256 root@10.16.16.38:/home/
```

Trên server:

```bash
cd /home && sha256sum -c vmware-cluster-exporter-linux.zip.sha256     # phai in ra OK
rm -rf vmware-cluster-exporter && unzip -o vmware-cluster-exporter-linux.zip && cd vmware-cluster-exporter
grep -hE '^(VC|VC_USER|CLUSTER|PORT)=' /etc/esxi-host-exporter/*.env   # xem lai VC/user/cluster cua bo cu (khong in mat khau)
```

Cài 4 instance, mỗi lệnh sẽ hỏi mật khẩu vCenter (bạn tự nhập; điền `VC`/`VC_USER`/`CLUSTER` theo kết quả lệnh grep trên):

```bash
sudo NAME=pool18 VC=10.2.164.18 VC_USER=<user> CLUSTER=- PORT=9821 ./install.sh
sudo NAME=pool25 VC=<vcenter-pool25> VC_USER=<user> CLUSTER=- PORT=9822 ./install.sh
sudo NAME=pool6  VC=<vcenter-pool6>  VC_USER=<user> CLUSTER=- PORT=9823 ./install.sh
sudo NAME=core   VC=<vcenter-core>   VC_USER=<user> CLUSTER=- PORT=9824 ./install.sh
```

Kiểm tra (bộ cũ 9811–9814 vẫn chạy bình thường):

```bash
for p in 9821 9822 9823 9824; do echo -n "$p: "; curl -s localhost:$p/metrics | grep -o 'version="[^"]*"' || echo "CHUA CHAY"; done
curl -s localhost:9821/metrics | grep '^vmware_cluster_hosts'
systemctl status 'esxi-host-exporter@*' --no-pager | grep Active      # bo cu: van active (running)
```

## 2. Thêm scrape job vào Prometheus

```bash
cp prometheus-vmware-cluster.yml /etc/prometheus/scrape_configs/vmware-cluster.yml
promtool check config /etc/prometheus/prometheus.yml && systemctl reload prometheus
```

Nếu `prometheus.yml` liệt kê từng file thay vì `scrape_configs/*.yml`, thêm `vmware-cluster.yml` vào
`scrape_config_files`. Sửa nhãn `site`/`pool` trong file cho giống `esxi-host-resource.yml` nếu cần.

## 2a. Đẩy thêm lên InfluxDB 2.x (tuỳ chọn)

Exporter vẫn phục vụ `/metrics` cho Prometheus (dashboard đọc từ Prometheus), đồng thời sau mỗi vòng lấy dữ liệu
gửi toàn bộ metric lên InfluxDB: mỗi metric → 1 measurement cùng tên (vd `vmware_cluster_cpu_used_hz`),
nhãn → tag (`cluster`, `vcenter`), giá trị → field `value`, precision giây. Khoảng 20 dòng / cluster / phút.

`install.sh` hỏi URL, org, bucket, token InfluxDB khi cài (Enter ở câu URL = không đẩy). Hoặc bỏ dấu `#` các dòng INFLUX trong `/etc/vmware-cluster-exporter/<instance>.env`, điền token (quyền write bucket),
rồi restart instance. Chạy lại `install.sh` sẽ giữ nguyên các dòng INFLUX đã điền.

```bash
INFLUX_URL='http://10.16.16.x:8086'
INFLUX_ORG='fpt'
INFLUX_BUCKET='vmware'
INFLUX_TOKEN='<token co quyen write bucket>'
```

```bash
systemctl restart vmware-cluster-exporter@pool18
journalctl -u vmware-cluster-exporter@pool18 -f     # phai thay "InfluxDB: da gui ... dong"
```

Lỗi InfluxDB (sai token, mất kết nối…) chỉ ghi log `InfluxDB LOI`, không ảnh hưởng `/metrics`.
Truy vấn mẫu (Flux):
`from(bucket:"vmware") |> range(start:-1h) |> filter(fn:(r)=> r._measurement=="vmware_cluster_hosts" and r.cluster=="POOL17")`.
InfluxDB 1.x: thay 4 dòng trên bằng `INFLUX_URL` + `INFLUX_DB` (+ `INFLUX_USER`, `INFLUX_PASSWORD`).

## 2b. Import dashboard

Grafana → Dashboards → New → Import → upload `vmware_cluster_hcm_grafana.json` → chọn Prometheus → Import.
Dashboard có uid riêng `vmware-cluster-hcm` nên không ghi đè dashboard nào cũ.
Bấm biểu tượng link cạnh tên cluster để mở dashboard **MONITOR RESOURCE HOST ESXi** đã lọc sẵn cluster đó.

Nếu trước đó đã import bản thử "CLUSTER VMWARE HCM" (uid `cluster-vmware-hcm`), có thể xoá bản đó đi.

## 3. Các ô và nguồn số liệu

| Ô | Metric | Màu |
|---|---|---|
| Cluster Status | `vmware_cluster_vsan_health` (vSAN Skyline Health), không có vSAN thì `vmware_cluster_status` | HEALTHY xanh · WARNING cam · ERROR đỏ |
| DRS | `vmware_cluster_drs_mode` | Manual / Partially / Fully Automated xanh · Tắt cam |
| Total Host | `vmware_cluster_hosts` | xanh |
| Total VM | `vmware_cluster_vms_total` (cả VM đang tắt) | xanh |
| CPU Total | `vmware_cluster_cpu_total_hz` | xanh |
| CPU Used | `cpu_used_hz / cpu_total_hz` | cam ≥ 20% · đỏ ≥ 50% |
| Ram Total | `vmware_cluster_mem_total_bytes` | xanh |
| Ram Used | `mem_used_bytes / mem_total_bytes` | cam ≥ 80% · đỏ ≥ 90% |
| vSAN Total / Free | `vmware_cluster_vsan_capacity_bytes` / `_free_bytes` (vSAN datastore) | xanh |
| vSAN Used | `(capacity − free) / capacity` | cam ≥ 70% · đỏ ≥ 80% |
| vSAN Resync | `vmware_cluster_vsan_resync_bytes` | cam khi > 0 |
| Host - Uptime | `vmware_cluster_host_uptime_max_seconds` (host chạy lâu nhất, ngày) | đỏ ≥ 180 ngày |
| CPU Host (Max) | `vmware_cluster_host_cpu_max_percent` | cam ≥ 30% · đỏ ≥ 35% |
| RAM Host (Max) | `vmware_cluster_host_mem_max_percent` | cam ≥ 76% · đỏ ≥ 80% |

Ngưỡng được suy ra từ màu của dashboard mẫu. Đổi ngưỡng: sửa bảng `THRESHOLDS` trong `make_dashboard.py`,
chạy `python make_dashboard.py`, import lại (Overwrite).

## 4. Khác với dashboard cũ

- **CPU Total** hiển thị đúng đơn vị: POOL17 = 3,22 **THz** (3.224.928 MHz). Dashboard cũ ghi "3.22 GHz" là sai đơn vị.
- **Cluster Status** lấy từ vSAN Health thật của vCenter. Lúc kiểm tra (16/10/2026), POOL17 và POOL18-XD đều
  **yellow – "Cluster health issue"** nên ô hiện **WARNING** (dashboard cũ ghi HEALTHY). Xem chi tiết trong
  vCenter → Cluster → Monitor → vSAN → Skyline Health.

## 5. Đối chiếu số liệu thật (16/10/2026, vCenter 10.2.164.18)

| Ô | POOL17 | POOL18-XD |
|---|---|---|
| Total Host / VM | 41 / 810 | 46 / 694 |
| DRS | Manual | Fully Automated |
| CPU Total / Used | 3,22 THz / 16,8% | 5,11 THz / 16,1% |
| Ram Total / Used | 10,73 TB / 67,5% | 14,97 TB / 69,1% |
| vSAN Total / Used / Free | 132,7 TiB / 62,2% / 50,1 TiB | 165,9 TiB / 60,8% / 65,1 TiB |
| Host Uptime / CPU Max / RAM Max | 185 d / 41,8% / 78,8% | 122 d / 38,3% / 83,9% |
