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
# Hướng dẫn cài đặt Uptime Kuma: Giám sát Uptime siêu đẹp, thay thế Pingdom

Khi nói đến giám sát (Monitoring), Zabbix hay Prometheus thường tập trung vào "nội tạng" của máy chủ (CPU, RAM, Ổ cứng). Nhưng đôi khi, điều duy nhất bạn (hoặc Sếp của bạn) quan tâm chỉ là: **Trang web có truy cập được không? Chứng chỉ SSL bao giờ hết hạn?**

Đó được gọi là **Uptime Monitoring (Giám sát thời gian hoạt động)**. Thay vì phải trả tiền hàng tháng cho các dịch vụ như Pingdom hay UptimeRobot, hôm nay chúng ta sẽ tự cài đặt **Uptime Kuma** – một công cụ mã nguồn mở miễn phí, siêu nhẹ, giao diện tuyệt đẹp và cực kỳ dễ dùng.

---

## 1. Uptime Kuma làm được những gì?

Không đao to búa lớn như Zabbix, Uptime Kuma sinh ra để làm một số việc cực kỳ cụ thể nhưng lại vô cùng hiệu quả:
- **Ping & HTTP Check:** Liên tục "gõ cửa" website của bạn (mỗi 20 giây một lần). Nếu web sập (trả về lỗi 500, 404 hoặc timeout), nó sẽ báo động ngay lập tức.
- **Theo dõi chứng chỉ SSL:** Tự động đếm lùi số ngày hết hạn của chứng chỉ SSL và cảnh báo trước khi website của bạn bị trình duyệt chặn vì lỗi "Not Secure".
- **Status Page (Trang trạng thái):** Tự động tạo ra một trang hiển thị tình trạng xanh/đỏ siêu đẹp để bạn khoe với khách hàng (giống như trang status.github.com).
- **Hỗ trợ 99+ kênh thông báo:** Telegram, Discord, Slack, Email, MS Teams... chỉ với vài cú click chuột.

## 2. Cài đặt Uptime Kuma cực nhanh bằng Docker

Cài đặt Uptime Kuma dễ đến mức bạn có thể hoàn thành trong chưa tới 1 phút. Yêu cầu duy nhất là máy chủ của bạn đã có **Docker**.

Bạn chỉ cần chạy 1 câu lệnh duy nhất trên Terminal (SSH):

\`\`\`bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
\`\`\`

**Giải thích câu lệnh:**
- \`-d\`: Chạy ngầm.
- \`--restart=always\`: Tự động khởi động lại Kuma nếu máy chủ khởi động lại.
- \`-p 3001:3001\`: Mở cổng 3001 để bạn truy cập vào web.
- \`-v uptime-kuma:/app/data\`: Lưu trữ dữ liệu cấu hình ra ngoài ổ cứng để nếu có xóa nhầm Docker thì không bị mất dữ liệu.

## 3. Cấu hình giám sát Website đầu tiên

Sau khi chạy lệnh xong, hãy mở trình duyệt và truy cập vào: \`http://IP_MAY_CHU_CUA_BAN:3001\`

1. Ở lần đầu tiên, Uptime Kuma sẽ yêu cầu bạn **tạo tài khoản Admin**. Hãy nhập Username và Password.
2. Đăng nhập xong, bạn sẽ thấy giao diện Dashboard vô cùng trực quan. Nhấn nút **+ Add New Monitor** (Thêm màn hình mới).
3. **Monitor Type:** Chọn \`HTTP(s)\` để giám sát một trang web.
4. **Friendly Name:** Đặt tên gợi nhớ (VD: Trang chủ Công ty).
5. **URL:** Nhập đường dẫn web của bạn (VD: \`https://domain.com\`).
6. **Heartbeat Interval:** Để mặc định là 60s (Cứ 1 phút nó sẽ check web của bạn 1 lần).
7. Kéo xuống dưới cùng và tick vào ô **Certificate Expiry Notification** (Cảnh báo hết hạn SSL).
8. Nhấn **Save**.

Bùm! Bạn sẽ thấy một biểu đồ bắt đầu nhấp nháy màu xanh lá cây cực đẹp báo hiệu website đang sống khỏe.

## 4. Thiết lập cảnh báo (Notification) qua Telegram

Web sập mà không ai biết thì giám sát làm gì? Cài đặt cảnh báo trong Uptime Kuma dễ hơn các phần mềm khác rất nhiều vì nó có sẵn giao diện trực quan.

1. Bấm vào Avatar góc phải trên cùng, chọn **Settings** -> **Notifications**.
2. Bấm **Setup Notification**.
3. **Notification Type:** Chọn \`Telegram\`.
4. Điền **Bot Token** (Lấy từ @BotFather) và **Chat ID** (Lấy từ @userinfobot) vào các ô tương ứng.
5. Bấm nút **Test**. Ngay lập tức điện thoại của bạn sẽ rung lên và nhận được tin nhắn test từ Uptime Kuma.
6. Bấm **Save**.

Bây giờ, hãy quay lại cái Monitor bạn vừa tạo, Edit nó và bật cái Telegram Notification lên là xong.

## Kết luận

**Uptime Kuma** là một minh chứng cho việc không phải lúc nào công cụ giám sát cũng phải khô khan, nặng nề và chi chít mã code YAML. Nếu bạn là một Freelancer, hoặc quản lý một vài trang WordPress cho khách hàng và chỉ cần một thứ để biết Web sống hay chết, thì Uptime Kuma chính là chân ái!
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
      title: "Hướng dẫn cài đặt Uptime Kuma: Giám sát Uptime siêu đẹp, thay thế Pingdom",
      slug: "cai-dat-uptime-kuma-giam-sat-website-" + Date.now(),
      content: htmlContent,
      excerpt: "Chỉ cần 1 phút chạy Docker, bạn đã có ngay một hệ thống giám sát thời gian sống (Uptime) của Website và cảnh báo hết hạn SSL siêu đẹp, hoàn toàn thay thế được UptimeRobot hay Pingdom đắt đỏ.",
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
