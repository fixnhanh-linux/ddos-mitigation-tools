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
# Hướng dẫn cài đặt SSL Let's Encrypt (Wildcard) tự động gia hạn bằng Certbot

Ngày nay, việc một website chạy trên giao thức \`http://\` sẽ lập tức bị trình duyệt Chrome cảnh báo "Không an toàn" (Not Secure). Việc sở hữu chứng chỉ SSL (\`https://\`) không chỉ bảo mật dữ liệu mà còn là yếu tố **bắt buộc** để SEO lên top Google.

May mắn thay, tổ chức **Let's Encrypt** đã cung cấp chứng chỉ SSL hoàn toàn miễn phí. Trong bài viết này, chúng ta sẽ sử dụng công cụ **Certbot** để lấy chứng chỉ và cài đặt chế độ tự động gia hạn trên Server Linux (Ubuntu/CentOS).

---

## 1. Certbot là gì?

Certbot là một client mã nguồn mở tự động hóa quá trình cấp phát và cấu hình chứng chỉ Let's Encrypt trên các máy chủ web (như Nginx, Apache). Nó giúp bạn tiết kiệm hàng giờ đồng hồ so với việc cài đặt SSL thủ công truyền thống.

## 2. Các bước cài đặt Certbot trên máy chủ Linux

*(Bài viết sử dụng Ubuntu 20.04 / 22.04 làm ví dụ chuẩn).*

### Bước 1: Cài đặt Snapd
Certbot hiện tại khuyên dùng \`snap\` để cài đặt nhằm đảm bảo gói phần mềm luôn được cập nhật mới nhất.
\`\`\`bash
sudo apt update
sudo apt install snapd
sudo snap install core; sudo snap refresh core
\`\`\`

### Bước 2: Xóa phiên bản Certbot cũ (Nếu có)
Nếu trước đây bạn cài Certbot qua \`apt\`, hãy xóa nó đi để tránh xung đột:
\`\`\`bash
sudo apt-get remove certbot
\`\`\`

### Bước 3: Cài đặt Certbot qua Snap
\`\`\`bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
\`\`\`

## 3. Cấp phát và cấu hình SSL cho Nginx / Apache

Điều tuyệt vời nhất của Certbot là nó có thể tự động tìm file cấu hình (Virtual Host) của Nginx/Apache và chèn các thông số SSL vào đó giúp bạn.

### Dành cho Nginx:
Chạy lệnh sau và làm theo hướng dẫn trên màn hình (Nhập Email, đồng ý điều khoản, chọn tên miền muốn cài SSL):
\`\`\`bash
sudo certbot --nginx
\`\`\`

### Dành cho Apache:
\`\`\`bash
sudo certbot --apache
\`\`\`

Sau khi hoàn tất, Certbot sẽ hỏi bạn có muốn tự động chuyển hướng (Redirect) toàn bộ truy cập từ HTTP sang HTTPS hay không. **Khuyến nghị chọn \`2\` (Chuyển hướng tự động).**

## 4. Cấp phát SSL Wildcard (*.domain.com)

Nếu bạn có rất nhiều Sub-domain (ví dụ \`blog.domain.com\`, \`shop.domain.com\`) và không muốn cài lẻ tẻ từng cái, hãy dùng **Wildcard SSL**.

Chứng chỉ Wildcard đòi hỏi bạn phải xác thực quyền sở hữu tên miền thông qua bản ghi DNS (TXT Record) thay vì xác thực qua web server.

Chạy lệnh sau:
\`\`\`bash
sudo certbot certonly --manual --preferred-challenges dns -d "domain.com" -d "*.domain.com"
\`\`\`
Màn hình sẽ dừng lại và cung cấp cho bạn một chuỗi ký tự. Bạn cần đăng nhập vào trang quản lý Tên miền (Cloudflare, Namecheap...) và tạo 1 bản ghi **TXT** với tên là \`_acme-challenge.domain.com\` và giá trị là chuỗi ký tự đó. Đợi vài phút để DNS cập nhật rồi nhấn Enter để Certbot cấp phát chứng chỉ.

## 5. Thiết lập tự động gia hạn (Auto Renew)

Chứng chỉ Let's Encrypt chỉ có thời hạn **90 ngày**. Đừng lo, Certbot đã tự động tạo một Cronjob trên server để quét và gia hạn các chứng chỉ sắp hết hạn.

Để kiểm tra xem quá trình tự động gia hạn (Dry Run) có hoạt động trơn tru không, hãy chạy lệnh giả lập:
\`\`\`bash
sudo certbot renew --dry-run
\`\`\`
Nếu kết quả trả về là \`Congratulations, all simulated renewals succeeded\`, bạn có thể kê cao gối ngủ. Website của bạn sẽ luôn có chữ Tín (Khóa xanh HTTPS) vĩnh viễn!

> [!TIP]
> Nếu bạn sử dụng Cloudflare, bạn có thể thiết lập chế độ SSL/TLS thành **Full (Strict)** để đảm bảo mã hóa đầu cuối 100% kết hợp với chứng chỉ từ Let's Encrypt.
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
      title: "Hướng dẫn cài đặt SSL Let's Encrypt (Wildcard) tự động gia hạn bằng Certbot",
      slug: "cai-dat-ssl-letsencrypt-certbot-" + Date.now(),
      content: htmlContent,
      excerpt: "SSL không chỉ bảo vệ dữ liệu người dùng mà còn là yếu tố bắt buộc để SEO lên top Google. Học cách sử dụng Certbot để cấp phát chứng chỉ SSL Let's Encrypt hoàn toàn miễn phí và cấu hình tự động gia hạn cho Nginx và Apache.",
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
