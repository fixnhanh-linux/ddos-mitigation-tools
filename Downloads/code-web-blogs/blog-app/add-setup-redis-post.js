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
# Hướng dẫn chi tiết cài đặt và bảo mật Redis Server trên Linux

Sau khi đã hiểu được sức mạnh vô song của Redis ở bài viết trước, bước tiếp theo chắc chắn là phải tự tay cài đặt và tích hợp nó vào hệ thống của bạn.

Redis rất nhẹ và dễ cài đặt, nhưng nếu bạn không cấu hình bảo mật cẩn thận, toàn bộ dữ liệu trên RAM của bạn có thể bị hacker truy cập và "đánh cắp" dễ dàng (Bởi vì mặc định Redis không có mật khẩu!). Bài viết này sẽ hướng dẫn bạn cài đặt chuẩn xác và bảo mật nhất.

---

## 1. Cài đặt Redis trên Ubuntu/Debian

Redis có sẵn trong kho ứng dụng chính thức của Ubuntu, nên việc cài đặt chỉ tốn đúng 2 dòng lệnh.

Mở Terminal (SSH) của máy chủ và chạy:
\`\`\`bash
sudo apt update
sudo apt install redis-server -y
\`\`\`

Sau khi cài đặt xong, hãy kiểm tra xem Redis đã chạy thành công chưa:
\`\`\`bash
sudo systemctl status redis-server
\`\`\`
Nếu bạn thấy dòng chữ màu xanh lá cây \`active (running)\`, xin chúc mừng! Redis đã được bật.

Bạn có thể test thử bằng cách gõ lệnh \`redis-cli\` để vào giao diện gõ lệnh của Redis:
\`\`\`text
127.0.0.1:6379> PING
PONG
\`\`\`
Nếu Redis trả lời là \`PONG\`, mọi thứ hoạt động hoàn hảo. Nhập \`exit\` để thoát.

## 2. Cấu hình Bảo mật cho Redis (Bắt buộc)

Như đã đề cập, Redis mặc định **không có mật khẩu** và chỉ cho phép kết nối từ \`localhost\` (127.0.0.1). 
Nếu Web Server của bạn nằm trên CÙNG một máy chủ với Redis thì không sao, nhưng nếu bạn chạy Web và Redis ở hai máy chủ khác nhau, bạn bắt buộc phải cấu hình lại.

Hãy mở file cấu hình của Redis:
\`\`\`bash
sudo nano /etc/redis/redis.conf
\`\`\`

### Bước A: Thiết lập mật khẩu (Requirepass)
Trong file cấu hình, hãy nhấn \`Ctrl + W\` và tìm từ khóa \`requirepass\`. Bạn sẽ thấy một dòng bị comment lại bằng dấu \`#\`:
\`\`\`ini
# requirepass foobared
\`\`\`
Hãy bỏ dấu \`#\` và thay chữ \`foobared\` bằng một mật khẩu cực kỳ phức tạp:
\`\`\`ini
requirepass MatKhauRedisSieuKho123!@#
\`\`\`

### Bước B: Cho phép kết nối từ bên ngoài (Bind)
Tiếp tục tìm từ khóa \`bind 127.0.0.1\`. Dòng này giới hạn Redis chỉ được nghe từ máy hiện tại. 
Để cho phép máy chủ Web (Ví dụ IP của Web Server là \`192.168.1.50\`) kết nối vào, hãy sửa lại thành:
\`\`\`ini
bind 127.0.0.1 192.168.1.50
\`\`\`
*(Lưu ý: Tuyệt đối KHÔNG ĐƯỢC để \`bind 0.0.0.0\` nếu máy chủ của bạn có IP Public, vì hacker sẽ scan và vét sạch dữ liệu của bạn).*

Lưu file lại (\`Ctrl + O\`, \`Enter\`, \`Ctrl + X\`) và khởi động lại Redis để áp dụng cấu hình:
\`\`\`bash
sudo systemctl restart redis-server
\`\`\`

## 3. Tối ưu hóa hiệu năng (System Tuning)

Redis lưu dữ liệu trên RAM, nên nó rất nhạy cảm với cơ chế quản lý bộ nhớ của Linux. Nếu bạn check log của Redis (\`cat /var/log/redis/redis-server.log\`), bạn thường sẽ thấy vài cảnh báo (Warning). Hãy triệt tiêu chúng!

**1. Tắt cơ chế Transparent Huge Pages (THP)**
Redis không thích THP. Chạy lệnh sau để vô hiệu hóa:
\`\`\`bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
\`\`\`

**2. Tăng giới hạn Backlog và Overcommit Memory**
Mở file \`/etc/sysctl.conf\` và thêm vào cuối file 2 dòng này:
\`\`\`bash
net.core.somaxconn = 1024
vm.overcommit_memory = 1
\`\`\`
Sau đó chạy lệnh \`sysctl -p\` để áp dụng ngay lập tức.

## 4. Kết nối Web App (Node.js/PHP) với Redis

Giờ đây Redis đã có mật khẩu, làm sao để code của bạn nói chuyện được với nó?
Ví dụ với **Node.js**, bạn thường dùng thư viện \`ioredis\`:

\`\`\`javascript
const Redis = require("ioredis");

const redisClient = new Redis({
  port: 6379,          // Cổng mặc định của Redis
  host: "192.168.1.50",// IP của máy chủ Redis
  password: "MatKhauRedisSieuKho123!@#",
});

// Thử lưu một dữ liệu Caching
redisClient.set("danh_sach_san_pham", JSON.stringify([{ id: 1, name: "Ao thun" }]), "EX", 300); 
// EX: 300 nghĩa là dữ liệu này sẽ tự động bị xóa sau 300 giây (5 phút).
\`\`\`

## Kết luận

Việc cài đặt Redis không hề khó, nhưng việc cấu hình **mật khẩu (requirepass)** và **tối ưu nhân Linux (sysctl)** mới là thứ quyết định hệ thống của bạn có chạy ổn định và an toàn hay không. Bây giờ, Database của bạn đã có một tấm khiên Caching vững chắc, sẵn sàng đương đầu với mọi đợt bão Traffic!
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
      title: "Hướng dẫn chi tiết cài đặt và bảo mật Redis Server trên Linux",
      slug: "cai-dat-redis-server-bao-mat-" + Date.now(),
      content: htmlContent,
      excerpt: "Việc cài đặt Redis rất đơn giản, nhưng nếu không biết cách set mật khẩu và tối ưu OS, dữ liệu của bạn sẽ gặp nguy hiểm. Cùng làm theo hướng dẫn chuẩn xác sau đây.",
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
