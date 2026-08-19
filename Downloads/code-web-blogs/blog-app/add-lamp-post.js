const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const htmlContent = `
<p>LAMP Stack là chữ viết tắt của <strong>L</strong>inux, <strong>A</strong>pache, <strong>M</strong>ySQL/MariaDB và <strong>P</strong>HP. Đây là bộ phần mềm nền tảng phổ biến nhất thế giới để chạy các website động (đặc biệt là WordPress). Bài viết này sẽ hướng dẫn bạn cài đặt LAMP Stack từ A-Z trên hệ điều hành <strong>Ubuntu/Debian</strong>.</p>

<hr>

<h2>Bước 1: Cập nhật hệ thống (Linux)</h2>
<p>Trước khi cài đặt bất kỳ phần mềm nào, luôn luôn đảm bảo hệ điều hành của bạn đang ở trạng thái mới nhất.</p>
<pre><code class="language-bash">sudo apt update
sudo apt upgrade -y</code></pre>

<hr>

<h2>Bước 2: Cài đặt Web Server (Apache)</h2>
<p>Apache là phần mềm máy chủ web giúp xử lý các request HTTP và hiển thị trang web ra trình duyệt.</p>
<ul>
<li><strong>Chạy lệnh cài đặt Apache:</strong>
<pre><code class="language-bash">sudo apt install apache2 -y</code></pre></li>
<li><strong>Khởi động và bật Apache chạy ngầm cùng hệ thống:</strong>
<pre><code class="language-bash">sudo systemctl start apache2
sudo systemctl enable apache2</code></pre></li>
<li><strong>Kiểm tra trạng thái:</strong>
<pre><code class="language-bash">sudo systemctl status apache2</code></pre></li>
</ul>
<p><em>Mẹo: Mở trình duyệt và truy cập vào IP của máy chủ. Nếu thấy trang "Apache2 Ubuntu Default Page", bạn đã cài thành công!</em></p>

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

<h2>Bước 4: Cài đặt ngôn ngữ kịch bản (PHP)</h2>
<p>Để Apache có thể xử lý được mã nguồn PHP (ví dụ như WordPress), chúng ta cần cài đặt PHP và các module kết nối với Apache, MySQL.</p>
<ul>
<li><strong>Chạy lệnh cài đặt PHP (bản mặc định):</strong>
<pre><code class="language-bash">sudo apt install php libapache2-mod-php php-mysql -y</code></pre></li>
<li><strong>(Tùy chọn) Cài thêm các extension PHP thông dụng cho Web (Rất cần cho WordPress):</strong>
<pre><code class="language-bash">sudo apt install php-curl php-gd php-mbstring php-xml php-xmlrpc php-soap php-intl php-zip -y</code></pre></li>
<li><strong>Khởi động lại Apache để nhận cấu hình PHP:</strong>
<pre><code class="language-bash">sudo systemctl restart apache2</code></pre></li>
<li><strong>Kiểm tra phiên bản PHP:</strong>
<pre><code class="language-bash">php -v</code></pre></li>
</ul>

<hr>

<h2>Bước 5: Kiểm tra toàn bộ hệ thống LAMP</h2>
<p>Để chắc chắn Apache đã nhận diện được PHP, chúng ta sẽ tạo một file <code>info.php</code> để test.</p>
<ol>
<li><strong>Tạo file info.php trong thư mục root của web:</strong>
<pre><code class="language-bash">sudo nano /var/www/html/info.php</code></pre></li>
<li><strong>Dán nội dung sau vào file:</strong>
<pre><code class="language-php">&lt;?php
phpinfo();
?&gt;</code></pre>
<em>Lưu lại file (Nhấn Ctrl+O, Enter, rồi Ctrl+X để thoát ra).</em></li>
<li><strong>Truy cập vào trình duyệt:</strong>
<p>Mở trình duyệt và gõ: <code>http://IP_CUA_MAY_CHU/info.php</code></p>
<p>Nếu hiển thị một trang thông tin dài liệt kê các cấu hình PHP màu tím/xám, chúc mừng bạn! Bạn đã cài đặt LAMP thành công.</p>
</li>
<li><strong>Xóa file info.php để bảo mật:</strong>
<pre><code class="language-bash">sudo rm /var/www/html/info.php</code></pre></li>
</ol>

<hr>

<h2>Tóm tắt</h2>
<p>Bạn đã hoàn tất việc setup một môi trường web server LAMP mạnh mẽ. Tiếp theo, bạn có thể cấu hình Virtual Host của Apache để chạy nhiều domain, hoặc tải mã nguồn WordPress lên thư mục <code>/var/www/html</code> để bắt đầu xây dựng website cho riêng mình!</p>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    let user = await User.findOne({});
    let authorId;
    if (user) {
      authorId = user._id;
    } else {
      console.log("No user found. Creating dummy user...");
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    const post = new Post({
      title: "Hướng dẫn cài đặt máy chủ web LAMP (Linux, Apache, MySQL, PHP) từ A-Z",
      slug: "huong-dan-cai-dat-may-chu-web-lamp-linux-apache-mysql-php-tu-a-z-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn chi tiết từng bước cách cài đặt LAMP stack chuẩn trên máy chủ Ubuntu/Debian bao gồm Apache, MariaDB, và PHP.",
      author: authorId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("Post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
