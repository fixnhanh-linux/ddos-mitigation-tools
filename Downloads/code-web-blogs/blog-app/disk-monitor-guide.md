# Hướng dẫn Giám sát Sức khỏe Ổ cứng Tự động qua Zabbix (SMART Monitoring)

Tài liệu này hướng dẫn cách sử dụng script tự động để cài đặt và cấu hình giám sát sức khỏe ổ cứng (HDD/SSD/NVMe) qua **Zabbix Agent Classic** sử dụng công nghệ **S.M.A.R.T.** (Self-Monitoring, Analysis and Reporting Technology).

---

## 1. Tổng quan Giải pháp

### S.M.A.R.T. là gì?
S.M.A.R.T. là công nghệ tích hợp sẵn trong hầu hết ổ cứng hiện đại, cho phép:
- **Phát hiện sớm** lỗi ổ cứng trước khi xảy ra sự cố mất dữ liệu
- **Theo dõi** nhiệt độ, số giờ hoạt động, bad sector, SSD wear level
- **Cảnh báo tự động** qua Zabbix khi phát hiện bất thường

### Kiến trúc Giám sát
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Ổ cứng        │────▶│  smartctl         │────▶│ Zabbix      │
│ (HDD/SSD/NVMe)  │     │  (smartmontools)  │     │ Agent Classic │
└─────────────────┘     └──────────────────┘     │ SMART Plugin│
                                                   └──────┬──────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │ Zabbix      │
                                                   │ Server      │
                                                   │ (Template)  │
                                                   └──────┬──────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │ Dashboard   │
                                                   │ + Alerts    │
                                                   └─────────────┘
```

### Yêu cầu
| Thành phần       | Phiên bản tối thiểu | Ghi chú                              |
|-------------------|----------------------|--------------------------------------|
| Zabbix Agent Classic | 5.0+                 | Bắt buộc, sử dụng UserParameter      |
| smartmontools     | 7.1+                 | Script sẽ tự cài đặt                |
| Hệ điều hành     | Linux                | Ubuntu, Debian, CentOS, RHEL, Rocky, AlmaLinux, Oracle Linux |

> **Lưu ý:** Script yêu cầu Zabbix Agent Classic đã được cài đặt sẵn. Nếu chưa, sử dụng script cài đặt Agent tại thư mục `Cai-Dat-Zabbix-Agent-Auto/`.

---

## 2. Cách sử dụng Script

### Cách 1: Chạy nhanh bằng 1 câu lệnh (Khuyên dùng)
```bash
curl -sSL https://raw.githubusercontent.com/fixnhanh-linux/System-Monitoring-Construction-Guide/main/Monitor-Disk-Zabbix-Auto/scripts/setup-disk-monitor.sh -o setup-disk-monitor.sh && sudo bash setup-disk-monitor.sh
```

### Cách 2: Tải thủ công
```bash
# Tải script
wget https://raw.githubusercontent.com/fixnhanh-linux/System-Monitoring-Construction-Guide/main/Monitor-Disk-Zabbix-Auto/scripts/setup-disk-monitor.sh

# Cấp quyền thực thi
chmod +x setup-disk-monitor.sh

