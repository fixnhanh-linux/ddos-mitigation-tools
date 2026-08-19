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
<p>Khi quản trị máy chủ Linux (VPS/Dedicated Server), việc kiểm tra tốc độ mạng thực tế (Upload/Download) là cực kỳ quan trọng để đảm bảo máy chủ hoạt động ổn định. Một trong những công cụ phổ biến và chính xác nhất là <strong>Speedtest-cli</strong> (phiên bản dòng lệnh của trang web Speedtest.net nổi tiếng).</p>

<p>Bài viết này sẽ hướng dẫn bạn từ A-Z cách cài đặt và sử dụng Speedtest-cli trên Linux.</p>

<hr>

<h2>Bước 1: Cài đặt Speedtest-cli</h2>
<p>Có 2 cách phổ biến để cài đặt Speedtest-cli. Cách 1 là cài phiên bản chính thức từ Ookla (khuyên dùng vì chính xác nhất), và Cách 2 là cài qua Python.</p>

<h3>Cách 1: Cài đặt phiên bản chính thức của Ookla (Khuyên dùng)</h3>
<p><strong>Trên Ubuntu/Debian:</strong></p>
<pre><code class="language-bash">sudo apt-get update
sudo apt-get install curl -y
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | sudo bash
sudo apt-get install speedtest -y</code></pre>

<p><strong>Trên CentOS/RHEL/AlmaLinux:</strong></p>
<pre><code class="language-bash">sudo yum install curl -y
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.rpm.sh | sudo bash
sudo yum install speedtest -y</code></pre>

<h3>Cách 2: Cài đặt qua thư viện Python (pip)</h3>
<p>Nếu server của bạn không cài được bằng cách trên, bạn có thể cài thông qua Python.</p>
<pre><code class="language-bash">sudo apt install python3-pip -y  # Cài pip cho Ubuntu
sudo pip3 install speedtest-cli</code></pre>

<hr>

<h2>Bước 2: Sử dụng Speedtest cơ bản</h2>
<p>Sau khi cài đặt xong, bạn chỉ cần gõ lệnh sau vào Terminal để bắt đầu test tốc độ:</p>
<pre><code class="language-bash">speedtest</code></pre>
<p><em>Nếu là lần đầu tiên chạy, ứng dụng sẽ yêu cầu bạn xác nhận các điều khoản (Type <strong>YES</strong> và nhấn Enter).</em></p>
<p>Kết quả trả về sẽ hiển thị đầy đủ:</p>
<ul>
<li><strong>Latency (Ping) & Jitter:</strong> Độ trễ mạng (càng thấp càng tốt).</li>
<li><strong>Download:</strong> Tốc độ tải xuống (thường tính bằng Mbps).</li>
<li><strong>Upload:</strong> Tốc độ tải lên (thường tính bằng Mbps).</li>
<li><strong>Packet Loss:</strong> Tỉ lệ mất gói tin (lý tưởng nhất là 0%).</li>
</ul>

<hr>

<h2>Bước 3: Các lệnh nâng cao cực kỳ hữu ích</h2>

<h3>1. Tạo link hình ảnh kết quả để chia sẻ</h3>
<p>Bạn muốn gửi bằng chứng tốc độ mạng cho nhà cung cấp VPS? Hãy thêm cờ <code>--share</code> (nếu cài bản Python) hoặc dùng bản Ookla nó sẽ tự cấp link URL kết quả dạng hình ảnh.</p>
<pre><code class="language-bash">speedtest-cli --share</code></pre>
<p><em>Kết quả sẽ trả về một đường link ảnh PNG chứa thông số tốc độ của bạn.</em></p>

<h3>2. Hiển thị kết quả đơn giản (chỉ lấy số liệu)</h3>
<p>Nếu bạn chỉ muốn xem tốc độ mà không cần các thông tin rườm rà về server test hay IP:</p>
<pre><code class="language-bash">speedtest-cli --simple</code></pre>

<h3>3. Chọn Server test cụ thể</h3>
<p>Mặc định Speedtest sẽ tự động chọn server gần bạn nhất. Tuy nhiên, nếu bạn mua VPS ở Mỹ nhưng muốn test tốc độ truyền tải về Việt Nam, bạn làm như sau:</p>
<p>Đầu tiên, liệt kê danh sách các server gần IP (hoặc tìm kiếm):</p>
<pre><code class="language-bash">speedtest-cli --list | grep "Vietnam"</code></pre>
<p>Bạn sẽ thấy danh sách dạng: <code>2452) Viettel Network (Hanoi, Vietnam) [8500.23 km]</code>. Ghi nhớ <strong>ID</strong> của server (ví dụ 2452). Sau đó chạy lệnh test với server đó:</p>
<pre><code class="language-bash">speedtest-cli --server 2452</code></pre>

<hr>

<h2>Tóm tắt</h2>
<p><strong>Speedtest-cli</strong> là một công cụ không thể thiếu đối với bất kỳ System Admin nào. Chỉ với vài dòng lệnh đơn giản, bạn đã có thể chẩn đoán chính xác băng thông thực tế (throughput) mà máy chủ của mình đang có, từ đó đưa ra các quyết định nâng cấp hoặc phàn nàn với nhà cung cấp dịch vụ hợp lý.</p>
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
      title: "Hướng dẫn kiểm tra băng thông trên Linux bằng Speedtest-cli từ A-Z",
      slug: "huong-dan-kiem-tra-bang-thong-tren-linux-bang-speedtest-cli-tu-a-z-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn chi tiết cách kiểm tra tốc độ mạng Upload/Download trên VPS/Server Linux bằng công cụ dòng lệnh Speedtest-cli.",
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
