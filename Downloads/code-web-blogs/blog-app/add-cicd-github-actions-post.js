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
# CI/CD là gì? Hướng dẫn tự động hóa quy trình Deploy Web với GitHub Actions

Nếu bạn vẫn đang lập trình theo kiểu cũ: Viết code ở máy tính (Local) -> Nén file ZIP -> Mở trình quản lý file (FileZilla/cPanel) -> Upload và giải nén... thì bạn đang lãng phí quá nhiều thời gian và đối mặt với rủi ro chép đè nhầm file.

Thế giới lập trình hiện đại đã giải quyết triệt để vấn đề này bằng một khái niệm gọi là **CI/CD**. Bài viết này sẽ giúp bạn hiểu rõ và tự tay thiết lập một luồng CI/CD hoàn toàn miễn phí bằng **GitHub Actions**.

---

## 1. CI/CD là gì?

CI/CD là viết tắt của **Continuous Integration (Tích hợp liên tục)** và **Continuous Deployment/Delivery (Triển khai liên tục)**.

- **CI (Tích hợp liên tục):** Khi nhiều người cùng code một dự án, mỗi khi có ai đó đẩy code (Push) lên nhánh chính (Main/Master), hệ thống sẽ tự động quét lỗi, chạy các bài kiểm thử (Unit Tests) để đảm bảo code mới không làm hỏng các tính năng cũ.
- **CD (Triển khai liên tục):** Khi phần CI báo xanh (tức là code an toàn), hệ thống sẽ tự động lấy đoạn code mới nhất đó kết nối vào Server của bạn, chạy các lệnh cần thiết (như \`npm install\`, \`npm run build\`) và cập nhật lên mạng cho người dùng cuối xem.

Toàn bộ quá trình từ lúc bạn nhấn \`git push\` đến lúc Web cập nhật trên mạng chỉ mất đúng 1-2 phút, hoàn toàn tự động!

## 2. GitHub Actions: Công cụ CI/CD quốc dân

GitHub Actions là một tính năng tích hợp sẵn ngay trong kho lưu trữ (Repository) của GitHub, cho phép bạn tạo ra các luồng công việc (Workflows) tự động hóa. Nó hoàn toàn miễn phí cho các dự án Open Source và cung cấp thời lượng dư dả cho dự án Private.

## 3. Thực hành: Tự động Deploy Website lên VPS

Giả sử bạn có một dự án Node.js hoặc HTML/CSS tĩnh, và bạn muốn mỗi lần đẩy code lên GitHub thì nó sẽ tự động được tải về Server (VPS) thông qua SSH.

### Bước 1: Lưu trữ các biến bí mật (Secrets)
Trong kho lưu trữ GitHub của bạn, hãy vào **Settings** > **Secrets and variables** > **Actions** và tạo 3 biến sau để bảo mật thông tin đăng nhập Server:
- \`HOST\`: Địa chỉ IP của Server (Ví dụ: \`103.72.99.100\`)
- \`USERNAME\`: Tên đăng nhập SSH (Thường là \`root\`)
- \`PASSWORD\`: Mật khẩu SSH hoặc Private Key.

### Bước 2: Tạo file cấu hình Workflow
Trong dự án code trên máy bạn, tạo một thư mục tên là \`.github/workflows\` và tạo một file \`deploy.yml\` bên trong nó.

Chép đoạn mã sau vào file \`deploy.yml\`:

\`\`\`yaml
name: Deploy to VPS

# Chỉ kích hoạt khi có ai đó Push code lên nhánh 'main'
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout Code
      uses: actions/checkout@v3

    - name: Kết nối SSH và Deploy
      uses: appleboy/ssh-action@master
      with:
        host: \${{ secrets.HOST }}
        username: \${{ secrets.USERNAME }}
        password: \${{ secrets.PASSWORD }}
        port: 22
        # Các lệnh sẽ chạy trên Server của bạn
        script: |
          cd /var/www/my-website
          git pull origin main
          npm install
          npm run build
          pm2 restart all
\`\`\`

### Bước 3: Đẩy code và tận hưởng phép màu
Bây giờ, bạn chỉ cần Commit và Push code lên nhánh \`main\`:
\`\`\`bash
git add .
git commit -m "Update giao diện trang chủ"
git push origin main
\`\`\`

Hãy mở tab **Actions** trên GitHub, bạn sẽ thấy hệ thống đang tự động khởi chạy một "máy chủ mượn" của GitHub, sau đó nó sẽ kết nối vào VPS của bạn thông qua SSH, và gõ lần lượt các dòng lệnh bạn đã chỉ định ở mục \`script\` bên trên.

Khi có dấu **Tick xanh (Success)**, bạn ra ngoài trình duyệt tải lại trang Web là sẽ thấy phiên bản mới nhất!

## Kết luận

Với GitHub Actions, bạn đã giải phóng bản thân khỏi công việc copy/paste tẻ nhạt. Giờ đây, bạn có thể hoàn toàn tập trung vào việc viết Code. Hãy kết hợp CI/CD cùng với **Docker** (như bài viết trước mình đã hướng dẫn), bạn sẽ sở hữu một quy trình làm phần mềm chuyên nghiệp không kém gì các tập đoàn công nghệ lớn!
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
      title: "CI/CD là gì? Hướng dẫn tự động hóa quy trình Deploy Web với GitHub Actions",
      slug: "cicd-la-gi-github-actions-" + Date.now(),
      content: htmlContent,
      excerpt: "Tạm biệt những ngày tháng copy thủ công file qua FileZilla! Khám phá khái niệm CI/CD và cách dùng GitHub Actions để mỗi khi bạn nhấn Push code, website sẽ tự động cập nhật lên Server.",
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
