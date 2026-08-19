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
# Bảo mật WordPress toàn tập: 7 bước ngăn chặn Hacker tấn công

WordPress chiếm hơn 40% số lượng website trên toàn thế giới, và đó là lý do nó luôn là "miếng mồi ngon" của hacker và các loại botnet tự động. Một khi bị tấn công, bạn không chỉ mất dữ liệu mà còn đánh mất uy tín thương hiệu và thứ hạng SEO.

Tuy nhiên, đừng quá lo lắng. Bạn hoàn toàn có thể tự bảo vệ website của mình với 7 bước bảo mật cốt lõi dưới đây.

---

## 1. Sử dụng Mật khẩu mạnh và Thay đổi đường dẫn Đăng nhập
Việc sử dụng tài khoản tên \`admin\` và mật khẩu dễ đoán là nguyên nhân số một dẫn đến mất website qua các cuộc tấn công Brute-force.
- **Không dùng tài khoản tên \`admin\`:** Hãy tạo một tài khoản quản trị mới với tên khác (ví dụ: \`quanly_web\`) và xóa tài khoản \`admin\` cũ đi.
- **Sử dụng Plugin WPS Hide Login:** Theo mặc định, ai cũng biết trang đăng nhập của WordPress là \`domain.com/wp-admin\`. Hãy dùng plugin này để đổi thành một đường dẫn bí mật (Vd: \`domain.com/dang-nhap-cua-toi\`).

## 2. Bật Xác thực hai yếu tố (2FA)
Dù hacker có dò ra mật khẩu của bạn, họ cũng không thể đăng nhập nếu không có mã xác thực gửi về điện thoại.
- Bạn có thể cài đặt plugin **Wordfence Security** hoặc **WP 2FA** để kích hoạt tính năng quét mã QR qua Google Authenticator hoặc Authy cho tài khoản Admin.

## 3. Cập nhật WordPress, Theme và Plugin thường xuyên
Các bản cập nhật không chỉ mang đến tính năng mới mà còn Vá các lỗ hổng bảo mật (Zero-day vulnerabilities) vừa được phát hiện.
- Hãy tạo thói quen kiểm tra và bấm cập nhật ít nhất 1 lần/tuần.
- Loại bỏ hoàn toàn (Delete) những Plugin và Theme không còn sử dụng thay vì chỉ nhấn vô hiệu hóa (Deactivate).

## 4. Không dùng Theme/Plugin Nulled (Crack)
Đây là "bản án tử" cho mọi website. Các theme trả phí được chia sẻ miễn phí trên mạng (nulled) có đến 99% chứa sẵn Backdoor hoặc mã độc giấu kín.
- Một khi bạn cài đặt chúng, hacker có toàn quyền điều khiển host của bạn. Hãy mua bản quyền chính hãng hoặc sử dụng các phiên bản miễn phí trên kho của WordPress.org.

## 5. Giới hạn số lần đăng nhập sai (Limit Login Attempts)
Để ngăn chặn các công cụ dò mật khẩu tự động, bạn cần giới hạn số lần đăng nhập.
- Sử dụng plugin **Limit Login Attempts Reloaded**. Khi một IP gõ sai mật khẩu quá 3 lần, hệ thống sẽ tự động khóa IP đó trong 24 giờ.

## 6. Phân quyền File và Folder (CHMOD) chuẩn xác
Nếu cấu hình sai quyền, bất cứ ai truy cập vào máy chủ cũng có thể đọc và sửa file của bạn.
- Các thư mục (Directories) nên được set ở mức **755**.
- Các tệp tin (Files) nên được set ở mức **644**.
- Riêng file cực kỳ quan trọng là \`wp-config.php\` (chứa mật khẩu Database) nên được khóa chặt ở mức **440** hoặc **400** để chặn quyền ghi/chỉnh sửa.

## 7. Cài đặt Plugin Bảo mật & Tường lửa (WAF)
Một plugin bảo mật tốt giống như có bảo vệ canh gác website 24/7.
- **Wordfence Security / iThemes Security:** Đây là 2 plugin cung cấp tính năng Scan mã độc tự động, chặn IP quốc gia (nếu bị DDoS) và tích hợp Tường lửa Ứng dụng Web (WAF) chặn các hành vi cố tình chèn mã độc (SQL Injection, XSS).
- **Sử dụng Cloudflare:** Hãy đưa website qua mạng lưới của Cloudflare để giấu địa chỉ IP thực của máy chủ và tận dụng lớp khiên chắn DDoS miễn phí của họ.

> [!IMPORTANT]
> **Backup (Sao lưu) là bước bảo mật cuối cùng và quan trọng nhất.** Hãy thiết lập sao lưu tự động hàng ngày (qua Google Drive hoặc Dropbox) bằng plugin **UpdraftPlus**. Khi có rủi ro xảy ra, bạn luôn có thể quay ngược thời gian cứu sống website chỉ bằng 1 cú click chuột!
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
      title: "Bảo mật WordPress toàn tập: 7 bước ngăn chặn Hacker tấn công",
      slug: "bao-mat-wordpress-toan-tap-" + Date.now(),
      content: htmlContent,
      excerpt: "WordPress là mục tiêu hàng đầu của các cuộc tấn công mạng. Tuy nhiên, chỉ với 7 bước bảo mật cốt lõi sau đây, bạn có thể biến website của mình thành một pháo đài bất khả xâm phạm.",
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
