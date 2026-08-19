const mongoose = require("mongoose");
const { marked } = require("marked");

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

const markdownContent = `
# Hướng dẫn kiểm tra và xử lý tấn công DDoS / Spam trên Nginx và Apache

Tấn công từ chối dịch vụ (DDoS) hoặc tình trạng Spam requests (như Botnet rà quét lỗ hổng, spam bình luận) là ác mộng với mọi máy chủ web. Khi điều này xảy ra, Nginx hoặc Apache sẽ bị quá tải kết nối, CPU vọt lên 100% và website "chết lâm sàng".

Làm sao để biết chắc chắn bạn đang bị tấn công, và ai đang tấn công bạn? Bài viết này sẽ cung cấp cho bạn bộ công cụ dòng lệnh (CLI) lợi hại nhất trên Linux.

---

## 1. Kiểm tra trạng thái các kết nối mạng bằng lệnh \`netstat\`

\`netstat\` là công cụ kinh điển để xem có bao nhiêu kết nối đang chĩa vào server của bạn. 

Truy cập SSH bằng quyền root và gõ lệnh sau để xem tổng số lượng kết nối đang mở ở cổng 80 (HTTP) và 443 (HTTPS):
\`\`\`bash
netstat -an | grep ':80\\|:443' | wc -l
\`\`\`
*(Nếu con số trả về lên đến vài ngàn kết nối đối với một web nhỏ, chắc chắn 99% bạn đang bị DDoS).*

**Kiểm tra số lượng kết nối theo trạng thái (SYN_RECV, ESTABLISHED):**
\`\`\`bash
netstat -an | awk '/tcp/ {print $6}' | sort | uniq -c | sort -nr
\`\`\`
- \`ESTABLISHED\`: Kết nối đang hoạt động.
- \`SYN_RECV\`: Nếu con số này quá cao, bạn đang bị tấn công **SYN Flood** (Hacker gửi yêu cầu kết nối nhưng không thèm nhận phản hồi, làm treo máy chủ).

## 2. Truy tìm các IP đang tấn công (Spam nhiều nhất)

Để "bắt tận tay" những IP nào đang tạo ra hàng chục, hàng trăm kết nối cùng lúc đến server của bạn, hãy dùng lệnh sau:

**Liệt kê Top 10 IP đang kết nối nhiều nhất:**
\`\`\`bash
netstat -ntu | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -nr | head -n 10
\`\`\`
*Kết quả sẽ hiển thị dạng: \` 500 123.45.67.89\`. Điều này có nghĩa là IP \`123.45.67.89\` đang mở tới 500 kết nối cùng lúc.*

## 3. Tìm kiếm trong Access Log của Nginx / Apache

Nhiều loại tấn công (như HTTP Flood / XML-RPC attack) sẽ được ghi lại trong file log. 
Đường dẫn file log thường là:
- Nginx: \`/var/log/nginx/access.log\`
- Apache: \`/var/log/httpd/access_log\` hoặc \`/var/log/apache2/access.log\`

**Đếm Top 10 IP truy cập nhiều nhất hôm nay trong file log:**
\`\`\`bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -n 10
\`\`\`

**Tìm xem IP đó đang spam vào đường dẫn (URL) nào:**
Giả sử bạn thấy IP \`111.222.111.222\` rất khả nghi, hãy xem nó đang làm gì:
\`\`\`bash
grep "111.222.111.222" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr
\`\`\`
*Nếu bạn thấy nó liên tục POST vào \`/xmlrpc.php\` hoặc \`/wp-login.php\`, rõ ràng đó là một con bot đang cố dò mật khẩu (Brute-force).*

## 4. Cách xử lý và chặn IP ngay lập tức

Khi đã có danh sách các IP đen, hãy chặn chúng từ cấp độ Tường lửa (Firewall) thay vì cấu hình trong Nginx/Apache.

### Cách 1: Chặn IP bằng Iptables
\`\`\`bash
iptables -A INPUT -s 123.45.67.89 -j DROP
\`\`\`

### Cách 2: Chặn IP bằng UFW (Trên Ubuntu)
\`\`\`bash
ufw deny from 123.45.67.89
\`\`\`

### Cách 3: Chặn bằng CSF (ConfigServer Security & Firewall) - Khuyên dùng!
Nếu dùng DirectAdmin/cPanel, bạn nên cài đặt CSF. Lệnh chặn vô cùng đơn giản:
\`\`\`bash
csf -d 123.45.67.89 "Chặn IP tan cong DDoS"
\`\`\`

## 5. Giải pháp lâu dài: Đưa website vào "Vùng an toàn"

Chặn thủ công từng IP chỉ là giải pháp tạm thời vì Hacker có thể dùng Mạng máy tính ma (Botnet) với hàng vạn IP khác nhau. Để chống lại DDoS HTTP Flood thực sự:

1. **Sử dụng Cloudflare:** Đổi DNS về Cloudflare, bật tính năng **Under Attack Mode**. Nó sẽ kích hoạt màn hình check "I am human" trước khi cho bất cứ ai vào web.
2. **Cài đặt Fail2Ban:** Đây là một công cụ phân tích log tự động. Bạn có thể cấu hình: "Nếu 1 IP gõ sai mật khẩu wp-login 5 lần, tự động khóa IP đó trong 24 giờ".
3. **Cấu hình Limit Request trên Nginx:**
Chỉnh sửa cấu hình Nginx để giới hạn tốc độ truy cập (\`limit_req_zone\`).
\`\`\`nginx
limit_req_zone $binary_remote_addr zone=one:10m rate=1r/s;
server {
    location /wp-login.php {
        limit_req zone=one burst=5;
    }
}
\`\`\`

## Kết luận
Bị DDoS là chuyện rất bình thường đối với các website đang phát triển. Hãy lưu lại bộ lệnh \`netstat\` và \`awk\` trên, đó sẽ là những "vũ khí" đắc lực nhất giúp bạn chẩn đoán nhanh tình trạng hệ thống trong những giờ phút dầu sôi lửa bỏng!
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

    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn kiểm tra và xử lý tấn công DDoS / Spam trên Nginx và Apache",
      slug: "kiem-tra-xu-ly-tan-cong-ddos-nginx-apache-" + Date.now(),
      content: htmlContent,
      excerpt: "Web server đột nhiên phản hồi chậm chạp hoặc sập hoàn toàn do lượng truy cập bất thường? Dưới đây là cách sử dụng lệnh Linux (netstat, awk) để tìm ra các IP đang tấn công DDoS / Spam và phương pháp chặn đứng chúng ngay lập tức.",
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
