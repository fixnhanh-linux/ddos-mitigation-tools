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
<p><strong>ntopng</strong> (phiên bản nâng cấp của ntop) là một công cụ giám sát lưu lượng mạng mã nguồn mở cực kỳ mạnh mẽ. Nó hoạt động giống như lệnh <code>top</code> của Linux nhưng dành riêng cho Network, cung cấp một giao diện Web trực quan để bạn xem ai đang ngốn băng thông, các kết nối mạng nào đang diễn ra, và phát hiện các điểm nghẽn mạng theo thời gian thực.</p>
<p>Bài viết này sẽ hướng dẫn bạn cài đặt và sử dụng <strong>ntopng</strong> từ A-Z trên máy chủ Linux (Ubuntu/CentOS).</p>

<hr>

<h2>Bước 1: Cài đặt ntopng</h2>

<h3>Trên Ubuntu/Debian</h3>
<p>Bạn không nên cài trực tiếp từ kho mặc định vì nó thường rất cũ. Hãy thêm kho (repository) chính thức của ntop:</p>
<pre><code class="language-bash"># Tải gói cài đặt kho ntop
sudo apt update
sudo apt install wget software-properties-common -y
wget https://packages.ntop.org/apt/22.04/all/apt-ntop.deb
sudo apt install ./apt-ntop.deb -y

# Cài đặt ntopng và các gói phụ thuộc
sudo apt update
sudo apt install pfring-dkms nprobe ntopng n2disk cento -y</code></pre>

<h3>Trên CentOS/RHEL/AlmaLinux</h3>
<pre><code class="language-bash"># Cài đặt EPEL repository
sudo yum install epel-release -y

# Tải gói kho ntop
wget https://packages.ntop.org/centos/ntop.repo -O /etc/yum.repos.d/ntop.repo

# Cài đặt ntopng
sudo yum clean all
sudo yum install pfring nprobe ntopng n2disk cento -y</code></pre>

<hr>

<h2>Bước 2: Cấu hình ntopng cơ bản</h2>
<p>Sau khi cài đặt, bạn cần thiết lập card mạng nào mà ntopng sẽ lắng nghe và port web.</p>
<ol>
<li>Mở file cấu hình chính:
<pre><code class="language-bash">sudo nano /etc/ntopng/ntopng.conf</code></pre></li>
<li>Chỉnh sửa hoặc thêm các dòng sau:
<pre><code class="language-bash"># Chạy ntopng dưới dạng service ngầm (daemon)
-G=/var/run/ntopng.pid

# Giao diện mạng cần giám sát (thay eth0 bằng tên card mạng của bạn, dùng lệnh 'ip a' để xem)
-i=eth0

# Port để truy cập giao diện Web (Mặc định là 3000)
-w=3000

# Khai báo dải mạng nội bộ (Local Network) để ntopng dễ phân biệt
-m=192.168.1.0/24,10.0.0.0/8</code></pre>
<em>Lưu file lại (Ctrl+O, Enter, Ctrl+X).</em></li>
</ol>

<hr>

<h2>Bước 3: Khởi động và truy cập ntopng</h2>
<ol>
<li>Bật khởi động cùng hệ thống và chạy ntopng:
<pre><code class="language-bash">sudo systemctl start ntopng
sudo systemctl enable ntopng</code></pre></li>
<li>Kiểm tra trạng thái xem nó có đang chạy không:
<pre><code class="language-bash">sudo systemctl status ntopng</code></pre></li>
<li>Mở port trên tường lửa (Nếu bạn dùng UFW):
<pre><code class="language-bash">sudo ufw allow 3000/tcp</code></pre></li>
<li><strong>Đăng nhập vào giao diện Web:</strong>
<p>Mở trình duyệt và truy cập: <code>http://IP_CUA_MAY_CHU:3000</code></p>
<p>Tài khoản mặc định: <strong>admin</strong> / Mật khẩu: <strong>admin</strong></p>
<p><em>(Ngay sau khi đăng nhập lần đầu, hệ thống sẽ bắt buộc bạn đổi mật khẩu mới).</em></p>
</li>
</ol>

<hr>

<h2>Bước 4: Hướng dẫn sử dụng ntopng hiệu quả</h2>
<p>Giao diện của ntopng cung cấp vô số biểu đồ và số liệu. Dưới đây là những tính năng quan trọng nhất bạn cần quan tâm:</p>

<h3>1. Dashboard (Bảng điều khiển chung)</h3>
<p>Cung cấp cái nhìn tổng quan về trạng thái mạng: Băng thông đang dùng, Top Hosts (Các máy tính/IP đang ngốn nhiều băng thông nhất), Top Application (Ứng dụng nào đang chạy nhiều: YouTube, Facebook, SSH, HTTP...).</p>

<h3>2. Hosts (Theo dõi từng IP cụ thể)</h3>
<p>Vào menu <strong>Hosts</strong> &gt; <strong>Local</strong> hoặc <strong>Remote</strong>. Ở đây liệt kê mọi IP đã hoặc đang kết nối vào server của bạn. Bạn click vào một IP bất kỳ, ntopng sẽ show ra chi tiết IP đó đang kết nối đi đâu, dùng giao thức gì, tốc độ bao nhiêu, thậm chí hệ điều hành IP đó đang dùng.</p>

<h3>3. Flows (Luồng dữ liệu)</h3>
<p>Vào menu <strong>Flows</strong>. Tính năng này giống hệt <code>netstat</code> nhưng ở dạng đồ họa. Nó cho biết chi tiết từng connection (từ Source IP nào tới Dest IP nào, Port nào, thời gian tồn tại). Rất hữu ích khi bạn đang bị nghi ngờ tấn công DDoS hoặc muốn tìm tiến trình lạ.</p>

<h3>4. Cảnh báo (Alerts)</h3>
<p>ntopng tự động phân tích và đưa ra cảnh báo ở hình cái chuông góc trên cùng. Ví dụ: Nếu nó phát hiện ai đó đang cố dò mật khẩu SSH (Brute-force) hoặc một máy trạm bị nhiễm mã độc đang scan mạng, nó sẽ cảnh báo ngay cho bạn.</p>

<hr>

<h2>Tóm tắt</h2>
<p><strong>ntopng</strong> không chỉ là một công cụ đo băng thông, nó là hệ thống <strong>Giám sát An ninh Mạng (NDR)</strong> thực thụ cho Linux. Với việc hiển thị trực quan lớp Application (Layer 7), bạn sẽ không còn phải mù mờ về việc <em>"Tại sao mạng dạo này chậm thế?"</em> hay <em>"Phần mềm nào đang ngốn CPU mạng?"</em> nữa.</p>
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
      title: "Hướng dẫn giám sát lưu lượng mạng bằng ntopng trên Linux từ A-Z",
      slug: "huong-dan-giam-sat-luu-luong-mang-bang-ntopng-tren-linux-tu-a-z-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn chi tiết từ A-Z cách cài đặt và sử dụng ntopng - công cụ giám sát băng thông, luồng mạng (network flows) giao diện Web trực quan số 1 cho Linux.",
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
