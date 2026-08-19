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
# Cài đặt Grafana Loki và Promtail: Hệ thống quản lý Log tập trung siêu nhẹ

Nếu bạn đã theo dõi các bài viết trước trong chuyên mục **Giám sát**, bạn đã biết cách dùng Prometheus để đo lường các con số (Metrics) như CPU, RAM. Nhưng khi CPU tăng đột biến, làm sao để biết *phần mềm nào* đang gây ra lỗi? Đó là lúc bạn cần phải đọc **Log**.

Thay vì phải SSH vào từng con Server để gõ lệnh \`tail -f /var/log/syslog\` một cách khổ sở, hôm nay chúng ta sẽ cài đặt **Grafana Loki**. Nó giống như Prometheus, nhưng sinh ra là để gom tất cả file Log từ mọi máy chủ về một chỗ để bạn dễ dàng tìm kiếm ngay trên giao diện Grafana.

---

## 1. Hệ sinh thái Grafana Loki là gì?

Giống hệt như cách Prometheus hoạt động, hệ sinh thái quản lý Log của Grafana cũng chia làm 3 phần:
1. **Promtail (Giống Node Exporter):** Sẽ được cài trên các máy chủ con. Nhiệm vụ của nó là đọc các file log (nginx.log, syslog, error.log...) và gửi liên tục về máy chủ trung tâm.
2. **Loki (Giống Prometheus):** Máy chủ trung tâm lưu trữ tất cả các dòng log mà Promtail gửi về. Điểm đặc biệt của Loki là nó *rất nhẹ*, vì nó không index (lập chỉ mục) toàn bộ văn bản log, nó chỉ index các nhãn (labels).
3. **Grafana:** Giao diện hiển thị. Bạn có thể mở Grafana lên và gõ lệnh để lọc log y như tìm kiếm Google.

## 2. Triển khai Loki và Promtail bằng Docker Compose

Cách nhanh nhất để trải nghiệm Loki là sử dụng Docker. Hãy tạo (hoặc bổ sung vào) file \`docker-compose.yml\` của bạn:

\`\`\`yaml
version: "3.8"

services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log # Đọc log của toàn bộ hệ thống (Linux)
      - ./promtail-config.yaml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
\`\`\`

## 3. Các file cấu hình cần thiết

Bạn cần tạo 2 file cấu hình đặt cùng thư mục với file \`docker-compose.yml\`.

**File 1: \`loki-config.yaml\` (Cấu hình cho Loki)**
\`\`\`yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 15m

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/index
    cache_location: /tmp/loki/boltdb-cache
  filesystem:
    directory: /tmp/loki/chunks
\`\`\`

**File 2: \`promtail-config.yaml\` (Cấu hình cho Promtail đi "thu gom" log)**
\`\`\`yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml # Ghi nhớ dòng log đang đọc dở

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
    - targets:
        - localhost
      labels:
        job: varlogs # Đặt tên nhóm log
        __path__: /var/log/*log # Đọc tất cả file có đuôi .log trong /var/log
\`\`\`

Sau đó chạy lệnh khởi động: \`docker-compose up -d\`

## 4. Xem Log trên giao diện Grafana

Bây giờ Loki và Promtail đã chạy, Log hệ thống của bạn đang được bơm liên tục vào Loki.

1. Đăng nhập vào Grafana của bạn (Truy cập cổng 3000).
2. Vào **Connections > Data Sources > Add data source**.
3. Chọn **Loki**. Ở mục URL, nhập \`http://loki:3100\` rồi bấm **Save & Test**.
4. Chuyển sang menu **Explore** (biểu tượng la bàn) ở thanh công cụ bên trái.
5. Chọn Data source là Loki. Bạn sẽ thấy một ô nhập lệnh. Hãy nhập:
   \`\`\`text
   {job="varlogs"}
   \`\`\`
   Rồi bấm **Run query**.

Ngay lập tức, bạn sẽ thấy toàn bộ Log của hệ thống cuộn lên màn hình giống hệt như bộ phim Ma trận. Bạn có thể dễ dàng lọc tìm các lỗi bằng cú pháp siêu việt (LogQL) ví dụ như:
\`\`\`text
{job="varlogs"} |= "error"
\`\`\`
Lệnh này sẽ lọc ra tất cả các dòng log có chứa chữ "error".

## Kết luận

Với sự kết hợp hoàn hảo của **Prometheus (Metrics)**, **Alertmanager (Cảnh báo)** và **Loki (Logs)**, bạn đã chính thức hoàn thiện một hệ thống **Observability (Khả năng quan sát)** hiện đại bậc nhất. Bất cứ khi nào máy chủ xảy ra sự cố, bạn đã có đầy đủ vũ khí để tìm ra nguyên nhân tận gốc chỉ trong vài cú click chuột!
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
      title: "Cài đặt Grafana Loki và Promtail: Hệ thống quản lý Log tập trung siêu nhẹ",
      slug: "cai-dat-grafana-loki-promtail-log-" + Date.now(),
      content: htmlContent,
      excerpt: "Chấm dứt chuỗi ngày phải SSH vào từng Server để mò mẫm đọc Log. Cùng cài đặt Grafana Loki để gom tất cả Log về một chỗ, tìm kiếm và phân tích lỗi dễ dàng như Google.",
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
