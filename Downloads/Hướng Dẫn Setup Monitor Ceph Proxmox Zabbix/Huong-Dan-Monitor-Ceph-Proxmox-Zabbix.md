# Hướng Dẫn Setup Monitor Ceph trên Proxmox bằng Zabbix

Để giám sát Ceph Cluster (được tích hợp trên Proxmox) bằng Zabbix, cách tốt nhất là sử dụng **Zabbix Agent 2** kết hợp với **Ceph REST API** (thông qua module `restful` của Ceph Manager). 

Dưới đây là các bước chi tiết để cấu hình:

## Bước 1: Kích hoạt Ceph RESTful API trên Proxmox

Đăng nhập SSH vào một trong các node Proxmox (node đang chạy Ceph Monitor / Manager) và thực hiện các lệnh sau:

1. **Bật module restful cho Ceph Manager:**
   ```bash
   ceph mgr module enable restful
   ```

2. **Tạo chứng chỉ tự ký (self-signed certificate) cho API:**
   ```bash
   ceph restful create-self-signed-cert
   ```

3. **Tạo user cho Zabbix và lấy API Key:**
   Chạy lệnh sau để tạo một tài khoản (ví dụ tên là `zabbix`):
   ```bash
   ceph restful create-key zabbix
   ```
   Lệnh này sẽ trả về một chuỗi API Key (ví dụ: `xxxx-xxxx-xxxx-xxxx`). **Hãy lưu lại chuỗi này** để cấu hình trên Zabbix Server ở Bước 3.

4. **Kiểm tra endpoint của API đang chạy ở đâu:**
   ```bash
   ceph mgr services
   ```
   Kết quả sẽ hiển thị URL của restful, thường là cổng `8003` (ví dụ: `https://<IP_NODE_MGR>:8003`).

---

## Bước 2: Cài đặt và cấu hình Zabbix Agent 2 trên Proxmox

Nếu bạn chưa cài Zabbix Agent 2 trên các node Proxmox, hãy tiến hành cài đặt. (Khuyến nghị cài Zabbix Agent 2 vì nó có sẵn plugin hỗ trợ giám sát Ceph).

1. **Cài đặt Zabbix Agent 2:**
   ```bash
   wget https://repo.zabbix.com/zabbix/6.4/debian/pool/main/z/zabbix-release/zabbix-release_6.4-1+debian11_all.deb
   dpkg -i zabbix-release_6.4-1+debian11_all.deb
   apt update
   apt install zabbix-agent2 -y
   ```
   *(Lưu ý: Thay đổi phiên bản repo Zabbix cho phù hợp với hệ thống Proxmox của bạn, Proxmox 7 dùng Debian 11 Bullseye, Proxmox 8 dùng Debian 12 Bookworm).*

2. **Cấu hình Zabbix Agent 2:**
   Chỉnh sửa file `/etc/zabbix/zabbix_agent2.conf`, cấu hình IP Zabbix Server/Proxy và thêm một số tham số cần thiết:
   ```bash
   nano /etc/zabbix/zabbix_agent2.conf
   ```
   **Các thông số cần chỉnh sửa hoặc thêm vào file:**
   ```ini
   Server=10.8.10.201  # Thay bằng IP Zabbix Proxy hoặc Zabbix Server của bạn
   ServerActive=10.8.10.201
   Plugins.Ceph.InsecureSkipVerify=true
   AllowKey=system.run[*]
   ```

3. **Tạo script thu thập trạng thái (Health) của Ceph (Tuỳ chọn bổ sung):**
   Bạn có thể tạo thêm một cronjob để xuất trạng thái `ceph health` ra file text, sau đó dùng Zabbix để đọc file này.
   
   Chạy các lệnh sau để tạo file script:
   ```bash
   cd /etc/zabbix/
   touch cephstatus.txt docfile.sh cephstatus.sh
   chmod +x cephstatus.txt docfile.sh cephstatus.sh
   ```

   **Tạo file `cephstatus.sh` (Script lấy trạng thái):**
   ```bash
   cat << 'EOF' > /etc/zabbix/cephstatus.sh
   #!/bin/sh
   ceph health > /etc/zabbix/cephstatus.txt
   date >> /etc/zabbix/cephstatus.txt
   EOF
   ```

   **Tạo file `docfile.sh` (Script đọc trạng thái cho Zabbix nếu cần gọi qua system.run):**
   ```bash
   cat << 'EOF' > /etc/zabbix/docfile.sh
   #!/bin/sh
   value=$(cat /etc/zabbix/cephstatus.txt)
   echo "$value"
   EOF
   ```

   Kiểm tra chạy thử 2 script:
   ```bash
   ./cephstatus.sh
   ./docfile.sh
   ```

   **Thêm vào crontab để script lấy dữ liệu chạy mỗi phút:**
   ```bash
   crontab -e
   ```
   Thêm dòng sau vào cuối file crontab:
   ```cron
   * * * * * /etc/zabbix/cephstatus.sh
   ```

4. **Khởi động lại dịch vụ Zabbix Agent:**
   ```bash
   systemctl restart zabbix-agent2
   systemctl enable zabbix-agent2
   ```

---

## Bước 3: Cấu hình trên giao diện web Zabbix Server

1. **Gán Template cho Host Proxmox:**
   - Đăng nhập vào giao diện web của Zabbix.
   - Đi tới **Data collection -> Hosts** (hoặc Configuration -> Hosts).
   - Chọn Host là Node Proxmox (nơi đang chạy Ceph Manager).
   - Trong phần **Templates**, tìm và thêm template: **`Ceph by Zabbix agent 2`**.

2. **Cấu hình các Macro (Macros):**
   Chuyển sang tab **Macros** trên Host đó (chọn *Inherited and host macros* hoặc tạo *Host macros*). Thêm/chỉnh sửa các macro sau để Zabbix Agent có thể xác thực với Ceph API:
   
   - `{$CEPH.API.KEY}` : Điền API Key mà bạn lấy được ở Bước 1.
   - `{$CEPH.USER}` : `zabbix` (Tên user bạn đã tạo ở Bước 1).
   - `{$CEPH.API.URL}` : `https://localhost:8003` (Hoặc IP tĩnh của node chạy Manager nếu localhost không hoạt động, ví dụ `https://10.0.0.1:8003`).

   *(Lưu ý: Zabbix Agent 2 plugin cho phép bỏ qua xác thực chứng chỉ SSL tự ký mặc định của Ceph).*

3. **Cập nhật và kiểm tra:**
   - Nhấn **Update** để lưu cấu hình.
   - Chờ một vài phút, sau đó đi tới **Monitoring -> Latest data**, lọc theo host Proxmox và gõ `Ceph` vào ô tìm kiếm để kiểm tra xem dữ liệu (như Ceph OSDs, Pool status, IOPS, Cluster Health...) đã bắt đầu được thu thập chưa.

---

## Các lưu ý thêm
- **Ceph Manager Failover:** Trong Proxmox Ceph Cluster, Ceph Manager có thể chuyển đổi (failover) giữa các node. Nếu MGR active chuyển sang node khác, API sẽ chạy trên node mới. Để giám sát liên tục, bạn có thể thiết lập HAProxy nội bộ hoặc gán template Ceph cho tất cả các node Proxmox có chạy MGR (nhưng lưu ý việc duplicate data). 
- Đơn giản nhất là theo dõi endpoint qua địa chỉ IP của một node cố định nếu node đó luôn chạy MGR hoặc trỏ `{$CEPH.API.URL}` vào VIP/HAProxy.
