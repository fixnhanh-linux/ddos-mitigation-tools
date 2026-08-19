# HƯỚNG DẪN CÀI ĐẶT CÁC DỊCH VỤ (SERVICES) CHO WEBSITE

Tài liệu này liệt kê toàn bộ các dịch vụ bên thứ 3 (Third-party Services) cần thiết để chạy đầy đủ các tính năng của website.

---

## 1. Cơ sở dữ liệu (Database) - BẮT BUỘC
Website sử dụng **MongoDB** làm cơ sở dữ liệu chính để lưu trữ bài viết, người dùng, cài đặt...

- **Dịch vụ khuyên dùng:** [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Miễn phí 512MB)
- **Cách thiết lập:**
  1. Tạo tài khoản MongoDB Atlas và tạo một Cluster (chọn gói M0 Free).
  2. Tạo Database User (Lưu lại Username và Password).
  3. Lấy chuỗi kết nối (Connection String) định dạng: `mongodb+srv://<username>:<password>@cluster.mongodb.net/blog_db?retryWrites=true&w=majority`
  4. Mở file `.env.local` ở thư mục gốc và dán vào biến `MONGODB_URI`.

---

## 2. Lưu trữ Ảnh và Media (Storage) - TÙY CHỌN (Khuyên dùng)
Nếu không dùng dịch vụ ngoài, ảnh sẽ lưu tạm vào thư mục `public/uploads` của máy chủ. Tuy nhiên, khi deploy lên Vercel/Netlify, các file này sẽ bị xoá mỗi khi máy chủ khởi động lại. Do đó sếp NÊN dùng 1 trong 2 dịch vụ sau:

### Phương án A: Amazon Web Services (AWS S3) - Ưu tiên số 1
- **Cách thiết lập:**
  1. Đăng ký tài khoản AWS, vào dịch vụ S3 tạo một **Bucket**.
  2. Vào IAM (Identity and Access Management) tạo một **User**, cấp quyền `AmazonS3FullAccess`.
  3. Lấy `Access Key ID` và `Secret Access Key`.
  4. Sếp có thể điền các thông tin này trực tiếp tại trang **Admin -> Cài đặt -> Lưu trữ Đám mây** (không cần sửa code).

### Phương án B: Cloudinary - Miễn phí và dễ dùng
- **Cách thiết lập:**
  1. Đăng ký tài khoản tại [Cloudinary](https://cloudinary.com/).
  2. Tại trang Dashboard, lấy 3 thông số: `Cloud Name`, `API Key`, `API Secret`.
  3. Tương tự như S3, sếp có thể nhập trực tiếp 3 mã này vào trang **Admin -> Cài đặt -> Lưu trữ Đám mây**.

---

## 3. Hệ thống theo dõi truy cập (Google Analytics) - TÙY CHỌN
Dùng để xem có bao nhiêu người đang truy cập website, họ đến từ đâu.

- **Dịch vụ:** [Google Analytics 4 (GA4)](https://analytics.google.com/)
- **Cách thiết lập:**
  1. Đăng nhập và tạo một **Tài sản (Property)** mới cho website của sếp.
  2. Lấy **Mã đo lường (Measurement ID)**. Nó có định dạng: `G-XXXXXXXXXX`.
  3. Truy cập trang **Admin -> Cài đặt -> Cài đặt Marketing** và dán mã này vào. (Không cần sửa file `.env`).

---

## 4. Tự động Sao lưu (Auto Backup) & Lên lịch (Cron Jobs) - BẮT BUỘC NẾU MUỐN AUTO
Website đã được code sẵn tính năng tự động sao lưu dữ liệu vào 2h sáng hàng ngày (thông qua Vercel Cron).

- **Dịch vụ:** [Vercel](https://vercel.com/) (Dành cho nền tảng Hosting)
- **Cách thiết lập:**
  1. Trong file `.env.local`, sếp tạo một biến `CRON_SECRET=chuoi_ky_tu_bi_mat_bat_ky` (dùng để làm chìa khóa bảo mật, tránh người ngoài gọi trộm hàm backup).
  2. Khi deploy code này lên Vercel, file `vercel.json` sẽ tự động báo cho Vercel biết để thiết lập lịch chạy vào lúc 2h sáng mỗi ngày.

---

## TỔNG HỢP FILE `.env.local` MẪU:

Sếp tạo một file tên là `.env.local` ở thư mục gốc của project (ngang hàng với `package.json`) và copy cấu trúc sau vào:

```env
# 1. Cơ sở dữ liệu MongoDB
MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/blog?retryWrites=true&w=majority"

# 2. Xác thực (NextAuth) - Bắt buộc
# Chạy lệnh: `openssl rand -base64 32` trong Terminal để tạo một mã bí mật và dán vào đây
NEXTAUTH_SECRET="ma_bi_mat_cua_sep_o_day"
NEXTAUTH_URL="http://localhost:3005" # Đổi thành Domain thật khi đưa lên mạng (ví dụ: https://tenwebsite.com)

# 3. Mã bảo mật cho Cron Backup
CRON_SECRET="chuoi_ky_tu_bi_mat_bat_ky"

# --- CÁC PHẦN DƯỚI ĐÂY LÀ KHÔNG BẮT BUỘC ---
# (Vì sếp có thể nhập trực tiếp trên giao diện Admin)

# AWS S3 (Nếu muốn cấu hình cứng)
# AWS_REGION=ap-southeast-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET_NAME=

# CLOUDINARY (Nếu muốn cấu hình cứng)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```
