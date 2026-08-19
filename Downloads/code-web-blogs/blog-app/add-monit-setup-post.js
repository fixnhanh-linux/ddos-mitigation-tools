const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String }
}, { timestamps: true });

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Category = mongoose.models.Category || mongoose.model("Category", CategorySchema);
const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const markdownContent = `
# Hướng dẫn cài đặt Monit: Giám sát và tự động "Chữa lành" máy chủ Linux

Tất cả các công cụ chúng ta đã tìm hiểu trước đây (Zabbix, Prometheus, Netdata) đều làm rất tốt một việc: **Báo cáo và Cảnh báo**. Nhưng thử tưởng tượng bạn đang ngủ say lúc 3 giờ sáng, điện thoại ting ting báo MySQL bị sập. Bạn lồm cồm bò dậy, mở Laptop, SSH vào Server và gõ đúng 1 dòng lệnh: \`systemctl restart mysql\`. Sau đó đi ngủ tiếp.

Thật phiền phức phải không? Sẽ ra sao nếu chúng ta có một công cụ phát hiện MySQL bị sập và **tự động khởi động lại nó** thay cho bạn? Chào mừng bạn đến với thế giới "Tự chữa lành" (Self-healing) của **Monit**.

---

## 1. Monit là gì?

Monit là một tiện ích nhỏ gọn mã nguồn mở dành cho Linux và Unix. Khác với các hệ thống giám sát đồ sộ, Monit hoạt động cực kỳ đơn giản theo nguyên lý:
1. Bạn bảo nó theo dõi một tiến trình (Ví dụ: Nginx, MySQL, PHP-FPM).
2. Nếu tiến trình đó ngốn quá nhiều RAM, CPU hoặc tự nhiên lăn ra chết, Monit sẽ thực hiện **Hành động** (Action) mà bạn đã quy định từ trước (Thường là Restart lại dịch vụ).
3. Sau khi Restart, nó mới gửi Email cảnh báo cho bạn biết: *"Boss ơi, MySQL vừa sập, nhưng em đã lỡ tay cứu nó sống lại rồi nhé!"*.

## 2. Cài đặt Monit siêu tốc

Monit có sẵn trên mọi kho ứng dụng chuẩn của Linux.

- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt update
  sudo apt install monit -y
  \`\`\`

- **Trên CentOS/RHEL:**
  \`\`\`bash
  sudo yum install epel-release -y
  sudo yum install monit -y
  \`\`\`

Khởi động và cấu hình cho Monit chạy cùng hệ thống:
\`\`\`bash
sudo systemctl start monit
sudo systemctl enable monit
\`\`\`

## 3. Cấu hình tự động khởi động lại Nginx và MySQL

Trái tim của Monit nằm ở file cấu hình \`/etc/monit/monitrc\` (trên Ubuntu) hoặc \`/etc/monitrc\` (trên CentOS). Hãy mở file này ra:

\`\`\`bash
sudo nano /etc/monit/monitrc
\`\`\`

Đầu tiên, bật giao diện Web của Monit bằng cách tìm mục \`set httpd\` và bỏ dấu \`#\`:
\`\`\`ini
set httpd port 2812 and
    use address localhost  # Chỉ cho phép truy cập từ localhost
    allow localhost        # Cho phép localhost kết nối
    allow admin:monit      # Tài khoản và mật khẩu đăng nhập web
\`\`\`

Sau đó, kéo xuống dưới cùng của file (hoặc tạo các file nhỏ trong \`/etc/monit/conf.d/\`), chúng ta sẽ thêm luật giám sát:

### Giám sát Web Server Nginx
Chúng ta bảo Monit: Hãy theo dõi file lưu trữ PID của Nginx. Nếu Nginx sập (mất file PID), hãy chạy lệnh start. Nếu Nginx không trả lời ở cổng 80 trong 5 giây, hãy restart.
\`\`\`ini
check process nginx with pidfile /var/run/nginx.pid
    start program = "/bin/systemctl start nginx"
    stop program = "/bin/systemctl stop nginx"
    if failed port 80 protocol http request "/" timeout 5 seconds then restart
    if 3 restarts within 5 cycles then alert
\`\`\`

### Giám sát Database MySQL / MariaDB
Nếu MySQL ngốn quá 90% RAM, hãy restart nó.
\`\`\`ini
check process mysql with pidfile /var/run/mysqld/mysqld.pid
    start program = "/bin/systemctl start mysql"
    stop program = "/bin/systemctl stop mysql"
    if failed host 127.0.0.1 port 3306 protocol mysql then restart
    if totalmem > 90% then restart
\`\`\`

### Giám sát tài nguyên máy chủ (Disk, RAM, CPU)
\`\`\`ini
check system $HOST
    if memory usage > 85% for 4 cycles then alert
    if cpu usage (user) > 90% for 4 cycles then alert
\`\`\`

Lưu file lại và yêu cầu Monit tải lại cấu hình:
\`\`\`bash
sudo monit reload
\`\`\`

## 4. Kiểm tra sự "Vi diệu" của Monit

Bây giờ hệ thống tự chữa lành của bạn đã hoạt động. Hãy đóng vai một Hacker và thử "phá" server của chính mình:

1. Gõ lệnh tắt Nginx:
   \`\`\`bash
   sudo systemctl stop nginx
   \`\`\`
2. Kiểm tra trạng thái của Nginx ngay lúc đó: Nó đã chết (\`inactive\`).
3. Đợi khoảng 1-2 phút (theo chu kỳ quét của Monit), bạn gõ lại lệnh kiểm tra:
   \`\`\`bash
   sudo systemctl status nginx
   \`\`\`
   Thật kỳ diệu! Nginx đã được bật lại (\`active\`) mà bạn không hề động tay vào.

Bạn cũng có thể xem tổng quan trạng thái do Monit báo cáo bằng lệnh:
\`\`\`bash
sudo monit status
\`\`\`

## Kết luận

**Monit** không sinh ra để vẽ biểu đồ hoa mỹ hay phân tích Log phức tạp. Nó sinh ra để làm một chàng "Hiệp sĩ áo đen" thầm lặng bảo vệ và giữ cho hệ thống của bạn luôn sống sót (Self-healing) trong đêm tối. Hãy kết hợp Monit cùng với Zabbix hoặc Prometheus, bạn sẽ có những giấc ngủ thật sự trọn vẹn!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // 1. Get User
    let user = await User.findOne({});
    let authorId = user ? user._id : null;

    // 2. Find Category
    let category = await Category.findOne({ slug: "giam-sat" });
    let catId = category ? category._id : null;

    // 3. Create new post
    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn cài đặt Monit: Giám sát và tự động 'Chữa lành' máy chủ Linux",
      slug: "cai-dat-monit-tu-dong-restart-service-" + Date.now(),
      content: htmlContent,
      excerpt: "Chấm dứt cảnh phải thức dậy giữa đêm để khởi động lại Nginx hay MySQL bị sập. Cùng tìm hiểu cách cài đặt Monit để trao cho Server khả năng tự 'chữa lành' và cứu sống các tiến trình đã chết.",
      author: authorId,
      category: catId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("New post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
