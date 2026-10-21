# Hướng dẫn cài đặt Treafix Proxy BB (4 site, Traefik)

Tài liệu này hướng dẫn từng bước:
- cài **1 máy web** (controller) và **4 server Traefik** (mỗi site 1 server có agent);
- chuyển BMC từ nginx cũ sang Traefik;
- kiểm tra và xử lý sự cố.

Mọi lệnh chạy trên **Ubuntu 22.04**, bằng tài khoản có `sudo`.

---

## Mục lục

0. [Chuẩn bị](#0-chuẩn-bị)
1. [Cài máy web (controller)](#1-cài-máy-web-controller)
2. [Thêm site trên web, lấy token](#2-thêm-site-trên-web-lấy-token)
3. [Cài server Traefik + agent (làm cho từng site)](#3-cài-server-traefik--agent-làm-cho-từng-site)
4. [Chuyển BMC từ nginx sang Traefik](#4-chuyển-bmc-từ-nginx-sang-traefik)
5. [Kiểm tra sau khi cài](#5-kiểm-tra-sau-khi-cài)
6. [Firewall](#6-firewall)
7. [Xoay vòng log](#7-xoay-vòng-log)
8. [Xử lý sự cố](#8-xử-lý-sự-cố)
9. [Quay về nginx khẩn cấp](#9-quay-về-nginx-khẩn-cấp)
10. [Cập nhật phiên bản mới](#10-cập-nhật-phiên-bản-mới)
11. [Mở dashboard Traefik](#11-mở-dashboard-traefik)
12. [Mẫu BMC và thêm hàng loạt](#12-mẫu-bmc-và-thêm-hàng-loạt)
13. [Console Java (JNLP)](#13-console-java-jnlp)
14. [Console Java trên web (không tải .jnlp về máy)](#14-console-java-trên-web-không-tải-jnlp-về-máy)
15. [Trang lỗi IPMI (BMC mất kết nối)](#15-trang-lỗi-ipmi-bmc-mất-kết-nối)
16. [Giới hạn số kết nối tới BMC (QCT / AMI hay treo)](#16-giới-hạn-số-kết-nối-tới-bmc-qct--ami-hay-treo)
17. [Tải file .jnlp: tự sửa đúng link proxy](#17-tải-file-jnlp-tự-sửa-đúng-link-proxy)
18. [Kiểm tra toàn bộ BMC và lỗi thường gặp](#18-kiểm-tra-toàn-bộ-bmc-và-lỗi-thường-gặp)

Bản Word đầy đủ (có hình thức in): `Huong-Dan-BMC-Gateway.docx`.

---

## 0. Chuẩn bị

### 0.1. Bảng thông tin (điền trước khi làm)

| Mục | Ví dụ | Của bạn |
|---|---|---|
| Máy web: tên miền / IP | `bmc-gw.longvan.net` / `203.0.113.10` | |
| Mạng quản trị được vào web | `10.10.0.0/24` (VPN) | |
| Site 1: mã / tên miền / IP public | `hn` / `proxybb-hn.longvan.net` / `203.0.113.21` | |
| Site 2 | `hcm` / `proxybb-hcm.longvan.net` / `203.0.113.22` | |
| Site 3 | `dn` / `proxybb-dn.longvan.net` / `203.0.113.23` | |
| Site 4 | `ct` / `proxybb-ct.longvan.net` / `203.0.113.24` | |
| URL dịch vụ auth-token | `https://test.longvan.net:7443/cloud-service/proxy-service/auth-token` | |

### 0.2. Điều kiện bắt buộc

- **Mỗi server Traefik gọi ra được máy web qua HTTPS**, cổng 9443. 4 server **không cần** thông với nhau.
- Mỗi server Traefik tới được:
  - các BMC của site mình (mạng 10.x);
  - dịch vụ auth-token.
- Có Python 3.9 trở lên (Ubuntu 22.04 có sẵn bản 3.10):

  ```bash
  python3 --version
  ```

- Có file chứng chỉ `*.longvan.net`: `longvan.net-2027.cer` và `longvan.net-2027.key`, **hết hạn ngày 01/02/2027**.

### 0.3. Gói cài đặt (khuyến nghị)

Code được tách thành **2 gói**, tạo bằng lệnh `python tools/build_packages.py` trong thư mục `bmcproxy/`:

| Gói | Cho server | Có gì |
|---|---|---|
| `dist/bmc-gateway-web-<phiên bản>.tar.gz` | **Frontend**: server web quản lý | Web, mẫu BMC, `install.sh` |
| `dist/bmc-gateway-agent-<phiên bản>.tar.gz` | **Backend**: mỗi server Traefik | Agent, forwardAuth, file service Traefik, `install.sh` |

Copy gói lên server (PowerShell trên máy Windows):

```powershell
scp "C:\Users\FIX NHANH\Downloads\Monitor-Treafix-Proxy\bmcproxy\dist\bmc-gateway-web-2.0.0.tar.gz" root@<ip-web>:/tmp/
scp "C:\Users\FIX NHANH\Downloads\Monitor-Treafix-Proxy\bmcproxy\dist\bmc-gateway-agent-2.0.0.tar.gz" root@<ip-server-traefik>:/tmp/
```

Giải nén và cài (SSH):

```bash
# server web
cd /tmp && tar -xzf bmc-gateway-web-2.0.0.tar.gz && sudo bash bmc-gateway-web/install.sh web
# server Traefik (đã có /root/agent.json)
cd /tmp && tar -xzf bmc-gateway-agent-2.0.0.tar.gz && sudo bash bmc-gateway-agent/install.sh agent
```

Mỗi gói có cả bản **`.zip`**. Ubuntu 22.04 thường **không có sẵn `unzip`**, nên giải nén bằng Python có sẵn:

```bash
cd /tmp && python3 -m zipfile -e bmc-gateway-web-2.0.0.zip . && sudo bash bmc-gateway-web/install.sh web
```

Hoặc cài `unzip` trước: `sudo apt install -y unzip`.

**Cập nhật bản mới** cũng làm y như vậy với gói mới. Dữ liệu, tài khoản, token, `agent.json` được giữ nguyên.

Chạy nhầm gói, ví dụ `install.sh web` từ gói agent, thì script dừng và báo dùng gói kia.

### 0.4. Mã nguồn và gói cài đặt

Mã nguồn trong `bmcproxy/` được **chia thư mục** (`common/`, `controller/`, `agent/`, `deploy/`…, xem `README.md`).
**Không copy thẳng thư mục mã nguồn lên server**: `deploy/install.sh` chạy từ mã nguồn sẽ dừng và nhắc tạo gói.
Luôn tạo gói bằng `python tools/build_packages.py` rồi dùng gói trong `dist/`. Trong gói, các file vẫn **nằm phẳng** như bản cũ
(`bmcproxy.py`, `gw_*.py`, `web/`, `kvm/`, `install.sh`), nên server đang chạy cập nhật bình thường.

---

## 1. Cài máy web (controller)

Máy web có thể là một máy riêng, hoặc chung với một trong 4 server Traefik. Web dùng cổng 9443, không đụng cổng BMC.

### 1.1. Tạo user và thư mục

```bash
sudo useradd --system --home /opt/bmcproxy --shell /usr/sbin/nologin bmcproxy
sudo mkdir -p /opt/bmcproxy/data /opt/bmcproxy/backups /etc/bmcproxy/certs
```

### 1.2. Copy code

```bash
cd /tmp/bmcproxy
sudo cp bmcproxy.py gw_*.py config.example.json /opt/bmcproxy/
sudo cp -r web /opt/bmcproxy/
sudo cp config.example.json /opt/bmcproxy/config.json
```

### 1.3. Chứng chỉ cho web

```bash
sudo cp /đường/dẫn/longvan.net-2027.cer /etc/bmcproxy/certs/longvan.net.cer
sudo cp /đường/dẫn/longvan.net-2027.key /etc/bmcproxy/certs/longvan.net.key
sudo chown -R bmcproxy:bmcproxy /opt/bmcproxy /etc/bmcproxy
sudo chmod 600 /etc/bmcproxy/certs/longvan.net.key
```

### 1.4. Sửa `config.json`

```bash
sudo nano /opt/bmcproxy/config.json
```

```json
{
  "listen_host": "0.0.0.0",
  "listen_port": 9443,
  "tls_cert": "/etc/bmcproxy/certs/longvan.net.cer",
  "tls_key": "/etc/bmcproxy/certs/longvan.net.key",
  "data_dir": "data",
  "backup_dir": "backups",
  "zabbix_token": "",
  "agent_offline_after": 45
}
```

- `zabbix_token`: đặt một chuỗi ngẫu nhiên nếu muốn Zabbix lấy số liệu. Tạo chuỗi bằng `openssl rand -hex 24`.
- `agent_offline_after`: sau bao nhiêu giây không nhận được báo cáo thì coi agent mất liên lạc.

### 1.5. Tạo tài khoản quản trị

```bash
cd /opt/bmcproxy
sudo -u bmcproxy python3 bmcproxy.py adduser admin
```

Nhập mật khẩu tối thiểu 10 ký tự, 2 lần.

### 1.6. Chạy web bằng systemd

```bash
sudo cp /tmp/bmcproxy/bmcproxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bmcproxy
sudo systemctl status bmcproxy --no-pager
```

Log phải có dòng `bmcproxy controller 2.0.0: https://0.0.0.0:9443/`.

### 1.7. Mở web

Trình duyệt (từ mạng quản trị) → `https://bmc-gw.longvan.net:9443/` → đăng nhập `admin`.

Rồi vào **Cài đặt** để kiểm tra:
- **URL dịch vụ auth-token**;
- đường dẫn chứng chỉ **trên các server Traefik**. Mặc định là `/etc/traefik/certs/longvan.net.cer` và `.key`, giữ nguyên nếu làm theo mục 3.

---

## 2. Thêm site trên web, lấy token

Làm 4 lần, mỗi site một lần.

1. Vào **Site** → **+ Thêm site**.
2. Điền:

   | Ô | Ví dụ | Ghi chú |
   |---|---|---|
   | Mã site | `hn` | a-z, 0-9, `-`. **Không đổi được sau này** |
   | Tên hiển thị | `Hà Nội` | |
   | Tên miền của server | `proxybb-hn.longvan.net` | |
   | IP được phép kết nối agent | `203.0.113.21` | **IP mà web nhìn thấy** khi server gọi tới. Thường là IP public; cùng LAN thì là IP LAN |
   | Ghi đè cài đặt | để trống | Chỉ điền nếu site này dùng URL auth-token / chứng chỉ khác |

3. Bấm **Tạo site**. Web hiện nội dung `agent.json` kèm **token**. Bấm **Sao chép** và lưu tạm vào notepad.

   > Token **chỉ hiện một lần**. Lỡ mất thì bấm **Token** trên thẻ site để tạo token mới. Token cũ hết hiệu lực ngay.

---

## 3. Cài server Traefik + agent (làm cho từng site)

Ví dụ dưới đây là site `hn`. Làm y hệt cho `hcm`, `dn`, `ct`.

### 3.1. Kiểm tra server gọi được web

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://bmc-gw.longvan.net:9443/
```

| Kết quả | Ý nghĩa |
|---|---|
| `200` | Thông, làm tiếp |
| `000` | Không kết nối được. Kiểm tra DNS, firewall, NAT cổng 9443 |
| Lỗi `SSL certificate problem` | Chứng chỉ web không hợp lệ. Sửa chứng chỉ, hoặc tạm đặt `"verify_tls": false` |

Kiểm tra 2 cổng nội bộ mà agent và Traefik cần (**18080** cho API Traefik, **9444** cho forwardAuth) còn trống:

```bash
sudo ss -ltnp | grep -E ':(18080|9444) ' || echo "trống"
```

Nếu bị chiếm, đổi `traefik_api` / `auth_listen_port` trong `agent.json` (mục 3.5) sang cổng khác.

### 3.2. Cài Traefik

```bash
cd /tmp
V=v3.7.15
curl -fLO https://github.com/traefik/traefik/releases/download/$V/traefik_${V}_linux_amd64.tar.gz
curl -fLO https://github.com/traefik/traefik/releases/download/$V/traefik_${V}_checksums.txt
grep "traefik_${V}_linux_amd64.tar.gz" traefik_${V}_checksums.txt | sha256sum -c -
```

Phải ra dòng `traefik_v3.7.15_linux_amd64.tar.gz: OK`. **Không OK thì dừng lại**, không cài file đó. Nếu OK:

```bash
sudo tar -xzf traefik_${V}_linux_amd64.tar.gz -C /usr/local/bin traefik
sudo chmod 755 /usr/local/bin/traefik
traefik version
```

### 3.3. User, thư mục, chứng chỉ cho Traefik

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin traefik
sudo mkdir -p /etc/traefik/dynamic /etc/traefik/certs /var/log/traefik
sudo cp /etc/nginx/longvan.net-2027.cer /etc/traefik/certs/longvan.net.cer
sudo cp /etc/nginx/longvan.net-2027.key /etc/traefik/certs/longvan.net.key
sudo chown root:traefik /etc/traefik/certs/longvan.net.key
sudo chmod 640 /etc/traefik/certs/longvan.net.key
sudo chown -R traefik:traefik /var/log/traefik
```

Nếu server chưa có nginx cũ, copy 2 file chứng chỉ từ nơi khác vào.

> **Nếu server đã có Traefik tự cấu hình trước đây:**
> - sao lưu `/etc/traefik` ra chỗ khác;
> - xoá hoặc chuyển các file trong `/etc/traefik/dynamic/` đi chỗ khác, để không trùng với file agent tạo.
>
> Agent sẽ **ghi đè** `/etc/traefik/traefik.yml`.

### 3.4. Service Traefik (chỉ enable, **chưa** start)

```bash
sudo cp /tmp/bmcproxy/traefik.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable traefik
```

Chưa start vì chưa có `traefik.yml`. Agent sẽ tạo file rồi tự restart Traefik.

### 3.5. Cài agent

```bash
sudo mkdir -p /opt/bmcproxy
cd /tmp/bmcproxy
sudo cp bmcproxy.py gw_agent.py gw_auth.py gw_common.py gw_java.py gw_nginx.py gw_render.py /opt/bmcproxy/
sudo nano /opt/bmcproxy/agent.json
```

Dán nội dung đã sao chép ở mục 2, rồi **kiểm tra lại các dòng sau**:

```json
{
  "site": "hn",
  "controller_url": "https://bmc-gw.longvan.net:9443",
  "token": "…token web tạo ra…",
  "verify_tls": true,
  "poll_interval": 10,
  "traefik_static_file": "/etc/traefik/traefik.yml",
  "traefik_dynamic_dir": "/etc/traefik/dynamic",
  "traefik_restart_cmd": ["systemctl", "restart", "traefik"],
  "traefik_api": "http://127.0.0.1:18080",
  "nginx_conf_dir": "/etc/nginx/conf.d",
  "nginx_test_cmd": ["nginx", "-t"],
  "nginx_reload_cmd": ["systemctl", "reload", "nginx"]
}
```

| Dòng | Kiểm tra |
|---|---|
| `controller_url` | Địa chỉ **server này gọi tới được** (đã thử ở 3.1). Web sinh ra địa chỉ theo trình duyệt của bạn, có thể sai |
| `verify_tls` | Để `true`. Chỉ đặt `false` khi web dùng chứng chỉ tự ký |
| `nginx_*` | Server không có nginx thì để nguyên, agent tự bỏ qua |
| Các khoá không có trong file | Agent dùng mặc định: `auth_listen_port` 9444, `traefik_stop_cmd`, `verify_wait` 15… |

Khoá quyền file vì có token:

```bash
sudo chmod 600 /opt/bmcproxy/agent.json
```

### 3.6. Chạy thử 1 lần

```bash
cd /opt/bmcproxy
sudo python3 bmcproxy.py agent -c agent.json --once
```

- Không có dòng lỗi là được. Trên web, thẻ site **HN** chuyển sang **chấm xanh – trực tuyến** và hiện tên máy.
- Gặp `controller trả lỗi 401` → xem [mục 8](#8-xử-lý-sự-cố).

### 3.7. Chạy agent bằng systemd

```bash
sudo cp /tmp/bmcproxy/bmcproxy-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bmcproxy-agent
sudo journalctl -u bmcproxy-agent -n 20 --no-pager
```

Log phải có các dòng:

```text
… agent site=hn forwardAuth http://127.0.0.1:9444 controller=https://bmc-gw.longvan.net:9443
… đã kết nối controller
```

### 3.8. Lặp lại cho 3 site còn lại

Làm lại mục 3.1 → 3.7 trên server `hcm`, `dn`, `ct`, mỗi server dùng **token của site mình**.

---

## 4. Chuyển BMC từ nginx sang Traefik

**Nên làm ngoài giờ, từng site một.** Thời gian mất kết nối khi chuyển khoảng 2–5 giây (lúc restart Traefik).

### 4.1. Nhập danh sách BMC

1. Web → **Site** → thẻ **HN** → **Nhập từ nginx**.
2. Đợi khoảng 10 giây, vào **BMC**, lọc site **HN**.

Agent đọc `/etc/nginx/conf.d/*.conf` trên server và gửi về web:
- Mỗi file một BMC: cổng web, cổng console 59xx, địa chỉ BMC, TLS cũ, jsesp.
- `default.conf` và `webproxyauto.conf` bị bỏ qua vì không phải proxy BMC.
- Cổng nào trước đây **không có xác thực** sẽ được **bật xác thực**, có nhãn **"mới bật"**.
- URL auth-token tìm thấy trong nginx được lưu làm **ghi đè của site** nếu khác cài đặt chung.

Server không có nginx thì bỏ qua bước này, vào **BMC → + Thêm BMC** để nhập tay.

### 4.2. Xem lại trước khi áp dụng

- Lọc **"Mới bật xác thực"**. BMC nào console dùng **trình xem Java / ứng dụng ngoài** thì mở ra và **tắt "Bắt xác thực console"**, vì các ứng dụng đó không gửi cookie.
- Lọc **"TLS cũ"**. Với BMC đời cũ, thử từ server Traefik:

  ```bash
  openssl s_client -connect <ip-bmc>:<cổng> -cipher 'AES128-SHA:AES256-SHA' -tls1_2 </dev/null 2>/dev/null | grep "Cipher is"
  ```

  - Ra `Cipher is AES...`: Traefik dùng được, bật **"BMC đời cũ"**.
  - Không ra gì: BMC chỉ hỗ trợ DHE. Traefik **không** kết nối được, nên để BMC đó ở **"Đang hoạt động: tắt"** và xử lý riêng.

### 4.3. Áp dụng

1. Bấm **Xem & áp dụng** (thanh dưới cùng).
2. Chỉ tick site **HN**. Mở từng file để xem diff nếu muốn.
3. Bấm **Áp dụng site đã chọn**, rồi theo dõi tiến độ. Agent làm lần lượt:

   | Bước | Việc |
   |---|---|
   | Sao lưu | Copy `traefik.yml` + `dynamic/` vào `/opt/bmcproxy/agent-data/backups/` |
   | Ghi config | Ghi `traefik.yml` và `dynamic/bmc-*.yml` |
   | Tắt nginx cũ | Đổi tên `8005-…conf` thành `8005-…conf.disabled-by-bmcproxy`, `nginx -t`, reload nginx |
   | Kiểm tra cổng trống | Cổng nào còn bị chương trình khác giữ thì **dừng lại, không restart** |
   | Restart Traefik | `systemctl restart traefik` |
   | Kiểm tra Traefik | Mọi router `enabled`, mọi cổng đã mở |

   Lỗi ở bất kỳ bước nào: agent **bật lại nginx, khôi phục Traefik**, và web hiện log lỗi từng bước.

4. Mở thử 2–3 BMC từ portal, bằng trình duyệt đã đăng nhập.
5. Ổn thì làm site tiếp theo.

---

## 5. Kiểm tra sau khi cài

Chạy trên server Traefik:

```bash
systemctl is-active traefik bmcproxy-agent            # active active
curl -s http://127.0.0.1:18080/api/overview | head -c 300; echo
curl -sk -o /dev/null -w "%{http_code}\n" https://127.0.0.1:8005/              # 401 = có xác thực
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9444/auth/8005       # 401 = forwardAuth chạy
ls /etc/nginx/conf.d/ | grep -c disabled-by-bmcproxy   # số file nginx đã tắt
ss -ltnp | grep traefik | head                          # Traefik đang nghe các cổng
```

Trên web cần thấy:
- **Tổng quan**: "Site trực tuyến 4/4", không có cảnh báo đỏ.
- **Site**: 4 thẻ đều **"đã đồng bộ"**, "router lỗi" = 0.
- **Traefik** (chọn từng site): mọi router `enabled`.

---

## 6. Firewall

Ví dụ dưới dùng `ufw`. Thay IP bằng IP thật.

**Máy web:**

```bash
sudo ufw allow from 10.10.0.0/24 to any port 9443 proto tcp   # mạng quản trị / VPN
for ip in 203.0.113.21 203.0.113.22 203.0.113.23 203.0.113.24; do
  sudo ufw allow from $ip to any port 9443 proto tcp           # 4 server Traefik
done
```

**Server Traefik:**
- Mở các cổng BMC (8001–8131, 59xx, 443…) cho người dùng / portal, giống nginx trước đây.
- Cổng 9444 và 18080 **đã chỉ nghe trên 127.0.0.1**, không cần mở.
- Cho phép **đi ra**: máy web cổng 9443, dịch vụ auth-token cổng 7443, các BMC.

---

## 7. Xoay vòng log

Access log của Traefik sẽ lớn dần. Tạo `/etc/logrotate.d/traefik`:

```text
/var/log/traefik/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl kill -s USR1 traefik >/dev/null 2>&1 || true
    endscript
}
```

Traefik mở lại file log khi nhận tín hiệu `USR1`.

---

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Site đỏ "mất liên lạc", log agent `không kết nối được controller` | Sai `controller_url`, DNS, firewall | Thử lại lệnh ở mục 3.1 |
| Log agent `controller trả lỗi 401` | Sai token, sai mã site, hoặc IP server không nằm trong "IP được phép" | Trên **máy web** chạy `journalctl -u bmcproxy \| grep "agent bị từ chối"` để thấy **IP thật** mà web nhận được. Sửa site → IP được phép cho đúng IP đó. Sai token thì bấm **Token** tạo lại |
| Log agent có lỗi `SSL: CERTIFICATE_VERIFY_FAILED` | Chứng chỉ web không hợp lệ hoặc thiếu chain | Sửa chứng chỉ web; tạm thời đặt `"verify_tls": false` |
| Áp dụng lỗi ở **"Kiểm tra cổng trống"** | Cổng BMC đang bị chương trình khác giữ | `sudo ss -ltnp \| grep :<cổng>` để xem chương trình nào. Thường là file nginx không do tool nhập. Tắt nó hoặc đổi cổng BMC |
| Áp dụng lỗi ở **"Restart Traefik"** | Traefik không khởi động được | `journalctl -u traefik -n 50`. Thường do sai đường dẫn chứng chỉ hoặc user `traefik` không đọc được file `.key` |
| Áp dụng lỗi ở **"Kiểm tra Traefik"**: router lỗi | Config không hợp lệ | Xem trang **Traefik** trên web để biết router nào lỗi và vì sao |
| Cảnh báo "Traefik không chạy" | Traefik chết sau khi đã chạy | `systemctl status traefik`, `journalctl -u traefik -n 50`, rồi `systemctl restart traefik` |
| Vào BMC bị **401** dù đã đăng nhập portal | Trình duyệt không có cookie `proxyauthcookie` cho tên miền này, hoặc dịch vụ auth-token lỗi | Xem số "lỗi" ở cột Truy cập. Thử `curl` tới URL auth-token từ server |
| Vào BMC bị **403** | Token hết hạn, hoặc sai **Target bắt buộc** | Kiểm tra ô Target của BMC |
| Vào BMC bị **502** | Traefik không kết nối được BMC: BMC tắt, sai IP, hoặc BMC chỉ hỗ trợ DHE | Chấm đỏ ở cột trạng thái là BMC không mở được TCP. Chấm xanh mà vẫn 502 thì thử lệnh `openssl` ở mục 4.2 |
| Console HTML5 không mở | Console dùng cổng 59xx riêng, trình duyệt chưa tin chứng chỉ cổng đó, hoặc bị chặn xác thực | Mở trực tiếp `https://proxybb-xx.longvan.net:59xx` một lần. BMC dùng Java thì tắt xác thực console |

**Xem log:**

```bash
sudo journalctl -u bmcproxy-agent -f      # agent
sudo journalctl -u traefik -f             # Traefik
sudo tail -f /var/log/traefik/access.log  # từng request (JSON)
sudo journalctl -u bmcproxy -f            # web (trên máy web)
```

---

## 9. Quay về nginx khẩn cấp

**Cách 1 (trên web):** vào **Sao lưu**, khôi phục bản trước khi nhập nginx, rồi **Áp dụng** lại. Cách này áp dụng được khi web và agent vẫn chạy.

**Cách 2 (trên server, khi cần nhanh hoặc mất liên lạc với web):**

```bash
sudo systemctl stop bmcproxy-agent traefik
cd /etc/nginx/conf.d
for f in *.disabled-by-bmcproxy; do sudo mv "$f" "${f%.disabled-by-bmcproxy}"; done
sudo nginx -t && sudo systemctl reload nginx
```

Sau cách 2, nginx chạy lại như trước. Khi muốn chuyển lại sang Traefik:
1. `sudo systemctl start bmcproxy-agent`;
2. trên web, bấm **Nhập từ nginx** cho site đó để agent ghi nhận lại danh sách file nginx cũ;
3. **Áp dụng**.

---

## 10. Cập nhật phiên bản mới

**Máy web:**

```bash
sudo cp /tmp/bmcproxy/bmcproxy.py /tmp/bmcproxy/gw_*.py /opt/bmcproxy/
sudo cp -r /tmp/bmcproxy/web /opt/bmcproxy/
sudo chown -R bmcproxy:bmcproxy /opt/bmcproxy
sudo systemctl restart bmcproxy
```

**Mỗi server Traefik:**

```bash
cd /tmp/bmcproxy
sudo cp bmcproxy.py gw_agent.py gw_auth.py gw_common.py gw_java.py gw_nginx.py gw_render.py /opt/bmcproxy/
sudo systemctl restart bmcproxy-agent
```

Restart agent **không** restart Traefik. Trong vài giây agent khởi động lại, request mới tới BMC có thể bị lỗi xác thực; kết nối đang mở (console) không bị ảnh hưởng.

**Cập nhật Traefik:** làm lại mục 3.2 với phiên bản mới, rồi `sudo systemctl restart traefik` (mất kết nối 2–5 giây).

**Đổi chứng chỉ** (trước 01/02/2027):
1. Copy cert mới vào `/etc/traefik/certs/` trên **cả 4 server**, giữ nguyên tên file.
2. `sudo systemctl restart traefik` trên từng server.
3. Copy cert mới vào `/etc/bmcproxy/certs/` trên máy web, rồi `sudo systemctl restart bmcproxy`.

---

## 11. Mở dashboard Traefik

Dashboard của Traefik mặc định **chỉ mở trong server** (`127.0.0.1:18080`). Muốn xem từ trình duyệt máy của bạn:

1. Web → **Site** → thẻ site → **Sửa** → phần **Dashboard Traefik**:

   | Ô | Ví dụ | Ghi chú |
   |---|---|---|
   | Trạng thái | Bật | |
   | Cổng | `18443` | Không được trùng cổng BMC của site |
   | IP / dải mạng được xem | `113.161.1.2, 10.10.0.0/24` | **Bắt buộc.** IP khác bị trả **403** |
   | Tài khoản / Mật khẩu | `admin` / ≥ 10 ký tự | Mật khẩu được băm (`$apr1$`) trước khi gửi xuống server |

2. **Lưu**, rồi **Xem & áp dụng** site đó. Agent sẽ:
   - mở cổng 18443 qua HTTPS, dùng chứng chỉ `*.longvan.net`;
   - chỉ cho các IP đã khai vào;
   - bắt nhập mật khẩu.
3. Mở firewall cổng 18443 cho đúng các IP đó:

   ```bash
   sudo ufw allow from 113.161.1.2 to any port 18443 proto tcp
   ```

4. Vào `https://proxybb-hn.longvan.net:18443/` (tự chuyển tới `/dashboard/`). Thẻ site trên web cũng hiện link này.

Muốn đóng thì **Sửa** → Trạng thái **Tắt** → **Áp dụng**. Cổng sẽ đóng hẳn.

> Nếu đã làm cách mở **tạm thời** bằng tay (file `/etc/traefik/dynamic/dashboard-tam.yml`), hãy xoá file đó **trước** lần áp dụng đầu tiên:
>
> ```bash
> sudo rm -f /etc/traefik/dynamic/dashboard-tam.yml
> ```

---

## 12. Mẫu BMC và thêm hàng loạt

Mỗi BMC thuộc **1 site** (nằm trong mạng của site đó). Thứ dùng chung cho mọi site là **mẫu theo loại máy** và **thao tác hàng loạt**.

### 12.1. Mẫu (BMC → Mẫu)

| Mẫu | Địa chỉ BMC | Console | Tuỳ chọn |
|---|---|---|---|
| `idrac9` Dell iDRAC 9 | `https://IP` | không có | |
| `idrac7-8` Dell iDRAC 7/8 | `https://IP` | `https://IP:<cổng console>` | .jsesp |
| `idrac6` Dell iDRAC 6 | `https://IP` | `https://IP:<cổng console>` | TLS cũ |
| `dell-c6420` | `https://IP:<cổng proxy>` | `https://IP:<cổng console>` | |
| `dell-r640` | `https://IP:<cổng proxy>` | không có | |
| `dell-r620` | `https://IP:<cổng proxy>` | `https://IP:<cổng console>` | .jsesp |
| `ilo4-5` HPE iLO 4/5 | `https://IP:<cổng proxy>` | không có | |
| `lenovo` | `https://IP` | `https://IP:<cổng console>` | |
| `cisco-c220` | `https://IP` | `https://IP:2068` (cố định) | |
| `quanta-t42s` | `https://IP` | không có | |
| `supermicro` | `https://IP` | `https://IP:<cổng console>` | .jsesp |

Lấy theo các file mẫu nginx trong `nginx/template-config/`. Quản trị viên có thể **+ Thêm mẫu** riêng. Mẫu có sẵn thì không sửa được.

Khi **+ Thêm BMC**:
1. chọn **Site**, bấm **Gợi ý** để lấy cổng trống;
2. chọn **Mẫu**, nhập **IP BMC**, bấm **Điền theo mẫu**;
3. **Lưu**.

### 12.2. Thêm / cập nhật hàng loạt (BMC → Thêm hàng loạt)

Dán từ Excel (cột cách nhau bằng Tab) hoặc CSV. Mỗi dòng 1 BMC, **các site khác nhau dán chung 1 lần**:

```text
# site, cổng, ip, cổng console, mẫu, ghi chú
hn,  8200, 10.3.7.201, 5200, idrac7-8,   KH 1942xxxx
hn,  8201, 10.3.7.202,     , idrac9,     KH 1943xxxx
hcm, 8005, 10.2.7.15,  5905, supermicro, KH 2001xxxx
```

1. Bấm **Kiểm tra**: báo lỗi từng dòng (site sai, mẫu sai, trùng cổng trong cùng site hoặc giữa các dòng).
2. **Còn dòng lỗi thì không lưu dòng nào.** Sửa hết lỗi rồi bấm **Lưu tất cả**.
3. **Xem & áp dụng** cho các site liên quan.

**Sửa hàng loạt qua Excel:**
1. **Xuất CSV** (theo site đang lọc, hoặc tất cả).
2. Sửa trong Excel.
3. Dán lại vào **Thêm hàng loạt**, tick **"Cập nhật BMC đã có"**.

### 12.3. Chọn nhiều BMC

Tick ô đầu dòng (hoặc ô tiêu đề để chọn tất cả BMC đang lọc). Thanh **"Đã chọn N BMC"** cho phép làm cùng lúc, kể cả với BMC ở nhiều site:
- bật xác thực;
- tắt xác thực web / console;
- tạm tắt / bật lại;
- đổi mẫu;
- xoá.

---

## 13. Console Java (JNLP)

Dùng cho BMC **chỉ có console Java**, tức bấm "Java Console" thì tải về file `.jnlp`. Ví dụ: QCT/AMI MegaRAC (JViewer), iDRAC 6/7, iLO 4 bản cũ, Supermicro cũ.

**Cách hoạt động:**

```text
Bấm "Java Console" (qua proxy, có cookie portal + đã đăng nhập BMC)
  -> agent tải file .jnlp từ BMC, sửa:  IP 10.x -> tên miền proxy, cổng BMC -> cổng proxy
  -> Java mở kết nối TCP tới  tên-miền-proxy:cổng-proxy
  -> Traefik chuyển thẳng TCP xuống  IP-BMC:cổng-BMC   (chỉ cho IP trong danh sách)
```

### 13.1. Khai báo trên web

**BMC → bấm dòng BMC → phần Console Java (JNLP / TCP):**

1. **Cổng TCP:** dạng `cổng_proxy:cổng_BMC`. Bấm **Gợi ý** để lấy cổng Java của mẫu kèm cổng proxy còn trống (dải 17000–17999).

   | Loại máy | Cổng Java trên BMC |
   |---|---|
   | QCT / AMI MegaRAC (mẫu `qct-ami-java`) | `7578` (KVM), `5120` (CD ảo), `5123` (ổ mềm ảo). Bật mã hoá KVM thì `7582` |
   | Dell iDRAC 7 / 8 | `5900` |
   | Dell iDRAC 6 | `5900`, `5901` |
   | HPE iLO 4 (Java IRC) | `17990`, `17988` |
   | Supermicro cũ | `5900`, `623` |

2. **IP được dùng console Java:** IP văn phòng / VPN. **Bắt buộc nên khai**: Java không gửi cookie đăng nhập portal, nên cổng TCP chỉ được bảo vệ bằng danh sách IP. Để trống thì web hiện cảnh báo đỏ.
3. **Tự sửa file .jnlp:** để bật.
4. **Lưu** → **Xem & áp dụng**. Thêm cổng mới nên Traefik sẽ restart.

### 13.2. Mở firewall trên server Traefik

```bash
sudo ufw allow from <ip-văn-phòng-hoặc-VPN> to any port 17000:17999 proto tcp
```

### 13.3. Dùng

1. Mở BMC qua proxy, ví dụ `https://proxybb-hcm.longvan.net:8023/`, **đăng nhập BMC**.
2. Bấm **Java Console**. File `.jnlp` tải về đã trỏ sẵn tên miền + cổng proxy.
3. Mở file bằng Java Web Start (`javaws jviewer.jnlp`) hoặc OpenWebStart.

### 13.4. Kiểm tra

- **File `.jnlp`:** mở bằng Notepad. Không còn IP `10.x`; các `<argument>` cổng là cổng proxy (vd `17578`); `codebase` là `https://tên-miền-proxy:cổng-web-proxy/…`.
- **Kết nối TCP** (PowerShell trên máy được phép): `Test-NetConnection proxybb-hcm.longvan.net -Port 17578` phải ra `TcpTestSucceeded : True`.
- **Java báo không kết nối được:** kiểm tra IP của máy bạn có trong danh sách không, và firewall đã mở cổng proxy chưa. Có BMC dùng thêm cổng khác thì mở file `.jnlp` gốc (vào thẳng BMC) xem các `<argument>` là số cổng, rồi thêm vào ô Cổng TCP.

## 14. Console Java trên web (không tải .jnlp về máy)

Bấm **Launch Java Console** trên trang BMC thì màn hình console mở **ngay trong trình duyệt**. Máy người dùng không cần cài Java, không tải file `.jnlp`, không cần mở cổng TCP.

**Cách hoạt động:**

```text
Bấm "Launch Java Console" (qua proxy, có cookie portal + đã đăng nhập BMC)
  -> agent tải .jnlp từ BMC, chạy container Docker "bmcgw-kvm" trên server proxy
     (Java 8 + màn hình ảo + noVNC), Java kết nối thẳng tới IP BMC trong mạng nội bộ
  -> trình duyệt tự chuyển sang  https://tên-miền:cổng-BMC/__kvm/vnc.html
     (cùng cổng web, cùng xác thực cookie portal)
```

### 14.1. Cài trên server agent (làm 1 lần)

```bash
sudo apt install -y docker.io          # bỏ qua nếu đã có Docker
sudo bash /home/bmc-gateway-agent/install.sh agent   # cập nhật agent (có gw_kvm.py + thư mục kvm/)
sudo bash /home/bmc-gateway-agent/install.sh kvm     # build image bmcgw-kvm:1 (~5 phút, cần Internet)
sudo bash /home/bmc-gateway-agent/install.sh status  # dòng "image kvm" phải là "có"
```

### 14.2. Bật cho BMC

Web → **BMC** → bấm dòng BMC → phần **Console Java** → bật **Mở console Java ngay trên web** → **Lưu** → **Áp dụng**.
Hoặc chọn mẫu **QCT / AMI MegaRAC (console Java trên web)** hay **Supermicro iKVM (console Java trên web)**. Nhiều BMC: tick chọn → **Đổi mẫu…**.

Hỗ trợ:
- **AMI / QCT JViewer, iDRAC, iLO**: file `*.jnlp`.
- **Supermicro iKVM** (X9/X10/X11): `.jnlp` lấy từ `/cgi/url_redirect.cgi?url_name=man_ikvm&url_type=jwsk`, jar dạng `.jar.pack.gz` tự giải bằng `unpack200` (cách làm giống dự án supermicro-java-ikvm).
- Java chạy thẳng không được, hoặc BMC dùng applet, thì tự chuyển sang **IcedTea-Web `javaws`** + Java 8.

Sau khi cập nhật gói (web + agent), mọi site hiện **chờ áp dụng** một lần để sinh lại file Traefik: bấm **Áp dụng**.

Điều kiện: cổng web của BMC ≤ 25535 (container dùng cổng nội bộ `127.0.0.1:40000+cổng`). Không bắt buộc bật xác thực portal: mỗi lần Launch có **mật khẩu VNC ngẫu nhiên**, chỉ trình duyệt đã bấm Launch nhận được (qua cookie `bmcgw_kvm_<cổng>`). Người khác mở `/__kvm/` sẽ bị hỏi mật khẩu.

### 14.3. Dùng

1. Mở BMC qua proxy, ví dụ `https://proxybb-hcm.longvan.net:8001/`, đăng nhập BMC.
2. Bấm **Launch Java Console**. Trang hiện "Đang mở console Java…" (5–20 giây), rồi tự chuyển sang màn hình console.
3. Đóng cửa sổ JViewer trong noVNC là container tự dừng. Container cũng tự dừng sau 4 giờ (`kvm_max_hours` trong agent.json).
4. Mỗi BMC chạy 1 console. Người thứ hai bấm Launch thì phiên cũ bị thay bằng phiên mới.

### 14.4. Lỗi thường gặp

| Trang báo | Sửa |
|---|---|
| `Server chưa có image bmcgw-kvm:1` | `sudo bash install.sh kvm` |
| `Server chưa cài Docker` | `sudo apt install -y docker.io && sudo systemctl enable --now docker`, rồi `install.sh kvm` |
| `container không mở được noVNC` | `sudo docker logs bmcgw-kvm-<cổng>` |
| Màn hình đen, không có JViewer | `sudo docker logs bmcgw-kvm-<cổng>`: xem dòng `tải …` / lỗi Java (BMC trả jar lỗi, phiên BMC hết hạn → đăng nhập lại BMC rồi bấm Launch) |
| `file .jnlp dạng applet-desc` | BMC dùng applet (rất cũ), chưa hỗ trợ |

## 15. Trang lỗi IPMI (BMC mất kết nối)

Khi BMC không trả lời (Traefik gặp lỗi 502 / 503 / 504), người dùng thấy **trang báo lỗi IPMI** thay cho dòng chữ `Bad Gateway`. Agent trên server proxy tự kiểm tra **ping → cổng → HTTPS/TLS** tới BMC rồi báo nguyên nhân:

| Trang báo | Nghĩa là |
|---|---|
| **Không kết nối được IPMI / BMC** | Không ping được, không mở được cổng: mất điện, rút cáp IPMI, sai IP, server proxy không có đường tới mạng BMC |
| **BMC có mạng nhưng web IPMI không mở** | Ping được nhưng cổng đóng / treo: BMC đang khởi động lại hoặc web BMC treo → đợi hoặc reset BMC |
| **Lỗi bắt tay TLS với BMC** | BMC đời cũ → bật **BMC đời cũ (TLS cũ)** |
| **BMC đóng kết nối giữa chừng** | Mạng và TLS bình thường nhưng BMC quá tải / đủ số phiên → tải lại, đăng xuất phiên khác |

- Mã lỗi gốc (502/504) được giữ nguyên, nên script và Zabbix vẫn thấy BMC lỗi.
- Mỗi BMC chỉ kiểm tra lại sau 15 giây, để trang BMC tải nhiều file cùng lúc không làm ping dồn dập.
- Server proxy cần có lệnh `ping` (Ubuntu: gói `iputils-ping`).

## 16. Giới hạn số kết nối tới BMC (QCT / AMI hay treo)

Web server của BMC đời cũ (QCT / AMI MegaRAC…) chỉ chịu được vài kết nối. Bị dồn nhiều kết nối TLS cùng lúc là nó đóng ngang (502 ở `/rpc/…asp`, `ERR_CONTENT_DECODING_FAILED`, "Not Supported"), hoặc chết hẳn cổng 443 (trang lỗi IPMI báo "cổng 443 bị từ chối").

Đã sửa 2 lớp:
1. **Trình duyệt ↔ proxy chỉ dùng HTTP/1.1** (tối đa 6 kết nối / trình duyệt, giống vào thẳng IP). Tự áp dụng cho mọi BMC.
2. **Số kết nối tối đa tới BMC**: web → BMC → **Nâng cao → Số kết nối tối đa tới BMC** = `4` (mẫu QCT/AMI đặt sẵn 4). Quá số đó thì request **xếp hàng chờ** (tối đa 25 giây) thay vì dồn vào BMC. Agent đứng giữa Traefik và BMC ở `127.0.0.1:(20000 + cổng)`, nên cổng web BMC phải ≤ 19999.

Nhiều BMC cùng lúc: tick chọn → **Đổi mẫu…** → QCT / AMI. Hoặc **Xuất CSV**, sửa cột `max_conns`, rồi **Thêm hàng loạt** với tick "Cập nhật BMC đã có".

## 17. Tải file .jnlp: tự sửa đúng link proxy

Mọi BMC (mặc định bật **Tự sửa file .jnlp**) khi tải `.jnlp` qua proxy đều được sửa về đúng địa chỉ đang mở, ví dụ `https://proxybb-hcm.longvan.net:8124`:
- AMI hay ghi `https://<tên-miền>:443` hoặc `http://<IP>/…` → đổi thành `https://<tên-miền>:<cổng-proxy>`;
- `-webport 443` → cổng proxy; cổng KVM (7578…) → cổng TCP proxy nếu đã khai ở **Console Java (JNLP / TCP)**.

Muốn Java trên máy kết nối được KVM thì vẫn phải khai **cổng TCP** (mục 13) và mở firewall. Không muốn cài Java trên máy: dùng **console Java trên web** (mục 14).

## 18. Kiểm tra toàn bộ BMC và lỗi thường gặp

### 18.1. Máy vào được, máy báo Bad Gateway

Mỗi BMC hỏng kiểu riêng. Kiểm tra **mọi BMC của site một lần**: chạy trên server site, script đọc `/etc/traefik/dynamic/bmc-*.yml`, rồi kiểm tra ping → cổng → TLS (mới và cũ).

```bash
sudo python3 - <<'EOF'
import glob, re, socket, ssl, subprocess
from concurrent.futures import ThreadPoolExecutor
def tls(h, p, legacy):
    c = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); c.check_hostname = False; c.verify_mode = ssl.CERT_NONE
    if legacy:
        c.minimum_version = ssl.TLSVersion.TLSv1; c.set_ciphers("DEFAULT:@SECLEVEL=0")
    try:
        with socket.create_connection((h, p), 4) as r, c.wrap_socket(r, server_hostname=h) as s: return s.version()
    except Exception: return None
def check(f):
    t = open(f).read(); port = re.search(r"bmc-(\d+)", f).group(1)
    m = re.search(r"BMC \d+ -> (https?)://([^:/\s]+):?(\d*)", t)
    if not m: return port, "-", "khong doc duoc dia chi"
    sch, h, p = m.group(1), m.group(2), int(m.group(3) or (443 if m.group(1) == "https" else 80))
    legacy = "bmc-legacy" in t
    ping = subprocess.run(["ping", "-c1", "-W1", h], capture_output=True).returncode == 0
    try: socket.create_connection((h, p), 3).close(); tcp = True
    except OSError: tcp = False
    if not tcp: return port, h, "MAT KET NOI" if not ping else f"WEB BMC TREO (cong {p} dong)"
    if sch == "https":
        new, old = tls(h, p, False), tls(h, p, True)
        if not new and not old: return port, h, "LOI TLS"
        if not new and not legacy: return port, h, f"CAN BAT 'BMC doi cu' ({old})"
    return port, h, "OK"
files = sorted(glob.glob("/etc/traefik/dynamic/bmc-[0-9]*.yml"), key=lambda f: int(re.search(r"bmc-(\d+)", f).group(1)))
with ThreadPoolExecutor(20) as ex:
    rows = list(ex.map(check, files))
for port, h, st in rows: print(f"{port:>6}  {h:<16} {st}")
print(f"Tong {len(rows)} BMC, loi {sum(1 for r in rows if r[2] != 'OK')}")
EOF
```

| Dòng báo | Sửa |
|---|---|
| **MAT KET NOI** | Kiểm tra điện / cáp IPMI / IP. Máy đã bỏ thì tắt **Đang hoạt động** |
| **WEB BMC TREO** | `ipmitool -I lanplus -H <IP> -U <user> -P '<pass>' mc reset cold` (không tắt server) |
| **CAN BAT 'BMC doi cu'** | BMC đó → bật **BMC đời cũ (TLS cũ)** → Lưu → Áp dụng |
| **LOI TLS** | BMC chỉ có DHE: nâng firmware |
| **OK** mà mở vẫn lỗi | BMC quá tải: **Số kết nối tối đa = 4** (mẫu QCT/AMI), Áp dụng |

### 18.2. Lỗi đã gặp khi triển khai

| Triệu chứng | Cách xử lý |
|---|---|
| `install.sh web`: cổng 9443 đang bị dùng (vd Axigen) | `sudo WEB_PORT=9543 bash install.sh web`, mở firewall cổng mới |
| Thiếu chứng chỉ trên máy web | Tạo chứng chỉ tự ký bằng `openssl req -x509 …`, cài với `CERT=… KEY=…`; agent.json đặt `"verify_tls": false` |
| Web báo `ERR_EMPTY_RESPONSE` | Dùng `https://`. Bản hiện tại tự chuyển `http://` sang `https://` |
| Áp dụng lỗi `nginx -t`: `unknown "target" variable` | Một file khác trong conf.d lỗi (vd `8091-…copy.conf`): chuyển ra `/root/nginx-cu/` rồi **Thử lại** |
| Áp dụng lỗi `nginx.service is not active` | nginx chạy trong Docker: agent.json `"nginx_test_cmd": [], "nginx_reload_cmd": []`, restart agent, **Thử lại** |
| Áp dụng lỗi “Kiểm tra cổng trống” | `sudo ss -ltnp \| grep :<cổng>`: tắt chương trình đang giữ cổng (vd docker-proxy) hoặc đổi cổng |
| BMC tắt xác thực mà vẫn 401 | Chưa **Áp dụng**, hoặc agent chưa nhận bản mới: đợi “đã đồng bộ” |
| iDRAC 9 báo `QueryNotSupported` | BMC → Nâng cao → **Host header = IP của BMC** |
| QCT: `/rpc/*.asp` 502, Remote Control “Not Supported”, tự đăng xuất | Mẫu QCT/AMI (tối đa 4 kết nối); mỗi lúc 1 người dùng 1 BMC (BMC thấy mọi người cùng IP proxy); mở console bằng link **“Mở console Java”** |
| File `.jnlp` tải về ghi `https://<tên-miền>:443` | Bản hiện tại tự sửa thành cổng proxy |
| Console trên web treo, log `UnknownHostException: (null)` | Bản cũ thiếu `EXTRNIP`: cập nhật agent, `docker rm -f bmcgw-kvm-<cổng>` |
| Log agent `jnlp <cổng>: Remote end closed connection` | Cập nhật agent (tải `.jnlp` qua bộ giới hạn + thử lại); **Số kết nối tối đa = 4** |
| Trang “Bạn chưa đăng nhập” khi mở console | Phiên BMC hết / bị huỷ: đăng nhập BMC lại rồi mở link console ngay |
| Container `bmcgw-kvm-<cổng>` tự xuất hiện | Agent tự tạo khi có người bấm Launch trên BMC bật console Java trên web; tự xoá khi đóng JViewer hoặc sau 4 giờ |

## 19. Lưu dữ liệu web vào MySQL (tuỳ chọn)

Mặc định web lưu vào file JSON trong `/opt/bmcproxy/data/`. Bật MySQL thì **toàn bộ dữ liệu của web** nằm trong MySQL, file JSON chỉ còn là bản sao dự phòng:

| Dữ liệu (menu trên web) | Bảng MySQL |
|---|---|
| BMC, Site (kể cả token agent đã băm), Mẫu BMC, Cài đặt, Người dùng (mật khẩu băm, 2FA), cài đặt AD, trạng thái áp dụng | `bmcproxy_docs` |
| Nhật ký (mọi thao tác, lịch sử đăng nhập, lịch sử từng BMC) | `bmcproxy_audit` |
| Bản cấu hình đã phát hành cho từng site (Lịch sử → Quay về), Sao lưu, phiên đăng nhập | `bmcproxy_blobs` |

Không nằm trong MySQL (không cần giữ): trạng thái agent gửi lên mỗi 10 giây, mã cài agent 1 dòng (hết hạn sau 1 giờ), bộ đếm sai mật khẩu.
Trên mỗi server site, agent giữ riêng bản sao config Traefik của chính server đó.

Cài web mới chỉ cần trỏ tới cùng MySQL là có lại đủ dữ liệu, kể cả Sao lưu và phiên đăng nhập. Trang **Cài đặt → Thông tin** ghi rõ đang lưu ở đâu, có mã hoá TLS chưa và số dòng trong DB.

### 19.1. Trên máy MySQL

```sql
CREATE DATABASE IF NOT EXISTS bmcproxy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bmcproxy'@'103.75.187.42' IDENTIFIED WITH mysql_native_password BY '<mật-khẩu-mạnh>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP ON bmcproxy.* TO 'bmcproxy'@'103.75.187.42';
FLUSH PRIVILEGES;
```

- Nên giới hạn user theo **IP máy web** (`'bmcproxy'@'103.75.187.42'`) thay vì `'%'`.
- Mở firewall cổng 3306 **chỉ cho IP máy web**: `ufw allow from 103.75.187.42 to any port 3306 proto tcp`.
- MySQL phải nghe ở IP ngoài: `bind-address = 0.0.0.0` (hoặc IP LAN) trong `/etc/mysql/mysql.conf.d/mysqld.cnf`.

### 19.2. Trên máy web

```bash
sudo bash /home/bmc-gateway-web/install.sh db
```

Script hỏi host / cổng / tài khoản / database / **mật khẩu (bạn tự gõ, không hiện)**. Sau đó script sẽ:
- cài `python3-pymysql`;
- lưu mật khẩu vào `/etc/bmcproxy/db.pass` (chmod 600);
- thử kết nối và quyền tạo bảng;
- sửa `config.json` (khối `"db"`), restart web.

Lần đầu web **tự chuyển dữ liệu hiện có sang MySQL** (log: `đã chuyển … sang mysql …`). Web đã dùng MySQL từ bản trước: khi cập nhật, bản cấu hình đã phát hành, sao lưu và phiên đăng nhập trong file cũng được tự chuyển lên (log: `đã chuyển lên mysql …: … bản cấu hình, … bản sao lưu`).

```bash
sudo journalctl -u bmcproxy -n 20 --no-pager | grep -E "dữ liệu:|đã chuyển"   # dữ liệu: mysql bmcproxy@…
```

| Lỗi | Sửa |
|---|---|
| `LỖI MySQL 1045` | Sai mật khẩu, hoặc user không được phép từ IP máy web |
| `LỖI MySQL 1049` | Chưa tạo database `bmcproxy` |
| `LỖI MySQL 2003` | Không tới được 3306: firewall, `bind-address`, sai IP |
| Web báo đỏ “Mất kết nối cơ sở dữ liệu” | MySQL tạm chết: web vẫn chạy bằng dữ liệu trong bộ nhớ; sửa xong tự hết. Ghi dữ liệu lúc mất MySQL sẽ báo lỗi (đã lưu tạm vào file JSON) |

**Quay lại dùng file JSON:** xoá khối `"db"` trong `/opt/bmcproxy/config.json` rồi `sudo systemctl restart bmcproxy`.

## 20. Quản lý người dùng

Web → **Người dùng** (chỉ quản trị). Mỗi tài khoản có:

| Mục | Dùng để |
|---|---|
| Họ tên, email / SĐT, ghi chú | Biết tài khoản của ai (nhà thầu, phòng NOC…) |
| **Trạng thái: Khoá** | Ngưng ngay: mọi phiên đang mở bị đăng xuất, không đăng nhập được |
| **Hết hạn ngày** | Tài khoản tạm tự hết quyền sau ngày đặt |
| **Đặt lại mật khẩu** + “Bắt đổi mật khẩu” | Người dùng phải đổi sang mật khẩu riêng ở lần đăng nhập sau (không bỏ qua được) |
| **Tắt 2FA** | Khi người dùng mất điện thoại |
| Cột **Đăng nhập cuối**, **Phiên** | Thời điểm + IP lần đăng nhập gần nhất, số trình duyệt đang mở |
| Nút **Đăng xuất** | Đăng xuất tài khoản đó khỏi mọi trình duyệt |
| Nút **Lịch sử** | Đăng nhập thành công / thất bại (sai mật khẩu, sai mã 2FA, bị khoá…), đổi mật khẩu, bật / tắt 2FA |

Quản trị viên không tự khoá, tự cho hết hạn, tự xoá, hay tự bỏ quyền quản trị của chính mình được.

### Xác thực 2 lớp (2FA)

Mỗi người tự bật: **Cài đặt → Xác thực 2 lớp → Bật 2FA**.
1. Trên điện thoại, mở **Google Authenticator / Microsoft Authenticator / FreeOTP** → Thêm tài khoản → **Nhập khoá thiết lập** → dán khoá web hiện ra (loại: theo thời gian).
2. Nhập mã 6 số ứng dụng hiện ra → **Bật**.
3. Từ lần sau, đăng nhập cần thêm ô **mã 6 số**. Giờ điện thoại phải đúng (lệch tối đa ~30 giây).

Quên mật khẩu admin: trên máy web chạy `cd /opt/bmcproxy && sudo -u bmcproxy python3 bmcproxy.py adduser admin` Thêm `--reset-2fa` nếu mất điện thoại 2FA, `--unlock` nếu tài khoản bị khoá / hết hạn.

## 21. Trang Site: công cụ cho từng server

| Nút trên thẻ site | Làm gì | Ai dùng |
|---|---|---|
| **Cài agent** (site chưa kết nối) | Hướng dẫn từng bước + lệnh copy sẵn: agent.json, scp gói, thử kết nối, cài | Quản trị |
| **Kiểm tra BMC** | Agent ping → thử cổng → thử TLS **mọi BMC** của site (theo danh sách hiện tại trên web), hiện bảng kết luận: hoạt động / mất kết nối / web IPMI treo / lỗi TLS | Vận hành |
| **Lịch sử** | 40 lần áp dụng gần nhất: thời điểm, ai áp dụng, thành công / bước lỗi, số BMC. **Quay về**: đặt lại danh sách BMC của site như bản cũ (có sao lưu trước) → bấm **Áp dụng** | Vận hành |
| **Server** | Thông tin server (hệ điều hành, CPU, tải, RAM, đĩa, thời gian bật), **Tải log** agent + Traefik (80 dòng cuối), **Restart Traefik** (BMC gián đoạn 2–5 giây), **Restart agent** | Quản trị |

Dòng **Server** trên thẻ hiện nhanh tài nguyên; RAM / đĩa ≥ 75% vàng, ≥ 90% đỏ.
Các lệnh đi qua kênh agent hỏi web mỗi 10 giây, nên kết quả có sau 5–20 giây.
Dashboard Traefik không giới hạn IP hiện nhãn đỏ **mọi IP** → Sửa site → khai **IP được xem**.
Lệnh xem log đổi được trong agent.json (`log_cmds`).

## 22. Thêm site: cài agent bằng 1 dòng lệnh

1. Web → **Site → + Thêm site** → điền mã, tên, tên miền → **Tạo site**. Web hiện ngay hộp **Cài agent** với 1 dòng lệnh, ví dụ:
   ```bash
   curl -fsSk https://103.75.187.42:9543/install/<mã> | sudo bash
   ```
2. SSH vào **server mới của site** (Ubuntu 22.04), dán dòng đó. Script tự:
   - tải gói agent **từ chính web**, không cần `scp`;
   - tạo **token mới** + `/root/agent.json` (đúng địa chỉ web mà server gọi tới được);
   - tự nhận web dùng chứng chỉ tự ký → `verify_tls: false`;
   - chạy `install.sh agent` (tải Traefik, cài agent, kết nối web).
3. Hộp thoại trên web tự báo **"Agent đã kết nối"** khi server lên. Tiếp theo: **Nhập từ nginx** → **Áp dụng**.

- Lệnh **dùng 1 lần**, hết hạn sau **1 giờ**. Cần lại: nút **Cài agent** trên thẻ site.
- IP của server được **tự thêm vào "IP được phép"** của site.
- Mở web bằng địa chỉ mà **server site gọi tới được** (IP public / tên miền), vì lệnh dùng đúng địa chỉ trên thanh địa chỉ trình duyệt.
- Server chưa có chứng chỉ `*.longvan.net`: `curl … | sudo CERT=/duong/dan.cer KEY=/duong/dan.key bash`.
- Cài lỗi giữa chừng (vd thiếu chứng chỉ): sửa rồi chạy `sudo FORCE_AGENT_JSON=1 bash /home/bmc-gateway-agent/install.sh agent` (không cần lệnh mới).
- Gói web (`bmc-gateway-web-*.zip`) có sẵn gói agent trong thư mục `agent-package/`; `install.sh web` chép vào `/opt/bmcproxy/agent-package/`.

## 23. Trang BMC: nhãn, hạn sử dụng, kiểm tra, lịch sử, nhân bản

| Tính năng | Dùng |
|---|---|
| **Nhãn** | Ô *Nhãn* trong khung sửa BMC (cách nhau dấu phẩy, vd `KH-ABC, tủ A3, R640`). Lọc bằng ô **Mọi nhãn** cạnh ô site, hoặc bấm vào nhãn trong bảng. Chọn nhiều → **Nhãn…** để đặt cùng lúc |
| **Hạn sử dụng** | Ô *Hạn sử dụng* (BMC cho thuê). Còn ≤ 7 ngày: nhãn vàng + cảnh báo; hết hạn: cảnh báo, site chuyển **chờ áp dụng**, bấm **Áp dụng** là BMC tự tắt. Chip **Hết hạn / sắp hết** lọc nhanh. Chọn nhiều → **Hạn…** |
| **Sắp xếp** | Bấm tiêu đề cột Site / Cổng / BMC / Lượt truy cập / Ghi chú (bấm lần 2 đảo chiều, lần 3 bỏ) |
| **Kiểm tra** | Nút trong khung sửa BMC: agent ping / thử cổng / thử TLS riêng BMC đó, kèm gợi ý sửa |
| **Lịch sử** | Ai thêm / sửa / xoá / quay về BMC này, lúc nào |
| **Nhân bản** | Mở form BMC mới cùng cấu hình (bỏ trống cổng); đổi cổng + IP rồi Lưu |

Nhãn và hạn không làm đổi cấu hình Traefik, nên thêm nhãn không bắt Áp dụng lại. CSV xuất / nhập có thêm cột `tags`, `expires`.

## 24. Link web bí mật

Ẩn trang đăng nhập khỏi máy quét: chỉ ai có link mới thấy web.

```bash
sudo bash /home/bmc-gateway-web/install.sh secret-url
```

Script tạo chuỗi ngẫu nhiên, ghi `"web_path"` vào `/opt/bmcproxy/config.json`, restart web, rồi in link, ví dụ `https://103.75.187.42:9543/k7Qm2xP9aB_Lw3Zp/`. **Lưu link lại**, không gửi công khai.

| Đường dẫn | Khi bật link bí mật |
|---|---|
| `https://ip:9543/`, `/api/…` | **404**, như không có web |
| `https://ip:9543/<chuỗi>/` | Giao diện web (cookie phiên chỉ gửi cho đường dẫn này) |
| `/agent/v1/…` (agent), `/install/…` (lệnh cài agent 1 dòng), `/api/zabbix` | Không đổi, agent và Zabbix không phải sửa |

- Đổi link khác: chạy lại `install.sh secret-url` (link cũ hết dùng ngay).
- Tự đặt link: `sudo WEB_PATH=/ten-rieng-kho-doan bash install.sh secret-url` (6–64 ký tự chữ, số, `-` `_`).
- Tắt: `sudo bash install.sh secret-url off`.
- Link bí mật **không thay** mật khẩu, 2FA hay giới hạn IP: chỉ là thêm một lớp. Vẫn nên chỉ mở cổng web cho IP quản trị.

## 25. Ghi nhớ đăng nhập và lưu mật khẩu

- Trang đăng nhập có ô **Ghi nhớ đăng nhập 30 ngày**. Tick: giữ đăng nhập 30 ngày, kể cả khi đóng trình duyệt hay web khởi động lại. Không tick: cookie mất khi đóng trình duyệt (web giới hạn 12 giờ). **Chỉ tick trên máy riêng.**
- Sau khi đăng nhập, Chrome / Edge hỏi **"Lưu mật khẩu?"**: mật khẩu do **trình quản lý mật khẩu của trình duyệt** giữ. Web không tự lưu mật khẩu ở đâu cả.
- Phiên được lưu ở `/opt/bmcproxy/data/sessions.json` (chmod 600), **chỉ là bản băm** của mã phiên.
- Đổi mật khẩu, khoá tài khoản, **Người dùng → Đăng xuất** (mọi phiên) đều xoá cả phiên đang ghi nhớ. Cột **Phiên** trên trang Người dùng ghi rõ phiên nào là "ghi nhớ 30 ngày".

## 26. Đăng nhập bằng tài khoản công ty (Active Directory / LDAP)

Nhân viên đăng nhập web bằng tài khoản Windows / AD, vai trò lấy theo **nhóm AD**. Tài khoản riêng của web (vd `admin`) vẫn đăng nhập được khi AD hỏng, nên **giữ ít nhất 1 tài khoản quản trị riêng** để dự phòng.

**1. Chuẩn bị trên server web**

```bash
sudo apt install -y python3-ldap3      # install.sh web đã tự cài
sudo systemctl restart bmcproxy
```

- Mở đường từ server web tới DC: cổng **636** (ldaps://, khuyến nghị) hoặc **389** + StartTLS.
- CA nội bộ của công ty: chép file CA (.pem) lên server web, vd `/etc/bmcproxy/ad-ca.pem`, rồi nhập vào ô **File CA**.
- Nên tạo **tài khoản dịch vụ** chỉ đọc (vd `svc-bmcproxy`, user thường, mật khẩu không hết hạn). Có nó thì người dùng đăng nhập bằng tên bất kỳ dạng nào và hỗ trợ cả tài khoản không có UPN theo tên miền.
- Tạo nhóm trong AD, vd `BMC-Admins`, `NOC-HCM`, `NOC-HN`, `BMC-Viewers`, rồi thêm người vào nhóm.

**2. Cài đặt → Đăng nhập bằng tài khoản công ty** (chỉ quản trị thấy)

| Ô | Ví dụ |
|---|---|
| Loại máy chủ | Active Directory (Windows) |
| Tên miền AD | `cty.local` → đăng nhập bằng `khai.tq`, `CTY\khai.tq` hoặc `khai.tq@cty.local` |
| Máy chủ | `ldaps://dc01.cty.local ldaps://dc02.cty.local` (máy đầu không trả lời thì dùng máy sau) |
| Base DN | `dc=cty,dc=local` (AD để trống = tự suy từ tên miền) |
| Tài khoản dịch vụ | `CN=svc-bmcproxy,OU=Service,DC=cty,DC=local` + mật khẩu (không bắt buộc) |
| Nhóm → Quản trị / Vận hành / Chỉ xem | `BMC-Admins` · `NOC-HCM, NOC-HN` · `BMC-Viewers` (tên nhóm hoặc DN đầy đủ) |
| Nhóm → site | `NOC-HCM = hcm` / `NOC-HN = hn` (mỗi dòng 1 nhóm; không thuộc nhóm nào ở đây = mọi site) |
| Không thuộc nhóm nào | **Từ chối** (khuyến nghị) / cho vào với vai trò Chỉ xem / Vận hành |

Nhập **Thử đăng nhập** (tài khoản + mật khẩu AD của bạn) → **Kiểm tra / thử đăng nhập**: web báo DN, email, các nhóm và **vai trò sẽ nhận**, chưa tạo tài khoản nào. Đúng rồi mới bật **Bật đăng nhập AD / LDAP** → **Lưu cài đặt AD** (có hiệu lực ngay, không cần Áp dụng). OpenLDAP: chọn loại **OpenLDAP**, nhập **Mẫu DN người dùng** `uid={user},ou=people,dc=cty,dc=local` hoặc tài khoản dịch vụ.

**3. Cách hoạt động**

- Lần đầu đăng nhập AD, web tự tạo tài khoản (nhãn **AD** ở trang Người dùng) với họ tên, email lấy từ AD. Mỗi lần đăng nhập, vai trò / site được cập nhật lại theo nhóm.
- Người không thuộc nhóm nào: quản trị có thể **tạo sẵn** (Người dùng → Thêm tài khoản → Loại: Tài khoản AD) với vai trò mong muốn.
- Trên web vẫn **khoá / đặt hạn / bật 2FA / đăng xuất** được tài khoản AD. Mật khẩu AD **không lưu** trên web, đổi mật khẩu thì đổi trên Windows.
- Trùng tên với tài khoản riêng của web (vd `admin`): luôn dùng mật khẩu riêng của web, AD không "chiếm" được tài khoản đó.
- AD báo mật khẩu hết hạn / tài khoản bị khoá → web báo rõ lý do. DC không trả lời → báo lỗi, dùng tài khoản riêng của web.
- Nghỉ việc / rút khỏi nhóm: tắt tài khoản trong AD là không đăng nhập mới được nữa. Có **tài khoản dịch vụ** thì web tự hỏi lại AD **mỗi 1 giờ**: tài khoản bị tắt, bị xoá hoặc không còn thuộc nhóm nào thì web **tự đăng xuất mọi phiên**; nhóm đổi thì vai trò đổi theo. Không có tài khoản dịch vụ thì bấm **Người dùng → Đăng xuất** hoặc **Khoá**.
- Cấu hình AD lưu ở `data/auth.json` (chmod 600, hoặc MySQL nếu bật), mật khẩu tài khoản dịch vụ không bao giờ gửi về trình duyệt.

## 27. Bảo vệ đăng nhập, nhật ký, MySQL

| Việc | Cách web làm |
|---|---|
| Sai mật khẩu | Mỗi IP sai 5 lần → chặn IP 5 phút. Mỗi **tài khoản** sai 10 lần (từ bất kỳ IP nào) → **khoá tài khoản 15 phút**, ghi vào lịch sử đăng nhập |
| Đổi mật khẩu | Mọi phiên khác của tài khoản (kể cả "Ghi nhớ 30 ngày" ở máy khác) bị **đăng xuất ngay**, phiên đang dùng giữ lại |
| Nhật ký `data/audit.log` | Quá 20 MB tự chuyển sang `audit.log.1` … `audit.log.5` (file cũ nhất bị xoá). Trang Nhật ký chỉ đọc phần cuối file nên không chậm dần |
| HTTPS | Web gửi header HSTS: trình duyệt nhớ 1 năm, luôn dùng https cho địa chỉ web |
| MySQL | `install.sh db` **ưu tiên kết nối mã hoá TLS** (MySQL 8 có sẵn). MySQL không hỗ trợ thì dùng không mã hoá và web hiện cảnh báo trên trang Tổng quan |

Bật TLS cho web đang dùng MySQL không mã hoá: chạy lại `sudo bash install.sh db` (nhập lại thông tin, dữ liệu giữ nguyên).
Muốn kiểm tra cả chứng chỉ MySQL: `sudo DB_SSL_CA=/etc/bmcproxy/mysql-ca.pem bash install.sh db`.

## 28. Cảnh báo, truy cập BMC, link khách, cập nhật agent

> Sau khi cập nhật lên bản này: cập nhật web, bấm **Cập nhật agent** cho từng site (mục 28.4), rồi **Áp dụng** mỗi site 1 lần để Traefik có thêm đường dẫn link khách.

### 28.1. Cảnh báo qua Telegram / Email

**Cài đặt → Cảnh báo qua Telegram / Email** (chỉ quản trị).

| Kênh | Chuẩn bị |
|---|---|
| Telegram | Nhắn **@BotFather** → `/newbot` → lấy **bot token**. Thêm bot vào nhóm NOC, nhắn 1 tin trong nhóm, mở `https://api.telegram.org/bot<token>/getUpdates` để lấy **chat id** (nhóm là số âm, vd `-1001234567890`) |
| Email | Máy chủ SMTP + tài khoản. Gmail: `smtp.gmail.com`, 587, STARTTLS, **mật khẩu ứng dụng** (không dùng mật khẩu Gmail) |

Bấm **Gửi thử** (thử luôn với giá trị trên form, chưa cần lưu) → **Lưu cảnh báo**. Server web phải ra được Internet: `api.telegram.org:443` hoặc cổng SMTP.

| Báo khi | Cách báo |
|---|---|
| Site mất liên lạc / kết nối lại | Khi agent ngừng báo về quá thời gian `agent_offline_after` |
| BMC mất kết nối / kết nối lại | BMC mất **liên tục** N phút (mặc định 3) mới báo, tránh báo khi chập chờn |
| BMC sắp hết hạn | Tóm tắt **1 lần mỗi ngày lúc 8 giờ** các BMC hết hạn trong 7 ngày |
| Áp dụng lỗi | Ngay khi agent báo lỗi, kèm bước bị lỗi (agent đã tự khôi phục) |
| Khoá tài khoản | Khi 1 tài khoản sai mật khẩu 10 lần, kèm IP |
| Cập nhật agent | Kết quả cập nhật từ web |

Chỉ báo lúc trạng thái **đổi**. Web vừa khởi động lại thì lần quét đầu chỉ ghi nhận, không báo. Gửi lỗi (sai token, mất mạng…) được ghi vào **Nhật ký** (`notify-failed`). Bot token và mật khẩu SMTP lưu trong `notify.json` / MySQL, không gửi về trình duyệt.

### 28.2. Trang Truy cập BMC

Menu **Giám sát → Truy cập BMC** (quản trị, vận hành): ai mở **trang BMC** / **console** nào, lúc nào, từ **IP** nào.

- Agent ghi lại ngay ở bước xác thực (forwardAuth) rồi gửi về web mỗi 10 giây. Web mất kết nối thì agent giữ lại, gửi khi có lại.
- **Người dùng** lấy từ dịch vụ auth-token (`username` / `email` / `name` / `sub`…). Dịch vụ không trả tên thì ghi `(không rõ)`.
- Cùng người + IP + BMC + loại trong **30 phút** chỉ ghi 1 dòng.
- **Console**: noVNC (console Java trên web), file `.jnlp`. Console Java qua cổng TCP thô không đi qua xác thực nên không ghi được.
- Lọc theo site / loại / tìm kiếm, **Xuất CSV**. Trong khung BMC có nút **Truy cập**: lịch sử riêng BMC đó.
- Lưu ở `data/access.log` (tự xoay vòng như nhật ký) hoặc bảng MySQL `bmcproxy_access`.

### 28.3. Link tạm cho khách

BMC → bấm vào BMC → **Link khách** → chọn thời hạn (1 giờ … 7 ngày) + ghi chú (khách là ai) → **Tạo link**.

- Link dạng `https://<tên-miền-site>:<cổng>/__bmcgw/guest?t=<mã>`. Khách mở là vào thẳng trang BMC, **không cần tài khoản**, chỉ đúng BMC đó, đến khi hết hạn.
- **Link chỉ hiện 1 lần**: web chỉ lưu bản băm của mã.
- **Thu hồi**: trang Truy cập BMC (bảng Link tạm cho khách) hoặc trong hộp thoại Link khách. Có hiệu lực sau ~10 giây, khách đang mở cũng bị chặn.
- Mỗi lần khách mở link, mỗi trang khách vào đều ghi ở trang Truy cập BMC (nhãn vàng `khách: …`).
- Chỉ tạo được cho BMC **đang bắt xác thực**. Người tạo phải có quyền sửa site đó.
- Link báo **404**: site chưa áp dụng bản cấu hình có đường dẫn `/__bmcgw/guest` → bấm **Áp dụng** site.

### 28.4. Cập nhật agent từ web

Mỗi gói có file `BUILD` (mã bản, vd `2.0.0-cada9917e9`). Thẻ site hiện **Bản agent**. Web có gói agent mới hơn thì hiện nhãn **có bản mới** và nút **Cập nhật agent** (quản trị).

Bấm **Cập nhật agent**, agent sẽ:
1. tải gói từ web bằng token của chính nó (`/agent/v1/package`), kiểm tra **SHA-256** đúng với web;
2. giải nén vào thư mục tạm, **chạy thử** (import mọi module) - lỗi thì giữ nguyên bản cũ;
3. sao lưu bản cũ vào `/opt/bmcproxy/agent-data/agent-backup-<thời gian>/` (giữ 3 bản);
4. chép file mới, thoát để systemd chạy lại (~10 giây). **Traefik và BMC không bị gián đoạn**.

Chỉ thay code agent (`bmcproxy.py`, `gw_*.py`, `kvm/`). Không đổi `agent.json`, service systemd, Traefik. Đổi phiên bản Traefik hay file service vẫn chạy `install.sh agent`.

Quay về bản cũ (trên server site):
```bash
sudo cp /opt/bmcproxy/agent-data/agent-backup-<thời gian>/* /opt/bmcproxy/ && sudo systemctl restart bmcproxy-agent
```

## 29. Cổng cho khách hàng

Tài khoản vai trò **Khách hàng** chỉ thấy trang **BMC của tôi**. Khách không thấy site, cài đặt, nhật ký hay BMC của khách khác.

**Tạo tài khoản** (Người dùng → Thêm tài khoản, chỉ quản trị):
- Vai trò: **Khách hàng**.
- **Nhãn BMC**: vd `KH-ABC`. Khách thấy mọi BMC có nhãn này (đặt nhãn ở BMC → Sửa → Nhãn, hoặc chọn nhiều → Nhãn…). Thêm BMC mới có nhãn đó là khách tự thấy.
- Hoặc **BMC cụ thể**: `hcm:8001 hcm:8005` (site:cổng).
- Phải có ít nhất 1 nhãn hoặc 1 BMC. Gửi khách: link web (kể cả link bí mật nếu bật) + tài khoản. Khách tự đổi mật khẩu, bật 2FA ở Cài đặt.

**Khách dùng thế nào:**
- Mỗi BMC là 1 thẻ: trạng thái (hoạt động / mất kết nối / **đang bảo trì**), trung tâm, hạn dịch vụ.
- **Mở BMC**: web cấp link tạm 4 giờ (như link khách), mở tab mới vào thẳng trang BMC, console Java trên web dùng được luôn. Bấm lại thì link cũ của BMC đó bị thu hồi.
- **Lịch sử truy cập**: ai mở BMC của khách, lúc nào, từ IP nào.
- BMC hết hạn (`Hạn sử dụng`) hoặc đang tắt thì không hiện nữa.

Bảo mật: tài khoản khách hàng bị chặn ở mọi API của nhân viên (trả 403), kể cả `/api/zabbix`. Khoá, đặt hạn, đăng xuất từ xa, lịch sử đăng nhập dùng như tài khoản thường. Mỗi lần khách bấm Mở BMC được ghi vào Nhật ký (`portal-open`).

## 30. Lịch bảo trì

Site → **Bảo trì** (vận hành / quản trị của site đó): chọn **cả site** hoặc **1 BMC**, giờ bắt đầu / kết thúc, ghi chú.

| Trong giờ bảo trì | |
|---|---|
| Cảnh báo | **Không gửi** cảnh báo site mất liên lạc / BMC mất kết nối. Hết giờ mà vẫn lỗi thì cảnh báo gửi bình thường |
| Trang lỗi IPMI | Có biển **"Đang bảo trì đến …"** + ghi chú, người dùng biết không phải sự cố |
| Web | Thẻ site có nhãn 🔧, BMC có nhãn **bảo trì đến …**, Tổng quan ghi "Đang bảo trì" |
| Khách hàng | BMC hiện **đang bảo trì** + ghi chú trên trang BMC của tôi |

- Lịch **sắp tới** bấm **Huỷ** để xoá. Lịch **đang diễn ra** bấm **Kết thúc** để kết thúc ngay (giữ lại lịch sử).
- Lịch đã xong được giữ 90 ngày. Mọi thêm / kết thúc đều ghi Nhật ký (`maint-add`, `maint-end`).
- Agent nhận lịch qua lần đồng bộ (10 giây), không cần Áp dụng.

## 31. Web chạy sau reverse proxy (nginx / Traefik): lấy IP thật

Web để sau nginx / Traefik (vd `https://proxybb-admin.longvan.vn` → `127.0.0.1:9543`) thì mọi yêu cầu đến từ `127.0.0.1`. Web lấy **IP thật** của người dùng từ header proxy ghi vào. Nhật ký, lịch sử đăng nhập, chặn sai mật khẩu theo IP, IP agent đều dùng IP thật.

`config.json` (mặc định đã đúng khi proxy chạy cùng máy):

```json
"trusted_proxies": ["127.0.0.1", "::1"],
"real_ip_header": "X-Forwarded-For"
```

- Chỉ tin header khi yêu cầu đến **từ** địa chỉ trong `trusted_proxies` (IP hoặc dải, vd `10.0.0.0/8`). Người dùng kết nối thẳng thì header bị bỏ qua, không giả mạo được.
- `X-Forwarded-For`: web lấy địa chỉ **ngoài cùng bên phải** không phải proxy tin cậy (phần bên trái do người dùng tự gửi được nên bỏ qua).
- **nginx** phải có dòng này trong `location` chuyển tới web (Traefik tự thêm, không cần sửa):

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

- nginx chỉ đặt `X-Real-IP $remote_addr` thì đổi `"real_ip_header": "X-Real-IP"`.
- Proxy ở máy khác: thêm IP máy proxy vào `trusted_proxies`. Sửa xong `sudo systemctl restart bmcproxy`.
- Agent đi qua proxy: danh sách **IP được phép** của site so với cả IP thật lẫn `127.0.0.1` (site cài từ trước vẫn chạy). Muốn chặt hơn: Sửa site → IP được phép chỉ để IP public của server site.
