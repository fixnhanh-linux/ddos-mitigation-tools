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
# Cài đặt GoAccess trên Ubuntu/CentOS: Phân tích Truy cập Web (Nginx/Apache) Real-time cực đỉnh

Nếu bạn đang chạy một trang Web trên Nginx hoặc Apache, chắc hẳn bạn đã quen với Google Analytics. Tuy nhiên, Google Analytics có một nhược điểm chí mạng: Nó bị các trình chặn quảng cáo (Adblockers) chặn lại, và nó không thể cho bạn biết **những con Bot/Crawler nào đang càn quét và làm chậm Server của bạn**.

Để khắc phục điều đó, chúngrow ta cần một công cụ phân tích trực tiếp file \`access.log\` của Web Server. Và ứng cử viên số 1 thế giới hiện nay chính là **GoAccess** – Trình phân tích Log nhanh nhất, nhẹ nhất và đẹp nhất hiện nay.

---

## 1. GoAccess là gì?

GoAccess là một tiện ích phân tích file Log của Nginx/Apache theo thời gian thực (Real-time). Khác với các hệ thống đồ sộ như ELK Stack (Elasticsearch, Logstash, Kibana), GoAccess được viết bằng ngôn ngữ C, nên cực kỳ nhẹ và có tốc độ xử lý nhanh đến chóng mặt (hàng triệu dòng log chỉ trong vài giây).

Bạn có thể xem kết quả trực tiếp trên Terminal (giao diện đen trắng) hoặc xuất ra một file \`report.html\` cực kỳ lộng lẫy và hiện đại để xem trên trình duyệt.

## 2. Cài đặt GoAccess trên Linux

GoAccess hiện diện trên mọi kho ứng dụng chuẩn của Linux.

- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt update
  sudo apt install goaccess -y
  \`\`\`

- **Trên CentOS/RHEL/AlmaLinux:**
  \`\`\`bash
  sudo yum install epel-release -y
  sudo yum install goaccess -y
  \`\`\`

## 3. Xem báo cáo trực tiếp trên giao diện dòng lệnh (CLI)

Giả sử bạn đang dùng **Nginx** và file log của bạn nằm ở \`/var/log/nginx/access.log\`. Bạn muốn xem ngay xem ai đang truy cập vào web của mình nhiều nhất, hãy gõ lệnh:

\`\`\`bash
goaccess /var/log/nginx/access.log -c
\`\`\`

Một bảng lựa chọn định dạng Log sẽ hiện ra. Nếu bạn dùng cấu hình mặc định của Nginx/Apache, hãy dùng phím mũi tên chọn dòng **NCSA Combined Log Format** và bấm \`Enter\`.

Ngay lập tức, một giao diện đồ họa (dù đang ở Terminal) sẽ xuất hiện với hàng loạt chỉ số:
- **Unique visitors:** Số lượng người dùng duy nhất.
- **Requested Files:** Đường dẫn nào trên web đang được truy cập nhiều nhất.
- **Not Found (404s):** Những link hỏng đang bị truy cập.
- **Operating Systems / Browsers:** Hệ điều hành và Trình duyệt của khách.
- **Geo Location:** Khách hàng đến từ Quốc gia nào.

Nhấn \`q\` để thoát.

## 4. Báo cáo HTML siêu đẹp & Real-time (Thời gian thực)

Tính năng "ăn tiền" nhất của GoAccess là xuất ra định dạng HTML, kết hợp với WebSocket để **tự động cập nhật số liệu ngay trên trình duyệt mà không cần phải F5 tải lại trang**.

Hãy chạy dòng lệnh thần thánh này (đừng quên thay đường dẫn file log của bạn):

\`\`\`bash
goaccess /var/log/nginx/access.log -o /var/www/html/report.html --log-format=COMBINED --real-time-html
\`\`\`
*(Giải thích: \`-o\` là chỉ định nơi xuất file HTML. Vì xuất vào \`/var/www/html/\` nên bạn có thể truy cập nó bằng trình duyệt qua địa chỉ của máy chủ).*

**Kết quả:**
Mở trình duyệt lên và truy cập: \`http://IP_MAY_CHU_CUA_BAN/report.html\`.

Bạn sẽ ngỡ ngàng trước một giao diện Dashboard mang đậm phong cách Dark Mode hiện đại. Và tuyệt vời hơn, hãy thử mở một tab khác, F5 lại trang chủ web của bạn vài lần, sau đó quay lại trang \`report.html\`. Bạn sẽ thấy biểu đồ nhấp nháy cập nhật số liệu ngay lập tức mà không có bất kỳ độ trễ nào!

## 5. Cảnh báo bảo mật

File báo cáo \`report.html\` chứa toàn bộ thông tin nhạy cảm về traffic của bạn, bao gồm cả IP của người truy cập. Đừng để ai cũng xem được nó!

Nếu bạn dùng Nginx, hãy dùng lệnh \`htpasswd\` để cài đặt mật khẩu (Basic Auth) bảo vệ riêng cho file \`report.html\` hoặc thư mục chứa nó. Hoặc đơn giản hơn, hãy đổi tên file \`report.html\` thành một cái tên siêu bí mật kiểu như \`baocao_mat_789456.html\`.

## Kết luận

Nếu bạn là một Webmaster, bạn không thể chỉ phụ thuộc vào Google Analytics. Hãy trang bị thêm **GoAccess** ngay trên máy chủ CentOS/Ubuntu của bạn. Nó chính là hệ thống "Ra-đa" chân thực nhất giúp bạn phát hiện mọi đợt tấn công từ chối dịch vụ (DDoS) hoặc thu thập dữ liệu (Crawl) từ các con Bot tồi tệ nhất!
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
      title: "Cài đặt GoAccess trên Ubuntu/CentOS: Phân tích Log Web (Nginx/Apache) và Giám sát Truy cập Real-time",
      slug: "cai-dat-goaccess-phan-tich-log-web-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "Google Analytics không thể cho bạn biết con Bot nào đang càn quét và làm chậm Server. Hãy cài đặt GoAccess để phân tích file Log Nginx/Apache và tạo ra một Dashboard Real-time siêu mượt mà để vạch mặt thủ phạm.",
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
