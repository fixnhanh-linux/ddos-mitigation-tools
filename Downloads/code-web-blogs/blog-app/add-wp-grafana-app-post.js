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
# Hướng dẫn giám sát sâu bên trong mã nguồn WordPress (Application Level) với Grafana

Nếu bạn chỉ cài Node Exporter, bạn sẽ chỉ thấy CPU hay RAM của Server bị đầy, nhưng bạn sẽ **không bao giờ biết được** Plugin nào hay dòng code nào trong WordPress đang là "thủ phạm" ngốn tài nguyên.

Để giải quyết bài toán đó, chúng ta cần giám sát sâu vào **bên trong mã nguồn (Application-Level Monitoring)** của WordPress và đẩy các số liệu (metrics) đó ra cho Prometheus và Grafana đọc.

Dưới đây là các phương pháp tối ưu nhất để thực hiện việc này.

---

## 1. Sử dụng Plugin "Prometheus Exporter" cho WordPress

Đây là cách đơn giản và trực tiếp nhất để mang dữ liệu từ bên trong WordPress ra ngoài. Plugin này sẽ tạo ra một endpoint (thường là \`/wp-json/prometheus/v1/metrics\`) phơi bày các thông số chuẩn xác theo format của Prometheus.

**Những gì bạn có thể giám sát được từ Plugin này:**
- **Thống kê nội dung:** Tổng số bài viết (Published, Draft), số lượng Bình luận (Approved, Spam).
- **Thống kê người dùng:** Số lượng User đang hoạt động, chia theo các quyền (Role).
- **Hiệu năng PHP & Database:** Thời gian thực thi trang (Page Generation Time), số lượng câu lệnh SQL (DB Queries) cho mỗi lần load trang.
- **Dung lượng:** Kích thước của thư mục \`wp-content/uploads\`.

**Cách triển khai:**
1. Cài đặt plugin [WP Prometheus Exporter](https://wordpress.org/plugins/wp-prometheus-exporter/) từ kho của WordPress.
2. Vào Settings, lấy đường dẫn Endpoint và Secret Token (để bảo mật, tránh bị người lạ đọc trộm thông số).
3. Mở file \`prometheus.yml\` trên server Prometheus và thêm một \`scrape_config\`:
\`\`\`yaml
  - job_name: 'wordpress_app'
    metrics_path: '/wp-json/prometheus/v1/metrics'
    params:
      token: ['YOUR_SECRET_TOKEN']
    static_configs:
      - targets: ['yoursite.com']
\`\`\`
4. Truy cập Grafana, tạo Dashboard và sử dụng ngôn ngữ PromQL (ví dụ: \`wp_posts_total\`, \`wp_db_queries\`) để vẽ biểu đồ!

## 2. Giám sát truy vấn (Queries) và Hooks bằng Code Tùy Chỉnh

Nếu bạn là Developer và muốn biết chính xác hàm (function) nào chạy chậm, bạn có thể tự viết code đẩy metrics.

Trong file \`functions.php\`, bạn có thể dùng các Hooks của WordPress để đo đạc thời gian:

\`\`\`php
add_action('init', 'start_custom_timer');
function start_custom_timer() {
    global $custom_timer_start;
    $custom_timer_start = microtime(true);
}

add_action('wp_footer', 'end_custom_timer');
function end_custom_timer() {
    global $custom_timer_start;
    $execution_time = microtime(true) - $custom_timer_start;
    
    // Ở đây bạn có thể dùng thư viện Prometheus PHP client 
    // hoặc lưu vào Redis/Log để Prometheus Pushgateway thu thập
    error_log("Thời gian thực thi trang: " . $execution_time . " giây");
}
\`\`\`

## 3. Nâng cấp lên APM (Application Performance Monitoring) thực thụ

Nếu Prometheus + Grafana đòi hỏi bạn phải tự cấu hình Dashboard quá nhiều, và bạn muốn "soi" sâu đến tận từng hàm PHP bị chậm (Stack Trace), thì bạn nên tích hợp hệ thống APM.

Mặc dù không phải thuần Grafana, nhưng các SysAdmin thường kết hợp Grafana (cho Server) và một công cụ APM (cho Code):
- **New Relic APM:** Có sẵn Extension cho PHP. Khi cài vào VPS, nó sẽ tự động chui vào mã nguồn WordPress, vẽ ra biểu đồ cho thấy Plugin A chiếm bao nhiêu % thời gian load trang, Theme B gọi ra câu lệnh SQL nào chậm nhất.
- **Datadog APM:** Tương tự New Relic, cực kỳ chi tiết đến từng dòng code PHP.

## Kết luận

Để tối ưu hóa toàn diện, bạn nên chạy song song: **Node Exporter (Cho Server)** + **WP Prometheus Exporter (Cho WordPress Data)**. 

Bằng cách đưa cả 2 luồng dữ liệu này lên cùng một bảng điều khiển Grafana, bạn sẽ dễ dàng nhận ra quy luật: *"À, mỗi lần CPU tăng vọt lúc 9h sáng là do lượng truy vấn SQL từ Plugin ABC đột ngột tăng cao!"*. Từ đó, việc bắt bệnh và fix lỗi sẽ trở nên dễ dàng hơn bao giờ hết.
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
      title: "Hướng dẫn giám sát sâu bên trong mã nguồn WordPress (Application Level) với Grafana",
      slug: "giam-sat-application-wordpress-grafana-" + Date.now(),
      content: htmlContent,
      excerpt: "Giám sát server là chưa đủ! Để biết chính xác truy vấn database nào đang làm chậm web, hay có bao nhiêu bài viết/bình luận mới, bạn cần giám sát sâu vào bên trong mã nguồn (Application Level) của WordPress và đưa lên Grafana.",
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
