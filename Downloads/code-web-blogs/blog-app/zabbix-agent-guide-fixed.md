# Hướng dẫn Cài đặt Zabbix Agent Tự động (Multi-OS)

Tài liệu này hướng dẫn cách sử dụng script tự động để cài đặt và cấu hình **Zabbix Agent (Classic)** hoặc **Zabbix Agent 2** trên các hệ điều hành Linux phổ biến như Ubuntu, Debian, CentOS, RHEL, Oracle Linux.

## 1. So sánh Zabbix Agent và Zabbix Agent 2
Script hỗ trợ cả hai phiên bản để bạn linh hoạt lựa chọn:
- **Zabbix Agent 2 (Khuyên dùng)**: 
    - Viết bằng ngôn ngữ Go, hiệu năng cực cao.
    - Xử lý đa luồng tốt, hỗ trợ nhiều plugin hiện đại (Docker, MySQL, Redis...).
    - Tương thích hoàn toàn với các bản Server mới.
- **Zabbix Agent (Classic)**:
    - Bản truyền thống, nhẹ, phù hợp cho các hệ thống cũ hoặc yêu cầu tối giản.
    - Chạy ổn định trên hầu hết mọi môi trường.

## 2. Chuẩn bị
Trước khi chạy script, hãy đảm bảo:
- Bạn có quyền **root** hoặc **sudo** trên máy chủ.
- Máy chủ có kết nối Internet để tải gói cài đặt từ kho lưu trữ của Zabbix.
- Đã biết IP của **Zabbix Server** (hoặc Zabbix Proxy) để cấu hình.

## 3. Cách sử dụng Script

### Cách 1: Chạy nhanh bằng 1 câu lệnh (Khuyên dùng)
Dán câu lệnh này vào Terminal của Server để tự động tải và chạy script:
```bash
curl -sSL https://raw.githubusercontent.com/fixnhanh-linux/System-Monitoring-Construction-Guide/main/Cai-Dat-Zabbix-Agent-Auto/install-zabbix-agent.sh -o install-zabbix-agent.sh && sudo bash install-zabbix-agent.sh
```

### Cách 2: Tải thủ công
Nếu bạn muốn tạo file script trực tiếp:
1. Tạo file: `nano install-zabbix-agent.sh`
2. Cấp quyền: `chmod +x install-zabbix-agent.sh`
3. Chạy: `sudo ./install-zabbix-agent.sh`

### Bước 4: Làm theo hướng dẫn trên màn hình
1. Chọn **1** để bắt đầu cài đặt.
2. Chọn loại Agent: **1** cho Agent 2 hoặc **2** cho Agent Classic.
3. Nhập **IP Zabbix Server** khi được hỏi.
4. Nhập **Hostname** (định danh máy chủ trên Zabbix). Script sẽ tự động lấy tên máy hiện tại làm mặc định.

## 4. Các chức năng khác của Script
- **Kiểm tra trạng thái**: Tự động nhận diện bản Agent đang chạy để kiểm tra service, port 10050 và cấu hình hiện tại.
- **Gỡ cài đặt**: Cho phép chọn gỡ bỏ Agent 2 hoặc Agent Classic một cách sạch sẽ.

## 5. Cấu hình trên Giao diện Zabbix (Frontend)
Sau khi cài đặt xong trên server, bạn cần thực hiện các bước sau trên web Zabbix:
1. Vào **Configuration** -> **Hosts** -> **Create host**.
2. **Host name**: Nhập chính xác Hostname bạn đã đặt lúc chạy script.
3. **Templates**: 
    - Nếu dùng Agent 2: Chọn `Linux by Zabbix agent` hoặc `Linux by Zabbix agent active`.
    - Nếu dùng Agent Classic: Chọn `Linux by Zabbix agent`.
4. **Interfaces**: Click **Add** -> **Agent**. Nhập IP của máy vừa cài Agent.
5. Nhấn **Add** để hoàn tất.

## 6. Xử lý lỗi thường gặp
- **Không kết nối được Server**: Kiểm tra firewall trên cả Server và Client. Thử lệnh `telnet [IP_Server] 10051`.
- **Log file**: Kiểm tra log để biết chi tiết lỗi:
  - Agent 2: `/var/log/zabbix/zabbix_agent2.log`
  - Agent Classic: `/var/log/zabbix/zabbix_agentd.log`

---
*Cung cấp bởi Fix Nhanh - Giải pháp giám sát hệ thống chuyên nghiệp.*
