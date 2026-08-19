const mongoose = require('mongoose');
const fs = require('fs');

// Read MONGODB_URI from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const mongoUriMatch = envContent.match(/MONGODB_URI=(.*)/);
if (!mongoUriMatch) {
  console.error("MONGODB_URI not found in .env.local");
  process.exit(1);
}
const MONGODB_URI = mongoUriMatch[1].trim();

const PostSchema = new mongoose.Schema({
  title: String,
  slug: String,
  excerpt: String,
  content: String,
  coverImage: String,
  published: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  
  const content = `
<h2>Giới thiệu về Fail2ban</h2>
<p>Fail2ban là một công cụ phần mềm miễn phí và mã nguồn mở được thiết kế để ngăn chặn các cuộc tấn công Brute Force vào máy chủ của bạn. Nó hoạt động bằng cách quét các tệp nhật ký (log files) và cấm các địa chỉ IP có quá nhiều lần đăng nhập thất bại.</p>

<img src="https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&q=80&w=1200" alt="Server Security" />

<h2>Cài đặt Fail2ban trên Ubuntu</h2>
<p>Để cài đặt Fail2ban trên Ubuntu hoặc Debian, bạn chỉ cần chạy lệnh sau trong Terminal:</p>

<pre><code class="language-bash">sudo apt update
sudo apt install fail2ban -y</code></pre>

<h2>Cấu hình cơ bản</h2>
<p>Sau khi cài đặt, bạn nên tạo một bản sao của file cấu hình mặc định để tránh bị ghi đè khi nâng cấp phần mềm:</p>

<pre><code class="language-bash">sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local</code></pre>

<p>Bây giờ, hãy mở file <code>jail.local</code> bằng Nano hoặc Vim để chỉnh sửa:</p>

<pre><code class="language-bash">sudo nano /etc/fail2ban/jail.local</code></pre>

<p>Dưới đây là một ví dụ về cấu hình bảo vệ SSH cơ bản. Hãy tìm block <code>[sshd]</code> và cập nhật như sau:</p>

<pre><code class="language-ini">[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600</code></pre>

<h2>Khởi động lại dịch vụ</h2>
<p>Sau khi đã lưu cấu hình, bạn cần khởi động lại Fail2ban để áp dụng thay đổi:</p>

<pre><code class="language-bash">sudo systemctl restart fail2ban
sudo systemctl enable fail2ban</code></pre>

<img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1200" alt="Terminal Command" />

<h2>Kiểm tra trạng thái</h2>
<p>Để kiểm tra xem Fail2ban có đang hoạt động và bảo vệ SSH hay không, hãy dùng lệnh:</p>

<pre><code class="language-bash">sudo fail2ban-client status sshd</code></pre>

<p>Hệ thống sẽ trả về số lượng IP đang bị cấm và danh sách chi tiết các IP đó. Chúc các bạn bảo mật máy chủ thành công!</p>
  `;

  await Post.deleteOne({ slug: "huong-dan-cai-dat-cau-hinh-fail2ban" });

  await Post.create({
    title: "Hướng dẫn cài đặt và cấu hình Fail2ban bảo vệ Server Linux",
    slug: "huong-dan-cai-dat-cau-hinh-fail2ban",
    excerpt: "Tìm hiểu cách cài đặt và cấu hình Fail2ban trên Ubuntu/Debian để bảo vệ máy chủ Linux của bạn khỏi các cuộc tấn công Brute Force.",
    content: content,
    coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200",
    published: true,
  });

  console.log("Thêm bài viết Fail2ban thành công!");
  process.exit(0);
}
run();
