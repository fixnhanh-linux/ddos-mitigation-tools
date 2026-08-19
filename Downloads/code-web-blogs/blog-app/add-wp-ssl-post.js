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
# Hướng dẫn cài đặt chứng chỉ bảo mật SSL (HTTPS) miễn phí cho Website WordPress

Ngày nay, một website hiển thị **"Không an toàn" (Not Secure)** trên thanh địa chỉ không chỉ làm khách hàng sợ hãi mà còn bị Google đánh tụt hạng SEO thê thảm. Việc cài đặt chứng chỉ SSL để chuyển từ HTTP sang HTTPS là điều bắt buộc.

Dưới đây là 2 phương pháp cài đặt SSL miễn phí, dễ dàng và phổ biến nhất hiện nay.

---

## Cách 1: Cài đặt SSL miễn phí bằng Cloudflare (Khuyên dùng)

Cloudflare cung cấp dịch vụ proxy và CDN có tích hợp sẵn chứng chỉ SSL miễn phí trọn đời (Tự động gia hạn). Cách này rất phù hợp nếu bạn muốn kết hợp cả chống DDoS, ẩn IP máy chủ và tăng tốc tải trang.

### Bước 1: Trỏ NameServer về Cloudflare
1. Đăng ký một tài khoản tại [Cloudflare.com](https://www.cloudflare.com/).
2. Thêm tên miền (Add Site) vào Cloudflare và chọn gói **Free**.
3. Cloudflare sẽ quét các bản ghi DNS hiện tại của bạn. Nhấn Continue.
4. Cloudflare cung cấp cho bạn 2 địa chỉ NameServers (Ví dụ: \`jean.ns.cloudflare.com\`).
5. Đăng nhập vào trang quản lý tên miền (nhà cung cấp mua domain) và đổi NameServers cũ thành 2 NameServers mới này.

### Bước 2: Bật SSL trên Cloudflare
1. Đợi khoảng 15 phút đến 1 tiếng để DNS cập nhật. 
2. Vào Cloudflare, chọn tab **SSL/TLS**.
3. Ở mục **Overview**, chọn chế độ **Flexible** hoặc **Full**. 
   - *Flexible*: Cài SSL từ người dùng tới Cloudflare. (Nhanh nhất)
   - *Full*: Đòi hỏi server của bạn cũng phải có chứng chỉ tự cấp (Self-signed).

### Bước 3: Ép WordPress sử dụng HTTPS (Bắt buộc)
1. Truy cập vào wp-admin trên web của bạn.
2. Vào **Cài đặt (Settings) > Tổng quan (General)**.
3. Thay đổi URL ở \`Địa chỉ WordPress (URL)\` và \`Địa chỉ trang web (URL)\` từ \`http://\` thành \`https://\`.
4. Nhấn lưu. (Lúc này bạn sẽ bị văng ra và phải đăng nhập lại).

> [!TIP]
> Bạn nên cài thêm plugin **Really Simple SSL** để plugin tự động đổi tất cả link ảnh/bài viết cũ từ HTTP sang HTTPS, tránh lỗi *Mixed Content* (ổ khóa bị vàng/không xanh).

---

## Cách 2: Cài đặt Let's Encrypt SSL trực tiếp trên Server / Hosting

Let's Encrypt là tổ chức chứng thực SSL miễn phí phi lợi nhuận lớn nhất thế giới. Chứng chỉ này có thời hạn 90 ngày nhưng đa số các Control Panel đều hỗ trợ tự động gia hạn (Auto-renew).

### Đối với người dùng Hosting (cPanel / DirectAdmin)
1. Đăng nhập vào Control Panel của Hosting.
2. Tìm mục **Let's Encrypt SSL** hoặc **SSL/TLS Status**.
3. Tích chọn tên miền của bạn và nhấn **Issue** (hoặc Run AutoSSL).
4. Hệ thống sẽ tự động cài SSL vào Hosting. Khi hoàn tất, hãy quay lại thực hiện **Bước 3 của Cách 1** để ép WordPress chạy HTTPS.

### Đối với người dùng VPS (Cài đặt qua Certbot)
Nếu bạn tự cấu hình VPS bằng dòng lệnh (Nginx/Apache), bạn sẽ cần sử dụng Certbot để cài đặt.

**Cài đặt Certbot trên Ubuntu/Debian:**
\`\`\`bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
\`\`\`

**Lấy chứng chỉ SSL và tự cấu hình cho Nginx:**
\`\`\`bash
sudo certbot --nginx -d domain-cua-ban.com -d www.domain-cua-ban.com
\`\`\`
*Lưu ý: Bạn phải trỏ DNS (bản ghi A) về IP của VPS trước khi chạy lệnh này.*

Certbot sẽ hỏi bạn có muốn tự động redirect từ HTTP sang HTTPS không. Hãy chọn tùy chọn số 2 (Redirect) để hệ thống tự cấu hình file config Nginx.

## Kết luận
Sau khi hoàn tất cài đặt, hãy mở trình duyệt ẩn danh, gõ tên miền của bạn vào và tận hưởng chiếc **ổ khóa xanh** (hoặc xám an toàn) nhé. Nếu có lỗi ổ khóa không hiện đủ hoặc bị Mixed Content, hãy kiểm tra lại bằng console (F12) xem có link ảnh nào còn sót dạng http:// hay không!
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
      title: "Hướng dẫn cài đặt chứng chỉ bảo mật SSL (HTTPS) miễn phí cho Website WordPress",
      slug: "cai-dat-ssl-https-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Website không có SSL sẽ bị trình duyệt cảnh báo không an toàn và bị Google phạt điểm SEO. Bài viết này hướng dẫn bạn cài đặt SSL miễn phí 100% bằng Let's Encrypt và Cloudflare.",
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
