const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const htmlContent = `
<p><strong>LEMP Stack</strong> là chữ viết tắt của <strong>L</strong>inux, <strong>E</strong>ngine-X (Nginx), <strong>M</strong>ySQL/MariaDB và <strong>P</strong>HP. Khác với LAMP truyền thống dùng Apache, LEMP sử dụng <strong>Nginx</strong> làm máy chủ web, mang lại hiệu suất vượt trội và khả năng chịu tải (concurrent connections) tốt hơn rất nhiều, đặc biệt phù hợp cho các website có lượng truy cập lớn. Bài viết này sẽ hướng dẫn bạn cài đặt LEMP Stack từ A-Z trên hệ điều hành <strong>Ubuntu/Debian</strong>.</p>

<hr>

<h2>Bước 1: Cập nhật hệ thống (Linux)</h2>
<p>Trước khi cài đặt bất kỳ phần mềm nào, luôn luôn đảm bảo hệ điều hành của bạn đang ở trạng thái mới nhất.</p>
<pre><code class="language-bash">sudo apt update
sudo apt upgrade -y</code></pre>

<hr>

<h2>Bước 2: Cài đặt Web Server (Nginx)</h2>
<p>Nginx (đọc là Engine-X) là máy chủ web hiệu năng cao đang được các website lớn nhất thế giới ưa chuộng.</p>
<ul>
<li><strong>Chạy lệnh cài đặt Nginx:</strong>
<pre><code class="language-bash">sudo apt install nginx -y</code></pre></li>
<li><strong>Khởi động và bật Nginx chạy ngầm cùng hệ thống:</strong>
<pre><code class="language-bash">sudo systemctl start nginx
sudo systemctl enable nginx</code></pre></li>
<li><strong>Kiểm tra trạng thái:</strong>
<pre><code class="language-bash">sudo systemctl status nginx</code></pre></li>
</ul>
<p><em>Mẹo: Mở trình duyệt và truy cập vào IP của máy chủ. Nếu thấy trang "Welcome to nginx!", bạn đã cài thành công!</em></p>

<hr>

<h2>Bước 3: Cài đặt Hệ quản trị Cơ sở dữ liệu (MySQL / MariaDB)</h2>
<p>Bạn có thể chọn MySQL hoặc MariaDB. Trong hướng dẫn này, chúng ta sử dụng MariaDB vì nó nhẹ, nhanh và hoàn toàn mã nguồn mở.</p>
<ul>
<li><strong>Cài đặt MariaDB:</strong>
<pre><code class="language-bash">sudo apt install mariadb-server mariadb-client -y</code></pre></li>
<li><strong>Khởi động MariaDB:</strong>
<pre><code class="language-bash">sudo systemctl start mariadb
sudo systemctl enable mariadb</code></pre></li>
<li><strong>Bảo mật cho Database (RẤT QUAN TRỌNG):</strong>
<pre><code class="language-bash">sudo mysql_secure_installation</code></pre>
<p>Hệ thống sẽ hỏi bạn một số câu hỏi, hãy làm theo hướng dẫn sau:</p>
<ul>
<li><em>Enter current password for root (enter for none):</em> <strong>Nhấn Enter</strong>.</li>
<li><em>Switch to unix_socket authentication [Y/n]:</em> <strong>n</strong></li>
<li><em>Change the root password? [Y/n]:</em> <strong>Y</strong> (Nhập mật khẩu mới bảo mật của bạn).</li>
<li><em>Remove anonymous users? [Y/n]:</em> <strong>Y</strong></li>
<li><em>Disallow root login remotely? [Y/n]:</em> <strong>Y</strong></li>
<li><em>Remove test database and access to it? [Y/n]:</em> <strong>Y</strong></li>
<li><em>Reload privilege tables now? [Y/n]:</em> <strong>Y</strong></li>
</ul>
</li>
</ul>

<hr>

<h2>Bước 4: Cài đặt ngôn ngữ kịch bản (PHP-FPM)</h2>
<p>Khác với Apache, Nginx không có sẵn module để xử lý trực tiếp PHP. Thay vào đó, Nginx sử dụng <strong>PHP-FPM</strong> (FastCGI Process Manager) làm cầu nối để xử lý code PHP.</p>
<ul>
<li><strong>Chạy lệnh cài đặt PHP-FPM và PHP-MySQL:</strong>
<pre><code class="language-bash">sudo apt install php-fpm php-mysql -y</code></pre></li>
<li><strong>Kiểm tra xem PHP-FPM đã chạy chưa:</strong>
<pre><code class="language-bash">sudo systemctl status php8.1-fpm</code></pre>
<em>Lưu ý: Tùy phiên bản Ubuntu mà tên service có thể là <code>php7.4-fpm</code>, <code>php8.1-fpm</code> hoặc <code>php8.2-fpm</code>.</em></li>
<li><strong>(Tùy chọn) Cài thêm các extension PHP thông dụng (Cần cho WordPress):</strong>
<pre><code class="language-bash">sudo apt install php-curl php-gd php-mbstring php-xml php-xmlrpc php-soap php-intl php-zip -y</code></pre></li>
</ul>

<hr>

<h2>Bước 5: Cấu hình Nginx để chạy PHP</h2>
<p>Chúng ta cần phải chỉ cho Nginx biết cách chuyển các file <code>.php</code> qua cho PHP-FPM xử lý.</p>
<ol>
<li><strong>Mở file cấu hình mặc định của Nginx:</strong>
<pre><code class="language-bash">sudo nano /etc/nginx/sites-available/default</code></pre></li>
<li><strong>Tìm khối <code>server { ... }</code> và chỉnh sửa để nó trông giống như sau (chú ý phần thêm <code>index.php</code> và bỏ comment phần <code>location ~ \.php$</code>):</strong>
<pre><code class="language-nginx">server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    
    # Thêm index.php vào đây
    index index.php index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files $uri $uri/ =404;
    }

    # Bỏ comment phần xử lý PHP này
    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        
        # Sửa phiên bản php-fpm cho đúng với bản bạn vừa cài (ví dụ 8.1)
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }

    location ~ /\\.ht {
        deny all;
    }
}</code></pre>
<em>Lưu lại file (Nhấn Ctrl+O, Enter, rồi Ctrl+X để thoát ra).</em></li>
<li><strong>Kiểm tra lỗi cú pháp cấu hình Nginx:</strong>
<pre><code class="language-bash">sudo nginx -t</code></pre>
<em>Nếu báo <code>syntax is ok</code> và <code>test is successful</code> thì bạn đã làm đúng.</em></li>
<li><strong>Khởi động lại Nginx:</strong>
<pre><code class="language-bash">sudo systemctl reload nginx</code></pre></li>
</ol>

<hr>

<h2>Bước 6: Kiểm tra toàn bộ hệ thống LEMP</h2>
<p>Tương tự như cài LAMP, ta tạo file <code>info.php</code> để test xem Nginx và PHP đã nói chuyện được với nhau chưa.</p>
<ol>
<li><strong>Tạo file info.php trong thư mục root:</strong>
<pre><code class="language-bash">sudo nano /var/www/html/info.php</code></pre></li>
<li><strong>Dán nội dung sau vào file:</strong>
<pre><code class="language-php">&lt;?php
phpinfo();
?&gt;</code></pre></li>
<li><strong>Truy cập vào trình duyệt:</strong>
<p>Gõ: <code>http://IP_CUA_MAY_CHU/info.php</code></p>
<p>Nếu trang cấu hình PHP hiện ra và ở dòng <strong>Server API</strong> ghi là <strong>FPM/FastCGI</strong>, chúc mừng bạn đã cấu hình thành công!</p>
</li>
<li><strong>Xóa file info.php để bảo mật:</strong>
<pre><code class="language-bash">sudo rm /var/www/html/info.php</code></pre></li>
</ol>

<hr>

<h2>Tóm tắt</h2>
<p>Bạn đã hoàn tất việc setup một máy chủ <strong>LEMP (Nginx)</strong> siêu tốc độ. Đây là nền tảng hoàn hảo nhất để tối ưu hóa thời gian tải trang cho các nền tảng như WordPress hoặc các Framework PHP hiện đại (Laravel, Symfony).</p>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const result = await Post.updateMany(
      { title: "Hướng dẫn cài đặt máy chủ web LAMP (Linux, Apache, MySQL, PHP) từ A-Z" },
      { 
        $set: { 
          title: "Hướng dẫn cài đặt máy chủ web LEMP (Linux, Nginx, MySQL, PHP) từ A-Z",
          content: htmlContent,
          excerpt: "Hướng dẫn chi tiết từng bước cách cài đặt LEMP stack siêu tốc độ trên máy chủ Ubuntu/Debian bao gồm Nginx, MariaDB, và PHP-FPM."
        } 
      }
    );
    
    console.log("Update result:", result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
