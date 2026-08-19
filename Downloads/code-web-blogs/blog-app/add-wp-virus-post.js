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
# Hướng dẫn chi tiết khắc phục và bảo mật Website WordPress bị nhiễm mã độc (Virus/Malware)

Website WordPress là mã nguồn mở phổ biến nhất thế giới, nhưng cũng vì thế mà nó luôn là mục tiêu hàng đầu của các hacker và botnet tự động. Việc website bị nhiễm mã độc (malware), bị chèn quảng cáo ẩn hay bị redirect (chuyển hướng) sang các trang web xấu là điều khá thường xuyên xảy ra nếu bạn không bảo mật kỹ.

Dưới đây là quy trình chi tiết từng bước để dọn sạch mã độc và khôi phục website WordPress của bạn.

---

## 1. Dấu hiệu nhận biết WordPress bị nhiễm mã độc
- Website đột ngột bị chậm bất thường hoặc tiêu tốn rất nhiều CPU/RAM của Hosting/VPS.
- Khách truy cập web bị chuyển hướng (redirect) sang các trang cá cược, lừa đảo.
- Google chặn website của bạn với cảnh báo đỏ: **"The site ahead contains malware"**.
- Xuất hiện các tài khoản Admin lạ không do bạn tạo ra.
- Tìm kiếm trên Google thấy các kết quả lạ (tiếng Nhật, tiếng Trung) dưới tên miền của bạn (Spam SEO).

