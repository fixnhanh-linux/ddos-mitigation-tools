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
# Cài đặt Cockpit trên Ubuntu/CentOS: Bảng điều khiển Server qua giao diện Web (Web GUI)

Bạn đã chán ngấy với việc phải gõ các dòng lệnh đen ngòm mỗi lần muốn kiểm tra RAM, xem Log hay tạo một user mới trên Linux? 

Bạn ước gì CentOS hay Ubuntu có một giao diện trực quan, cho phép bạn click chuột để quản lý mọi thứ (giống như cPanel hay DirectAdmin) nhưng lại **hoàn toàn miễn phí và cực kỳ nhẹ**?

Chào mừng bạn đến với **Cockpit** – Bảng điều khiển máy chủ (Server Admin Panel) được Red Hat phát triển, giúp bạn giám sát và quản trị Server Linux thẳng từ trình duyệt web.

---

## 1. Cockpit làm được những gì?

Cockpit không chỉ là một công cụ giám sát, nó là một trung tâm quản trị toàn diện:
- **Giám sát thời gian thực:** Xem biểu đồ CPU, RAM, Network, Disk I/O tuyệt đẹp.
- **Quản lý Dịch vụ (Systemd):** Bật, tắt, khởi động lại Nginx, MySQL, PHP chỉ bằng 1 cú click chuột thay vì gõ \`systemctl\`.
- **Xem Log tập trung:** Xem Log hệ thống cực kỳ dễ dàng với bộ lọc thông minh.
- **Quản lý Ổ cứng (Storage):** Format ổ đĩa, tạo phân vùng, kiểm tra dung lượng trống.
- **Web Terminal:** Nó tích hợp sẵn một màn hình đen Terminal ngay trên trình duyệt web, để bạn có thể gõ lệnh bất cứ lúc nào mà không cần dùng PuTTY hay MobaXterm.

## 2. Hướng dẫn cài đặt Cockpit cực nhanh

Cockpit đã được đưa vào kho ứng dụng chính thức của hầu hết các hệ điều hành Linux lớn. 

- **Trên CentOS 7/8/9 (hoặc RHEL, AlmaLinux, Rocky Linux):**
  Cockpit thường được cài sẵn trên các bản CentOS mới. Nếu chưa có, bạn cài bằng lệnh sau:
  \`\`\`bash
  sudo yum install cockpit -y
  sudo systemctl enable --now cockpit.socket
  \`\`\`
  *Đừng quên mở tường lửa (Firewall):*
  \`\`\`bash
  sudo firewall-cmd --permanent --zone=public --add-service=cockpit
  sudo firewall-cmd --reload
  \`\`\`

- **Trên Ubuntu 20.04 / 22.04:**
  \`\`\`bash
  sudo apt update
  sudo apt install cockpit -y
  \`\`\`
  *Khởi động dịch vụ:*
  \`\`\`bash
  sudo systemctl enable --now cockpit.socket
  \`\`\`
  *Mở tường lửa (Nếu dùng UFW):*
  \`\`\`bash
  sudo ufw allow 9090
  \`\`\`

## 3. Trải nghiệm giao diện Cockpit

Mặc định, Cockpit hoạt động ở cổng **9090**.

Hãy mở trình duyệt Web của bạn lên và truy cập:
\`\`\`text
https://IP_MAY_CHU_CUA_BAN:9090
\`\`\`

*(Lưu ý: Bạn phải gõ chữ \`https://\`. Trình duyệt sẽ hiện cảnh báo bảo mật vì đây là chứng chỉ tự cấp (Self-signed certificate). Đừng lo lắng, hãy bấm **Advanced** (Nâng cao) -> **Proceed** (Tiếp tục truy cập).*

**Đăng nhập như thế nào?**
Rất đơn giản, hãy sử dụng chính **Tên đăng nhập** (root, ubuntu, centos...) và **Mật khẩu** mà bạn hay dùng để SSH vào máy chủ.

## 4. Những tính năng "ăn tiền" bên trong Cockpit

Ngay khi đăng nhập thành công, bạn sẽ thấy menu bên tay trái cực kỳ rõ ràng:
1. **Overview (Tổng quan):** Biểu đồ sinh động về CPU/RAM. Bạn sẽ biết ngay máy tính có đang bị nghẽn ở đâu không.
2. **Logs (Nhật ký):** Phân loại rành mạch lỗi (Errors), cảnh báo (Warnings). Không còn phải gõ \`journalctl\` mù mắt nữa.
3. **Storage (Lưu trữ):** Cho biết ổ C, ổ D (theo ngôn ngữ Windows) của bạn còn trống bao nhiêu GB.
4. **Networking (Mạng):** Cấu hình IP tĩnh, Firewall cực dễ.
5. **Services (Dịch vụ):** Click vào đây để đi tìm Nginx, tắt mở tùy thích.
6. **Terminal:** Một khung gõ lệnh nguyên bản, siêu mượt.

*Đặc biệt: Nếu bạn cài đặt nhiều máy chủ, bạn có thể Add (Thêm) nhiều máy chủ vào chung 1 bảng điều khiển Cockpit duy nhất để quản lý tập trung.*

## Kết luận

Nếu bạn là một người mới làm quen với Linux, hoặc đơn giản là một Coder không có quá nhiều thời gian để nhớ hàng ngàn câu lệnh quản trị hệ thống, thì **Cockpit** chính là vị cứu tinh vĩ đại nhất. Chỉ mất đúng 2 phút cài đặt, bạn đã biến một màn hình Terminal khô khan thành một "cỗ máy" điều khiển bóng bẩy và chuyên nghiệp!
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
      title: "Cài đặt Cockpit trên Ubuntu/CentOS: Bảng điều khiển Server qua giao diện Web (Web GUI)",
      slug: "cai-dat-cockpit-quan-ly-server-linux-web-" + Date.now(),
      content: htmlContent,
      excerpt: "Bạn mệt mỏi vì phải gõ lệnh đen ngòm trên Terminal? Cùng khám phá Cockpit - Công cụ siêu nhẹ biến chiếc máy chủ Ubuntu/CentOS của bạn thành một giao diện quản trị Web tuyệt đẹp và dễ dùng như cPanel.",
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
