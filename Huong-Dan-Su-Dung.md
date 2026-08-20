# Hướng Dẫn Kiểm Thử Hiệu Năng & Demo Chống DDoS

Tài liệu này hướng dẫn cách sử dụng các công cụ Python để giả lập lưu lượng truy cập lớn (Stress Test) nhằm kiểm tra độ bền của website và demo các giải pháp bảo mật.

## ⚠️ CẢNH BÁO QUAN TRỌNG
- **Chỉ sử dụng trên hệ thống bạn sở hữu:** Việc chạy các script này lên website của người khác là vi phạm pháp luật.
- **Nguy cơ tự treo máy:** Các công cụ này tận dụng tối đa CPU và băng thông. Nếu cấu hình quá cao, máy tính của bạn có thể bị lag hoặc treo tạm thời.
- **Nhà cung cấp Hosting:** Việc test tải quá mức có thể khiến IP của bạn bị nhà cung cấp mạng (ISP) hoặc Hosting khóa tạm thời.

---

## 1. Chuẩn Bị Môi Trường

Yêu cầu máy tính đã cài đặt **Python 3.7+**.

Cài đặt thư viện cần thiết:
```powershell
pip install aiohttp
```

---

## 2. Công Cụ 1: Web Stress Tester (Bản Cơ Bản)
Phù hợp để lấy báo cáo chi tiết về tốc độ phản hồi (RPS), số lỗi và độ trễ.

**Cách dùng:**
1. Mở Terminal tại thư mục `Tool-DDOS`.
2. Chạy lệnh:
   ```powershell
   python web_stress_tester.py https://web-cua-ban.com -n 1000 -c 50
   ```
   - `-n 1000`: Tổng số 1000 yêu cầu.
   - `-c 50`: 50 kết nối đồng thời.

---

## 3. Công Cụ 2: Extreme Stress Tester (Bản Demo Cực Mạnh)
Phù hợp để demo làm "sập" server hoặc kiểm tra ngưỡng chịu tải tối đa. Bản này tận dụng đa nhân CPU và không chờ phản hồi từ server để đạt tốc độ cao nhất.

**Cách dùng:**
1. Mở file `extreme_stress_tester.py` bằng trình chỉnh sửa mã (VS Code, Notepad++).
2. Sửa dòng: `TARGET_URL = "https://web-cua-ban.com"`.
3. Chạy lệnh:
   ```powershell
   python extreme_stress_tester.py
   ```
4. Theo dõi CPU của máy và trạng thái website trên một thiết bị khác.
5. Nhấn **Ctrl + C** để dừng.

---

## 4. Các Giải Pháp Phòng Thủ (Nên Triển Khai)

Sau khi demo làm sập hệ thống, hãy trình bày các giải pháp sau để khắc phục:

### A. Sử dụng Cloudflare (Khuyên dùng)
- Bật chế độ "Under Attack Mode".
- Sử dụng WAF để lọc traffic từ các botnet.

### B. Cấu hình Rate Limiting trên Nginx
Giới hạn mỗi IP chỉ được gửi tối đa 5 yêu cầu/giây:
```nginx
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=5r/s;

server {
    location / {
        limit_req zone=mylimit burst=10 nodelay;
        ...
    }
}
```

### C. Tối ưu hóa Cache
- Sử dụng **WP Rocket** hoặc **LiteSpeed Cache** cho WordPress.
- Cấu hình **Object Cache (Redis)** để giảm tải cho Database.

### D. Chống Spam bằng CAPTCHA
- Tích hợp Google reCAPTCHA v3 vào các form liên hệ hoặc trang đăng nhập để ngăn chặn bot tự động.

---
*Tài liệu được biên soạn bởi Fix Nhanh - Hệ thống Giám sát & Bảo mật.*