## 2. Bước Chuẩn Bị (Rất quan trọng)
**Tạo bản sao lưu (Backup):** Dù website đang bị nhiễm virus, bạn vẫn BẮT BUỘC phải backup lại toàn bộ thư mục web và Database hiện tại. Đề phòng trong lúc dọn dẹp lỡ tay xóa nhầm file quan trọng khiến web bị lỗi không thể phục hồi.
- Tải toàn bộ mã nguồn về máy tính.
- Export file \`.sql\` của Database.

---

## 3. Các bước làm sạch mã độc WordPress

### Bước 3.1: Ngay lập tức đổi toàn bộ mật khẩu
Điều đầu tiên cần làm là ngắt quyền truy cập của Hacker:
- Đổi mật khẩu tài khoản Hosting / VPS / cPanel / DirectAdmin.
- Đổi mật khẩu Database (MySQL) và cập nhật lại file \`wp-config.php\`.
- Đổi mật khẩu của TẤT CẢ các tài khoản Admin trên WordPress.
- Xóa các tài khoản quản trị viên (Admin) lạ mà bạn không hề tạo.

### Bước 3.2: Cài đặt lại Core (Lõi) WordPress
Rất nhiều mã độc sẽ tự động chèn code vào các file lõi của WordPress như \`wp-load.php\`, \`wp-settings.php\`, thư mục \`wp-includes\` hay \`wp-admin\`.

1. Xóa thư mục \`wp-admin\` và \`wp-includes\`. (KHÔNG xóa thư mục \`wp-content\` và file \`wp-config.php\`).
2. Xóa tất cả các file lẻ nằm ở thư mục gốc (root) như \`wp-load.php\`, \`index.php\`, \`xmlrpc.php\`... (NGOẠI TRỪ \`wp-config.php\` và \`.htaccess\`).
3. Tải bộ cài đặt WordPress mới nhất từ trang chủ \`wordpress.org\`.
4. Giải nén và upload các thư mục \`wp-admin\`, \`wp-includes\` cùng các file hệ thống mới thay thế cho những file vừa xóa.

### Bước 3.3: Kiểm tra thư mục wp-content
Thư mục \`wp-content\` chứa Theme, Plugin và Uploads. Đây là nơi ẩn nấp nhiều mã độc nhất (backdoor, webshell).

- **Thư mục \`plugins\`:** Nếu được, hãy xóa trắng thư mục plugin và cài lại từ đầu thông qua kho giao diện của WordPress. Tránh dùng các plugin chia sẻ miễn phí (nulled plugins) trên mạng.
- **Thư mục \`themes\`:** Hãy xóa tất cả các theme không sử dụng. Tương tự như plugin, hãy tải bản theme sạch từ nhà cung cấp để chép đè lên. Kiểm tra kỹ file \`functions.php\` và \`header.php\` của theme vì đây là nơi hay bị chèn mã độc.
- **Thư mục \`uploads\`:** Mã độc thường ngụy trang dưới dạng file ảnh như \`image.jpg.php\` hoặc ẩn chứa mã PHP bên trong file \`.ico\`. Hãy dùng lệnh tìm kiếm để xóa tất cả các file có đuôi \`.php\` nằm trong thư mục uploads:
  \`\`\`bash
  find /path/to/wp-content/uploads -type f -name "*.php" -delete
  \`\`\`

### Bước 3.4: Quét toàn bộ mã nguồn
Sau khi đã làm sạch thủ công, hãy sử dụng các công cụ quét mã độc chuyên dụng:
- **Trên Server/VPS:** Cài đặt **Maldet (Linux Malware Detect)** hoặc **ClamAV** để quét toàn bộ thư mục web.
- **Sử dụng Plugin:** Cài đặt plugin **Wordfence Security** hoặc **Sucuri Security**. Mở chức năng Scan và để nó dò tìm các file đã bị sửa đổi so với nguyên bản.

### Bước 3.5: Làm sạch Database (Cơ sở dữ liệu)
Mã độc có thể lưu mã script chuyển hướng hoặc chèn link ẩn vào ngay trong bài viết.
- Vào phpMyAdmin, kiểm tra bảng \`wp_options\`. Xem các dòng \`siteurl\` và \`home\` có bị đổi sang web lạ không.
- Kiểm tra các widget lạ có chứa thẻ \`<script>\` độc hại không.
- Tìm kiếm chuỗi ký tự base64 hoặc iframe trong bảng \`wp_posts\`.

---

## 4. Các biện pháp bảo mật nâng cao sau khi khắc phục

Sau khi website đã hoạt động bình thường, hãy thiết lập các rào chắn để tránh bị "tái nhiễm":
1. **Cập nhật thường xuyên:** Luôn giữ WordPress, Themes và Plugins ở phiên bản mới nhất.
2. **Không dùng đồ Crack/Nulled:** Không tải các theme hay plugin đắt tiền được chia sẻ miễn phí trên mạng, 99% chúng đều có gắn sẵn backdoor.
3. **Phân quyền File/Folder (CHMOD):** 
   - Đặt thư mục là \`755\`.
   - Đặt tệp tin (files) là \`644\`.
   - Riêng file \`wp-config.php\` nên đặt là \`440\` hoặc \`400\`.
4. **Đổi đường dẫn đăng nhập:** Sử dụng plugin (như WPS Hide Login) để đổi \`/wp-admin\` thành đường dẫn bí mật của riêng bạn, chống lại các đợt tấn công Brute-force.
5. **Cài đặt Tường lửa (WAF):** Sử dụng tường lửa của Cloudflare hoặc Wordfence để chặn bot độc hại.

## 5. Kết luận
Xử lý mã độc WordPress đòi hỏi sự tỉ mỉ và kiên nhẫn. Nếu bỏ sót dù chỉ một đoạn mã Backdoor (cửa sau), hacker có thể quay lại và phá hoại website của bạn bất kỳ lúc nào. Hy vọng bài viết này sẽ giúp bạn cứu nguy cho website của mình!
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
      title: "Hướng dẫn chi tiết khắc phục và bảo mật Website WordPress bị nhiễm mã độc",
      slug: "khac-phuc-wordpress-nhiem-ma-doc-" + Date.now(),
      content: htmlContent,
      excerpt: "Website WordPress của bạn bị chèn quảng cáo ẩn, chuyển hướng sang trang web xấu hoặc bị Google cảnh báo đỏ? Hãy xem ngay hướng dẫn chi tiết từng bước dọn sạch virus, mã độc và bảo mật lại hệ thống.",
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
