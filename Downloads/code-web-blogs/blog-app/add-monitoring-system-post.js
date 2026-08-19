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
# Xây dựng hệ thống giám sát toàn diện cho Máy chủ với Prometheus và Grafana

Với tư cách là một Quản trị viên hệ thống (SysAdmin) hay Kỹ sư DevOps, câu nói đáng sợ nhất mà bạn có thể nghe là: *"Sếp ơi, hình như web sập rồi!"*. 

Nếu bạn phải đợi khách hàng hoặc sếp báo lỗi thì hệ thống giám sát (Monitoring) của bạn đã thất bại. Một hệ thống giám sát tiêu chuẩn phải có khả năng cảnh báo cho bạn biết ổ cứng sắp đầy *trước khi* nó thực sự đầy, hoặc CPU đang quá tải *trước khi* server bị treo máy.

Hôm nay, chúng ta sẽ tìm hiểu về cặp bài trùng mã nguồn mở phổ biến nhất thế giới hiện nay trong lĩnh vực Monitoring: **Prometheus** và **Grafana**.

---

## 1. Hệ sinh thái Prometheus & Grafana là gì?

Thay vì sử dụng một phần mềm "bao thầu" mọi thứ, kiến trúc hiện đại thường chia hệ thống giám sát làm 3 thành phần riêng biệt:

### A. Node Exporter (Kẻ thu thập)
Node Exporter là một phần mềm nhỏ gọn được cài đặt trên từng Máy chủ (Server/VPS) mà bạn muốn giám sát. Nhiệm vụ của nó là liên tục đo đạc các thông số phần cứng như: CPU dùng bao nhiêu %, RAM còn trống bao nhiêu GB, tốc độ đọc/ghi ổ cứng, lưu lượng mạng in/out... Sau đó, nó sẽ phơi bày các thông số này ra một đường dẫn (Endpoint) HTTP.

### B. Prometheus (Bộ não lưu trữ)
Prometheus là một cơ sở dữ liệu dạng chuỗi thời gian (Time-Series Database). Theo một chu kỳ nhất định (ví dụ cứ 15 giây 1 lần), Prometheus sẽ đi "gõ cửa" các Node Exporter để kéo (Pull) dữ liệu về và lưu trữ lại. Nhờ cơ chế Pull này, nếu một Server bị sập, Prometheus sẽ ngay lập tức nhận ra vì nó không thể kéo dữ liệu được nữa. Nó cũng kiêm luôn nhiệm vụ gửi cảnh báo (Alert) qua Telegram, Slack hoặc Email.

### C. Grafana (Bức tranh trực quan)
Đọc dữ liệu thô của Prometheus rất đau mắt. Vì vậy, **Grafana** xuất hiện đóng vai trò làm Dashboard (Bảng điều khiển). Nó sẽ kết nối vào Prometheus, lấy dữ liệu và biến chúng thành những biểu đồ màu sắc tuyệt đẹp, trực quan, giúp bạn nhìn lướt qua là biết ngay tình trạng của toàn bộ hệ thống.

## 2. Vì sao không dùng Zabbix hay Nagios?

Zabbix và Nagios từng là những tượng đài trong giới SysAdmin. Tuy nhiên:
- **Zabbix** dùng cơ sở dữ liệu quan hệ (MySQL/PostgreSQL) nên khi có quá nhiều Server, tốc độ ghi dữ liệu sẽ bị thắt cổ chai.
- **Prometheus** được thiết kế chuyên biệt cho dữ liệu dạng chuỗi thời gian (Time-Series) nên tốc độ lưu trữ nhanh hơn gấp hàng chục lần.
- **Prometheus + Grafana** là sự kết hợp hoàn hảo cho môi trường Cloud Native (Docker, Kubernetes). Các công ty công nghệ hàng đầu hầu hết đều đã chuyển sang dùng Stack này.

## 3. Hướng dẫn thiết lập nhanh (Quick Start) bằng Docker

Nếu bạn muốn trải nghiệm sức mạnh của chúng ngay bây giờ, chỉ cần một máy chủ có cài sẵn **Docker** và **Docker Compose**.

Tạo một file \`docker-compose.yml\` với nội dung sau:

\`\`\`yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - 9090:9090
    command:
      - --config.file=/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - 3000:3000
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=mat_khau_cua_ban

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - 9100:9100
\`\`\`

Bạn cần tạo thêm một file \`prometheus.yml\` cùng thư mục để cấu hình cho Prometheus biết chỗ đi kéo dữ liệu:

\`\`\`yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
\`\`\`

Sau đó chạy lệnh: \`docker-compose up -d\`

## 4. Tận hưởng thành quả

1. Mở trình duyệt và truy cập vào \`http://IP_Server:3000\` (Grafana). Đăng nhập bằng admin và mật khẩu bạn vừa đặt.
2. Thêm **Data Source** là Prometheus với URL \`http://prometheus:9090\`.
3. Vào phần Import Dashboard, nhập mã ID **1860** (Đây là một Dashboard có sẵn cực đẹp do cộng đồng làm cho Node Exporter).

Ngay lập tức, bạn sẽ thấy một bảng điều khiển xịn sò hiện ra với đầy đủ các đồng hồ đo CPU, RAM, Disk, Network đang chạy nhấp nháy theo thời gian thực!

## Kết luận

Việc xây dựng một hệ thống giám sát bằng Prometheus và Grafana giờ đây cực kỳ dễ dàng nhờ Docker. Hãy biến mình thành một Kỹ sư hệ thống chủ động: Cài đặt hệ thống này, thiết lập cảnh báo (Alert) qua Telegram, và bạn sẽ có những giấc ngủ ngon vào ban đêm mà không phải lo sợ Server bị sập bất thình lình!
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
      title: "Xây dựng hệ thống giám sát toàn diện cho Máy chủ với Prometheus và Grafana",
      slug: "giam-sat-may-chu-prometheus-grafana-" + Date.now(),
      content: htmlContent,
      excerpt: "Đừng đợi đến khi khách hàng gọi điện báo Website sập thì bạn mới biết Server có vấn đề. Cùng tìm hiểu cách thiết lập hệ thống giám sát đỉnh cao với cặp bài trùng Prometheus và Grafana.",
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
