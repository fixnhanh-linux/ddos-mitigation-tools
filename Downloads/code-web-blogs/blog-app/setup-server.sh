#!/bin/bash

# ==============================================================================
# SCRIPT CÀI ĐẶT & DEPLOY ỨNG DỤNG NEXT.JS LÊN SERVER UBUNTU
# Yêu cầu: Chạy script này bằng quyền root (sudo ./setup-server.sh)
# ==============================================================================

# Dừng script nếu có lỗi xảy ra
set -e

echo "========================================="
echo "BẮT ĐẦU CÀI ĐẶT SERVER CHẠY WEBSITE BLOG"
echo "========================================="

# 1. Cập nhật hệ thống
echo "👉 [1/6] Đang cập nhật hệ điều hành..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git nginx certbot python3-certbot-nginx

# 2. Cài đặt Node.js (Bản LTS mới nhất - v20)
echo "👉 [2/6] Đang cài đặt Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js đã được cài đặt: $(node -v)"
fi

# 3. Cài đặt trình quản lý tác vụ PM2 (để web chạy ngầm 24/24)
echo "👉 [3/6] Đang cài đặt PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "PM2 đã được cài đặt."
fi

# 4. Cài đặt ứng dụng Next.js
echo "👉 [4/6] Đang cài đặt thư viện và Build ứng dụng..."
# Đảm bảo chúng ta đang ở thư mục chứa code
cd "$(dirname "$0")"
npm install
echo "Đang Build mã nguồn (Có thể mất vài phút)..."
npm run build

# 5. Cấu hình NGINX (Reverse Proxy)
echo "👉 [5/6] Đang thiết lập NGINX Web Server..."
DOMAIN_NAME="fixnhanh.cloud" # Đã cấu hình tên miền của sếp
PORT="3005" # Cổng mặc định của web đang chạy

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME"

sudo bash -c "cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOF"

# Bật cấu hình NGINX
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
# Xoá cấu hình mặc định (nếu có)
sudo rm -f /etc/nginx/sites-enabled/default
# Khởi động lại NGINX
sudo systemctl restart nginx

# 6. Chạy Website bằng PM2
echo "👉 [6/6] Đang khởi động Website..."
# Tắt tiến trình cũ nếu có
pm2 delete blog-app 2>/dev/null || true
# Chạy tiến trình mới
pm2 start npm --name "blog-app" -- run start

# Lưu PM2 để tự động chạy khi khởi động lại server
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "========================================="
echo "🎉 HOÀN TẤT CÀI ĐẶT!"
echo "========================================="
echo "- Website của bạn hiện đang chạy ngầm bằng PM2 ở cổng $PORT."
echo "- NGINX đã được cấu hình để trỏ tên miền $DOMAIN_NAME vào cổng $PORT."
echo ""
echo "📝 CÁC BƯỚC TIẾP THEO:"
echo "1. Đảm bảo bạn đã trỏ IP tên miền fixnhanh.cloud về máy chủ này."
echo "2. Chạy lệnh sau để lấy chứng chỉ bảo mật HTTPS (SSL) miễn phí:"
echo "   sudo certbot --nginx -d $DOMAIN_NAME"
echo ""
echo "💡 CÁC LỆNH PM2 HỮU ÍCH:"
echo "- pm2 status       : Xem danh sách web đang chạy"
echo "- pm2 logs blog-app: Xem log lỗi của web"
echo "- pm2 restart all  : Khởi động lại web"
echo "========================================="