# Chạy script
sudo ./setup-disk-monitor.sh
```

---

## 3. Các chức năng của Script

### 3.1. Cài đặt tự động (Full Setup) - Option 1
Script sẽ thực hiện **5 bước** tự động:

| Bước | Mô tả                                  | Chi tiết                                    |
|------|-----------------------------------------|---------------------------------------------|
| 1/5  | Cài đặt smartmontools                   | Tự phát hiện OS và cài đặt gói phù hợp     |
| 2/5  | Kiểm tra Zabbix Agent Classic            | Xác nhận Agent Classic đã cài và đang hoạt động |
| 3/5  | Cấu hình sudoers                        | Cấp quyền cho user `zabbix` chạy `smartctl` |
| 4/5  | Cấu hình SMART UserParameter             | Tạo UserParameter cho Zabbix Agent Classic    |
| 5/5  | Khởi động lại & Kiểm tra               | Restart Agent, liệt kê ổ cứng được phát hiện|

### 3.2. Kiểm tra trạng thái - Option 2
Hiển thị trạng thái tổng quan:
- smartmontools: đã cài / chưa cài
- Zabbix Agent Classic: running / stopped
- Sudoers: đã cấu hình / chưa
- SMART UserParameter: đã cấu hình / chưa

### 3.3. Xem thông tin SMART - Option 3
Hiển thị chi tiết sức khỏe từng ổ cứng:
- Model, Serial, Dung lượng
- Trạng thái sức khỏe (PASSED / FAILED)
- Nhiệt độ, Giờ hoạt động
- Bad Sector (Reallocated Sectors)
- SSD Wear Level

### 3.4. Chạy Self-Test - Option 4
Cho phép kích hoạt kiểm tra ổ cứng:
- **Short Test** (~2 phút): Kiểm tra nhanh
- **Long Test** (~1-4 giờ): Kiểm tra toàn diện

### 3.5. Gỡ cài đặt - Option 5
Gỡ bỏ toàn bộ cấu hình giám sát (sudoers, plugin, tùy chọn gỡ smartmontools).

---

## 4. Cấu hình trên Giao diện Zabbix (Frontend)

Sau khi chạy script thành công trên server, thực hiện các bước sau trên Zabbix Web:

### Cấu hình trên Zabbix Web với Zabbix Agent Classic
1. Đăng nhập Zabbix Web.
2. Vào **Data collection** → **Templates** → Chọn **Import** (ở góc trên bên phải).
3. Chọn file `zabbix_smart_classic_template.yaml` từ repository.
4. Nhấn **Import** để thêm template `SMART by Zabbix agent Classic`.
5. Vào **Data collection** → **Hosts** → Chọn Host.
6. Tab **Templates** → Tìm kiếm và gán template: `SMART by Zabbix agent Classic`.
7. Nhấn **Update**.

### Bước 2: Chờ Discovery
- Cả hai template đều sử dụng **Low-Level Discovery (LLD)** để tự động quét ổ cứng.
- Thời gian chờ: **2-5 phút** (hoặc vào Discovery rules → chọn Rule và nhấn "Execute now").

### Bước 3: Xác nhận dữ liệu
- Vào **Monitoring** → **Latest data** → Lọc theo Host.
- Tìm kiếm từ khóa `SMART` để xem các metrics đã thu thập.

---

## 5. Các Metrics được Giám sát

Template **SMART by Zabbix agent Classic** tự động thu thập:

| Metric                    | Mô tả                                  | Cảnh báo                |
|---------------------------|-----------------------------------------|--------------------------|
| SMART overall health      | Trạng thái tổng thể ổ cứng             | Trigger khi FAILED       |
| Temperature               | Nhiệt độ ổ cứng (°C)                   | > 50°C cảnh báo          |
| Power On Hours            | Tổng số giờ hoạt động                   | Theo dõi tuổi thọ        |
| Reallocated Sectors       | Số bad sector đã remap                  | > 0 cảnh báo             |
| Self-test status          | Kết quả self-test gần nhất              | Trigger khi FAILED       |
| Media Wearout (SSD)       | Mức độ hao mòn SSD                      | Trigger khi thấp         |
| Command timeout           | Lỗi lệnh smartctl                      | Trigger khi xảy ra       |

---

## 6. Xử lý lỗi thường gặp

### 6.1. Không có dữ liệu SMART trên Zabbix
```bash
# Kiểm tra smartctl có hoạt động không
sudo smartctl --scan

# Kiểm tra quyền zabbix
sudo -u zabbix sudo smartctl --scan

# Kiểm tra log Agent
tail -50 /var/log/zabbix/zabbix_agentd.log | grep -i smart
```

### 6.2. Máy ảo (VM) không có dữ liệu SMART
- Các VM (KVM, VMware, Hyper-V) thường **không hỗ trợ** SMART passthrough
- SMART chỉ hoạt động trên **máy vật lý** (Bare Metal)
- Với VMware, cần bật SMART passthrough ở cấp ESXi

### 6.3. Lỗi Permission denied
```bash
# Kiểm tra file sudoers
cat /etc/sudoers.d/zabbix_smartctl

# Nội dung đúng phải là:
# zabbix ALL=(ALL) NOPASSWD:/usr/sbin/smartctl
```

### 6.4. Plugin path không đúng
```bash
# Tìm đường dẫn smartctl
which smartctl

# Kiểm tra cấu hình UserParameter
cat /etc/zabbix/zabbix_agentd.conf.d/smart_userparameter.conf
```

---

## 7. Macro tùy chỉnh (Advanced)

Có thể override các macro sau trên Host hoặc Template trong Zabbix:

| Macro                              | Mặc định | Mô tả                              |
|------------------------------------|----------|-------------------------------------|
| `{$SMART.DISK.NAME.MATCHES}`      | `.+`     | Regex lọc ổ cứng cần giám sát      |
| `{$SMART.DISK.NAME.NOT_MATCHES}`  | `CHANGE` | Regex loại trừ ổ cứng              |
| `{$SMART.TEMPERATURE.MAX.WARN}`   | `50`     | Ngưỡng cảnh báo nhiệt độ (°C)      |
| `{$SMART.TEMPERATURE.MAX.CRIT}`   | `65`     | Ngưỡng critical nhiệt độ (°C)      |

---

*Cung cấp bởi Fix Nhanh - Giải pháp giám sát hệ thống chuyên nghiệp.*
