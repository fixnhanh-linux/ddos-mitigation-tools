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
<p><strong>DDoS (Distributed Denial of Service)</strong> là hình thức tấn công mạng nhằm làm sập máy chủ bằng cách gửi một lượng lớn traffic giả mạo, vắt kiệt tài nguyên (CPU, RAM, Băng thông). Chống DDoS là một cuộc chiến dài hạn, không có giải pháp nào là tuyệt đối 100%, nhưng nếu áp dụng các lớp phòng thủ từ A-Z dưới đây, bạn sẽ chặn được 99% các cuộc tấn công DDoS quy mô vừa và nhỏ vào máy chủ Linux.</p>

<hr>

<h2>Lớp 1: Tối ưu hóa Kernel Linux (sysctl.conf)</h2>
<p>Lớp phòng thủ đầu tiên nằm ở chính nhân (Kernel) của hệ điều hành. Kẻ tấn công thường sử dụng phương thức <strong>SYN Flood</strong>. Ta có thể bật SYN Cookies và giới hạn các kết nối để giảm tải.</p>
<ol>
<li>Mở file cấu hình Kernel:
<pre><code class="language-bash">sudo nano /etc/sysctl.conf</code></pre></li>
<li>Dán các dòng sau vào cuối file để chống SYN Flood và IP Spoofing:
<pre><code class="language-bash"># Bật SYN Cookies
net.ipv4.tcp_syncookies = 1

# Tăng kích thước hàng đợi backlog
net.ipv4.tcp_max_syn_backlog = 2048

# Giảm thời gian chờ kết nối (timeout)
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Bật bảo vệ IP Spoofing (Giả mạo IP)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Bỏ qua ICMP (Chống Ping of Death)
net.ipv4.icmp_echo_ignore_all = 1
</code></pre></li>
<li>Áp dụng cấu hình ngay lập tức:
<pre><code class="language-bash">sudo sysctl -p</code></pre></li>
</ol>

<hr>

<h2>Lớp 2: Sử dụng Tường lửa (Firewall)</h2>
<p>Sử dụng <strong>UFW</strong> (Uncomplicated Firewall) hoặc <strong>iptables</strong> để giới hạn số lượng kết nối đồng thời từ 1 địa chỉ IP.</p>

<h3>1. Bật UFW Limit (Dành cho Ubuntu)</h3>
<p>Lệnh <code>limit</code> của UFW sẽ tự động block một IP nếu nó gửi quá 6 request trong vòng 30 giây (Rất tốt cho SSH và HTTP).</p>
<pre><code class="language-bash">sudo ufw limit 80/tcp
sudo ufw limit 443/tcp
sudo ufw limit 22/tcp
sudo ufw reload</code></pre>

<h3>2. Cài đặt Fail2Ban</h3>
<p><strong>Fail2Ban</strong> là công cụ tuyệt vời đọc log server và tự động ban IP nếu phát hiện hành vi spam request hoặc scan password.</p>
<pre><code class="language-bash">sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban</code></pre>

<hr>

<h2>Lớp 3: Cấu hình Web Server (Nginx / Apache)</h2>

<h3>Nếu bạn dùng Nginx (Khuyên dùng chống DDoS)</h3>
<p>Nginx có sẵn tính năng <strong>Rate Limiting</strong> rất mạnh mẽ để chống HTTP Flood (Layer 7 DDoS).</p>
<ol>
<li>Mở file cấu hình Nginx (<code>/etc/nginx/nginx.conf</code>).</li>
<li>Thêm dòng này vào trong block <code>http { ... }</code>:
<pre><code class="language-nginx">limit_req_zone $binary_remote_addr zone=one:10m rate=5r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;</code></pre>
<em>(Ý nghĩa: Mỗi IP chỉ được phép gửi 5 request/giây).</em></li>
<li>Mở file cấu hình domain của bạn (<code>/etc/nginx/sites-available/default</code>), trong block <code>server { ... }</code> thêm vào:
<pre><code class="language-nginx">limit_req zone=one burst=10 nodelay;
limit_conn addr 20;</code></pre>
<em>(Ý nghĩa: Cho phép burst thêm tối đa 10 request, 1 IP chỉ được tạo tối đa 20 kết nối đồng thời).</em></li>
<li>Restart lại Nginx: <code>sudo systemctl restart nginx</code>.</li>
</ol>

<h3>Nếu bạn dùng Apache</h3>
<p>Hãy cài đặt module <strong>mod_evasive</strong> để tự động drop các IP spam:</p>
<pre><code class="language-bash">sudo apt install libapache2-mod-evasive -y
sudo systemctl restart apache2</code></pre>

<hr>

<h2>Lớp 4: Vũ khí tối thượng - Sử dụng Cloudflare</h2>
<p>Dù bạn cấu hình Server tốt đến đâu, nếu kẻ tấn công bắn 10Gbps - 100Gbps traffic vào VPS của bạn thì mạng tại Data Center cũng sẽ sập trước khi tới máy chủ. <strong>Cách chống DDoS triệt để nhất là giấu IP thật của máy chủ đằng sau Cloudflare (CDN)</strong>.</p>
<ol>
<li>Tạo tài khoản tại <a href="https://dash.cloudflare.com" target="_blank">Cloudflare.com</a> (Hoàn toàn miễn phí).</li>
<li>Thêm Domain của bạn vào Cloudflare và đổi <strong>Nameservers</strong> ở nơi mua tên miền về Cloudflare.</li>
<li>Bật biểu tượng đám mây màu cam (Proxied) cho bản ghi A của bạn.</li>
<li>Trong trường hợp đang bị tấn công dữ dội: Vào mục <strong>Security</strong> &gt; <strong>Settings</strong> &gt; Chuyển <strong>Security Level</strong> sang <strong>I'm Under Attack!</strong>.
<p><em>(Lúc này toàn bộ người dùng sẽ phải chờ 5 giây để Cloudflare verify xem họ là người thật hay là bot net).</em></p></li>
</ol>

<hr>

<h2>Tóm tắt chiến lược</h2>
<p>Việc chống DDoS là sự kết hợp của <strong>Cloudflare (Lọc traffic bẩn băng thông lớn)</strong> + <strong>Nginx Rate Limit (Chống spam request)</strong> + <strong>Fail2ban/UFW (Ban IP độc hại)</strong>. Nếu làm chuẩn cả 4 lớp này, website của bạn sẽ gần như "bất tử" trước các đợt tấn công DDoS thông thường.</p>
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
      title: "Hướng dẫn toàn tập cách phòng chống DDoS cho máy chủ Linux từ A-Z",
      slug: "huong-dan-toan-tap-cach-phong-chong-ddos-cho-may-chu-linux-tu-a-z-" + Date.now(),
      content: htmlContent,
      excerpt: "Bí kíp chống DDoS từ A-Z cho máy chủ Linux: Từ tối ưu Kernel, cấu hình Nginx Rate Limit, UFW/Fail2Ban cho đến Cloudflare CDN.",
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
