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
# Cấu hình Alertmanager cho Prometheus: Báo động qua Telegram khi Web sập

Trong các bài viết trước, chúng ta đã dựng thành công **Prometheus và Grafana** để thu thập số liệu và vẽ biểu đồ. Tuy nhiên, việc phải mở Dashboard lên liên tục để canh xem CPU có quá tải hay web có sập không là điều vô nghĩa.

Đó là lúc chúng ta cần đến **Alertmanager** – Mảnh ghép cuối cùng của hệ sinh thái Prometheus. Nó có nhiệm vụ nhận các "Báo động đỏ" từ Prometheus và bắn tin nhắn ngay lập tức qua Telegram, Slack hoặc Email cho bạn.

---

## 1. Alertmanager là gì và nó hoạt động ra sao?

Kiến trúc cảnh báo của Prometheus được chia làm hai phần rõ rệt:
1. **Prometheus Server:** Đóng vai trò là thám tử. Nó thu thập dữ liệu, đối chiếu với các "Luật cảnh báo" (Alerting Rules) do bạn đặt ra. Ví dụ: *Nếu CPU > 90% trong 5 phút, thì phát báo động*.
2. **Alertmanager:** Đóng vai trò là cái loa phát thanh. Khi nhận được báo động từ Prometheus, nó sẽ làm nhiệm vụ phân loại (Grouping), triệt tiêu các cảnh báo trùng lặp (Inhibition), và quyết định xem nên gửi tin nhắn đó cho ai, qua kênh nào (Telegram, Slack, Email).

## 2. Cài đặt và cấu hình Alertmanager bằng Docker

Nếu bạn đã chạy Prometheus bằng Docker (như bài hướng dẫn trước), hãy bổ sung thêm Alertmanager vào file \`docker-compose.yml\`:

\`\`\`yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - 9090:9090
    volumes:
      - ./prometheus:/etc/prometheus
    command:
      - --config.file=/etc/prometheus/prometheus.yml

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - 9093:9093
    volumes:
      - ./alertmanager:/etc/alertmanager
    command:
      - --config.file=/etc/alertmanager/alertmanager.yml
\`\`\`

## 3. Cấu hình Alertmanager gửi tin qua Telegram

Hãy tạo thư mục \`alertmanager\` và tạo file \`alertmanager.yml\` với nội dung sau:

\`\`\`yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'telegram_bot' # Kênh nhận mặc định

receivers:
  - name: 'telegram_bot'
    telegram_configs:
      - bot_token: 'ĐIỀN_TOKEN_CỦA_BOTFATHER_VÀO_ĐÂY'
        api_url: 'https://api.telegram.org'
        chat_id: ĐIỀN_CHAT_ID_CỦA_BẠN_VÀO_ĐÂY
        message: "{{ .CommonAnnotations.summary }}\n\n{{ .CommonAnnotations.description }}"
\`\`\`
*(Nếu chưa biết cách lấy Bot Token và Chat ID, bạn hãy xem lại bài viết Setup Zabbix Agent trước đó nhé).*

## 4. Định nghĩa "Luật cảnh báo" (Alert Rules) trên Prometheus

Alertmanager đã sẵn sàng, giờ chúng ta phải dạy cho Prometheus biết khi nào thì cần báo động.
Tạo một file có tên \`alert_rules.yml\` trong thư mục \`prometheus\`:

\`\`\`yaml
groups:
  - name: host_alerts
    rules:
      - alert: ServerDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CẢNH BÁO: Máy chủ {{ $labels.instance }} đã sập!"
          description: "Không thể kết nối đến máy chủ {{ $labels.instance }} trong hơn 1 phút qua."

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CẢNH BÁO: CPU quá tải trên {{ $labels.instance }}"
          description: "CPU của máy chủ {{ $labels.instance }} đang duy trì mức trên 85% suốt 5 phút."
\`\`\`

## 5. Kết nối tất cả lại với nhau

Cuối cùng, bạn phải mở file \`prometheus.yml\` ra và báo cho Prometheus biết: Nơi chứa Luật cảnh báo và địa chỉ của Alertmanager nằm ở đâu.

\`\`\`yaml
global:
  scrape_interval: 15s

# 1. Khai báo địa chỉ của Alertmanager
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# 2. Khai báo nơi chứa Luật cảnh báo
rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
\`\`\`

Lưu tất cả lại và chạy \`docker-compose up -d\`!

## Kết luận

Thử nghiệm rút phích cắm mạng hoặc tắt \`node-exporter\` đi, và đợi 1 phút. Điện thoại của bạn sẽ *Ting Ting* nhận được tin nhắn từ Bot Telegram báo rằng ServerDown! 

Khi hệ thống bình thường trở lại, Alertmanager cũng sẽ rất thông minh khi gửi thêm một tin nhắn thông báo rằng sự cố đã được **"Resolved"** (Đã giải quyết). Bạn đã hoàn thành một hệ thống giám sát Cloud Native chuẩn mực!
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
      title: "Cấu hình Alertmanager cho Prometheus: Báo động qua Telegram khi Web sập",
      slug: "cau-hinh-alertmanager-prometheus-telegram-" + Date.now(),
      content: htmlContent,
      excerpt: "Việc theo dõi biểu đồ trên Grafana cả ngày là vô nghĩa. Cùng tìm hiểu cách thiết lập Alertmanager để nhận tin nhắn cảnh báo qua Telegram ngay khi Server có biến.",
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
