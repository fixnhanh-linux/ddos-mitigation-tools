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
# Hướng dẫn cài đặt Sentry: Giám sát và bắt lỗi Code (Error Tracking) thời gian thực

Khi nói về giám sát hệ thống (Monitoring), Zabbix hay Prometheus giúp bạn biết **Server có sống hay không**, còn Uptime Kuma giúp bạn biết **Web có vào được không**. Nhưng nếu Web vẫn vào được, Server vẫn khỏe, nhưng khách hàng bấm nút "Thanh toán" lại bị báo lỗi đỏ lòm trên màn hình thì sao?

Làm sao để Lập trình viên biết có lỗi xảy ra ở dòng code nào, file nào mà không cần chờ khách hàng gọi điện chửi bới? Đó là lúc bạn cần đến giải pháp Giám sát Ứng dụng (APM) và Bắt lỗi (Error Tracking). Cái tên số 1 thế giới trong mảng này chính là **Sentry**.

---

## 1. Sentry hoạt động như thế nào?

Sentry là một nền tảng mã nguồn mở chuyên đi "săn" lỗi trong code của bạn.

- **Dành cho Frontend (React, Vue, Next.js):** Nếu người dùng click vào một nút và code Javascript bị lỗi (Ví dụ: \`undefined is not an object\`), Sentry sẽ bắt được lỗi đó ngay trên trình duyệt của khách và gửi báo cáo về cho bạn.
- **Dành cho Backend (Node.js, Python, PHP):** Nếu code Backend bị nổ Exception (Lỗi 500), Sentry sẽ chụp lại toàn bộ ngữ cảnh (Tham số gửi lên là gì, chạy qua hàm nào thì chết, chết ở dòng code số mấy).
- **Gửi cảnh báo:** Tích hợp ngay lập tức với Slack, Telegram, Email để team Dev biết ngay có Bugs trên môi trường Production.

## 2. Các cách cài đặt Sentry

Sentry có 2 phiên bản:
1. **Sentry SaaS (Dịch vụ đám mây):** Miễn phí cho dự án nhỏ, cực kỳ dễ dùng, đăng ký xong là có một đoạn code gắn vào web chạy luôn.
2. **Sentry Self-Hosted:** Tự cài đặt trên Server của bạn (Miễn phí 100% không giới hạn). Tuy nhiên, kiến trúc của Sentry bao gồm hơn 30 container (Kafka, Redis, Postgres, Clickhouse...), đòi hỏi Server phải cực mạnh (Ít nhất 8GB RAM, 4 Core CPU).

Trong khuôn khổ bài viết này, để tiết kiệm tài nguyên và nhanh chóng đi vào thực chiến, chúngrow ta sẽ hướng dẫn dùng bản **Sentry SaaS (Đám mây)**.

## 3. Cài đặt và Tích hợp Sentry vào Dự án (Ví dụ Node.js / Express)

### Bước 1: Tạo dự án trên Sentry
1. Truy cập [sentry.io](https://sentry.io) và đăng ký một tài khoản miễn phí.
2. Nhấn **Create Project**.
3. Chọn nền tảng (Platform) mà bạn đang viết code. Ví dụ: Chọn **Node.js (Express)**.
4. Sentry sẽ cung cấp cho bạn một chuỗi kết nối gọi là **DSN** (Data Source Name). Nó trông giống như vầy: \`https://abcd123@o456.ingest.sentry.io/789\`

### Bước 2: Gắn code Sentry vào ứng dụng Node.js

Mở Source code của bạn lên và cài đặt thư viện của Sentry:
\`\`\`bash
npm install @sentry/node @sentry/profiling-node
\`\`\`

Trong file \`index.js\` hoặc \`app.js\` (File khởi chạy đầu tiên của server), hãy dán đoạn code cấu hình Sentry vào ngay trên cùng:

\`\`\`javascript
const express = require("express");
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const app = express();

// Khởi tạo Sentry
Sentry.init({
  dsn: "ĐIỀN_MÃ_DSN_CỦA_BẠN_VÀO_ĐÂY",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // TracesSampleRate định nghĩa tỷ lệ % request được theo dõi hiệu năng (1.0 = 100%)
  tracesSampleRate: 1.0, 
  profilesSampleRate: 1.0,
});

// Quan trọng: Bộ hứng request của Sentry phải đặt TRƯỚC mọi Route khác
Sentry.setupExpressErrorHandler(app);

// Các API của bạn
app.get("/", function rootHandler(req, res) {
  res.send("Xin chào, web đang chạy ngon lành!");
});

// Giả lập một API bị lỗi
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("LỖI RỒI CẬU ƠI! SENTRY ƠI CỨU MÌNH!!!");
});

// Chạy Server
app.listen(3000, () => {
    console.log("Server đang chạy ở port 3000");
});
\`\`\`

## 4. Tận hưởng phép thuật của Sentry

Bây giờ hãy chạy server Node.js của bạn (\`node app.js\`) và dùng trình duyệt truy cập vào đường dẫn: \`http://localhost:3000/debug-sentry\`

Server của bạn sẽ quăng ra lỗi (throw Error). Ngay lập tức, điện thoại hoặc email của bạn sẽ nhận được thông báo từ Sentry.

Mở Dashboard của Sentry trên web lên, bạn sẽ há hốc mồm vì những gì nó thu thập được:
- Lỗi xuất phát từ file nào (\`app.js\`), dòng số mấy (\`dòng 27\`).
- Khách hàng đang xài hệ điều hành gì (Windows hay Mac), trình duyệt gì (Chrome hay Safari).
- Đoạn code xung quanh khu vực bị lỗi hiển thị rõ ràng trên màn hình.

## Kết luận

Với các hệ thống hiện đại, **Log (như Loki)** là chưa đủ để debug lỗi. **Sentry** sinh ra để biến việc sửa Bug từ một cơn ác mộng mò mẫm thành một trải nghiệm "có sẵn điểm tọa độ, chỉ việc tới sửa". Nếu ứng dụng của bạn đang chạy thực tế (Production) mà chưa gắn Sentry, bạn đang nhắm mắt đi trên dây đấy!
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
      title: "Hướng dẫn cài đặt Sentry: Giám sát và bắt lỗi Code (Error Tracking) thời gian thực",
      slug: "cai-dat-sentry-giam-sat-loi-code-" + Date.now(),
      content: htmlContent,
      excerpt: "Đừng chờ khách hàng gọi điện chửi bới mới biết ứng dụng có lỗi. Cùng tìm hiểu cách cài đặt Sentry để tự động bắt và chỉ đích danh dòng code gây lỗi (Bug) ngay lập tức trên môi trường Production.",
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
