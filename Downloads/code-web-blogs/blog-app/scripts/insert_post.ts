import mongoose from "mongoose";
import fs from "fs";
const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

import Post from "../src/models/Post";
import User from "../src/models/User";
import Category from "../src/models/Category";

const content = `PostgreSQL là một trong những hệ quản trị cơ sở dữ liệu quan hệ mã nguồn mở mạnh mẽ nhất hiện nay. Tuy nhiên, khi hệ thống phình to, việc theo dõi hiệu suất (performance), các truy vấn chậm (slow queries), tình trạng khóa (locks) và tài nguyên tiêu thụ trở nên cực kỳ cấp thiết. 

Trong bài viết này, mình sẽ hướng dẫn các bạn xây dựng một hệ thống giám sát (Monitoring) PostgreSQL đạt chuẩn Enterprise sử dụng bộ ba hoàn hảo: **Postgres Exporter + Prometheus + Grafana**.

---

## 1. Kiến trúc tổng quan

Kiến trúc giám sát của chúng ta sẽ hoạt động theo mô hình *Pull-based* như sau:
1. **Postgres_exporter**: Là một service chạy song song với PostgreSQL, làm nhiệm vụ kết nối vào DB, thu thập các chỉ số (metrics) và phơi bày (expose) chúng ra một cổng HTTP.
2. **Prometheus**: Sẽ định kỳ quét (scrape) cổng HTTP của exporter để kéo dữ liệu về và lưu trữ dưới dạng Time-series Database.
3. **Grafana**: Kết nối với Prometheus để vẽ biểu đồ trực quan, thiết lập cảnh báo (Alert) qua Telegram/Slack khi DB có sự cố.

---

## 2. Cài đặt Postgres Exporter

Đầu tiên, chúng ta cần tạo một user chuyên dụng trong PostgreSQL để exporter có thể đọc các bảng hệ thống (pg_stat_activity, pg_stat_statements...).

Truy cập vào PostgreSQL:
\`\`\`sql
sudo -u postgres psql
\`\`\`

Chạy các lệnh sau để tạo user và cấp quyền:
\`\`\`sql
CREATE USER postgres_exporter WITH PASSWORD 'your_secure_password';
ALTER USER postgres_exporter SET SEARCH_PATH TO postgres_exporter,pg_catalog;

-- Cấp quyền đọc các view hệ thống
GRANT CONNECT ON DATABASE postgres TO postgres_exporter;
GRANT pg_read_all_settings TO postgres_exporter;
GRANT pg_read_all_stats TO postgres_exporter;
\`\`\`

Tải và chạy **Postgres Exporter** bằng Docker (khuyến nghị cho môi trường hiện đại):
\`\`\`bash
docker run -d \\
  --name postgres_exporter \\
  --restart always \\
  --network host \\
  -e DATA_SOURCE_NAME="postgresql://postgres_exporter:your_secure_password@localhost:5432/postgres?sslmode=disable" \\
  quay.io/prometheuscommunity/postgres-exporter
\`\`\`
*Lưu ý: Đảm bảo thay đổi mật khẩu và địa chỉ IP sao cho khớp với môi trường của bạn. Exporter sẽ lắng nghe ở cổng mặc định là \`9187\`.*

---

## 3. Cấu hình Prometheus

Sau khi Exporter đã chạy và đẩy metrics ra cổng 9187, ta cần cấu hình để Prometheus biết và đến lấy dữ liệu.

Mở file \`prometheus.yml\` của bạn lên và thêm một job mới vào phần \`scrape_configs\`:

\`\`\`yaml
scrape_configs:
  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:9187'] # Đổi localhost thành IP của Postgres server nếu chạy khác máy
        labels:
          instance: 'production-db'
\`\`\`

Sau khi lưu file, hãy khởi động lại Prometheus:
\`\`\`bash
sudo systemctl restart prometheus
\`\`\`
Kiểm tra trên giao diện Web của Prometheus (\`http://<IP>:9090/targets\`), nếu thấy job \`postgresql\` chuyển sang trạng thái **UP** màu xanh lá là thành công!

---

## 4. Tích hợp Grafana Dashboard

Đây là bước hấp dẫn nhất. Chúng ta không cần phải tự vẽ từng biểu đồ vì cộng đồng đã xây dựng sẵn những Dashboard cực kỳ chất lượng.

1. Đăng nhập vào giao diện Grafana.
2. Chọn biểu tượng dấu **+** ở thanh menu trái -> Chọn **Import**.
3. Tại ô *Import via grafana.com*, bạn nhập ID của Dashboard là: **9628** (Đây là Dashboard *PostgreSQL Database* nổi tiếng nhất) hoặc **14114** (PostgreSQL Database - chi tiết hơn).
4. Nhấn **Load**.
5. Ở mục tùy chọn dữ liệu (Data Source), hãy chọn **Prometheus** mà bạn đã cài đặt.
6. Nhấn **Import**.

Bùm! Ngay lập tức bạn sẽ thấy một bảng điều khiển cực kỳ chuyên nghiệp hiện ra.

### Các chỉ số quan trọng cần lưu ý trên Dashboard:
- **Active Connections:** Số lượng kết nối đang mở. Nếu con số này chạm ngưỡng \`max_connections\`, database sẽ từ chối truy vấn mới.
- **Cache Hit Ratio:** Tỷ lệ truy vấn lấy dữ liệu trực tiếp từ RAM thay vì ổ cứng. Con số lý tưởng là > 95%. Nếu thấp hơn, bạn cần tăng \`shared_buffers\`.
- **Transactions / Deadlocks:** Số lượng giao dịch và các xung đột khóa.
- **Tuples Fetched/Returned:** Chỉ số này giúp bạn biết DB đang phải quét bao nhiêu dòng dữ liệu, từ đó có kế hoạch đánh Index phù hợp.

---

## 5. Cài đặt Cảnh báo (Alerting) cơ bản

Để hệ thống chủ động thông báo khi có lỗi, bạn có thể thiết lập Alert Rules trên Grafana hoặc Prometheus. Dưới đây là rule cảnh báo khi Database bị down (không thể kết nối):

\`\`\`yaml
groups:
- name: PostgreSQL_Alerts
  rules:
  - alert: PostgresDown
    expr: pg_up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "PostgreSQL Database đang bị DOWN trên {{ $labels.instance }}"
      description: "Postgres exporter không thể kết nối tới DB. Vui lòng kiểm tra ngay!"
\`\`\`

## Tổng kết
Việc giám sát PostgreSQL là yêu cầu bắt buộc đối với bất kỳ hệ thống backend nào khi đưa ra Production. Bằng việc kết hợp Prometheus và Grafana, bạn không chỉ có một giao diện tuyệt đẹp để khoe với sếp, mà còn có khả năng nhìn thấu "nội tạng" của Database để phát hiện và xử lý sự cố từ sớm.

Chúc các bạn cài đặt thành công! Nếu có lỗi ở bước nào, hãy để lại bình luận phía dưới nhé.`;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to DB");
    
    const admin = await User.findOne({ role: "admin" });
    if (!admin) throw new Error("No admin found");

    let category = await Category.findOne({ slug: "he-thong-giam-sat" });
    if (!category) {
      category = await Category.create({ name: "Hệ thống & Giám sát", slug: "he-thong-giam-sat", description: "Giám sát hệ thống", color: "#3498db" });
    }
    
    const existing = await Post.findOne({ slug: "giam-sat-postgresql-prometheus-grafana" });
    if (existing) {
        await Post.deleteOne({ _id: existing._id });
    }

    const post = await Post.create({
      title: "Cài đặt hệ thống giám sát PostgreSQL chuyên sâu với Prometheus & Grafana",
      slug: "giam-sat-postgresql-prometheus-grafana",
      excerpt: "Hướng dẫn chi tiết từng bước xây dựng hệ thống Monitoring toàn diện cho PostgreSQL Database sử dụng kiến trúc Postgres Exporter, Prometheus và hiển thị trực quan thông qua Grafana Dashboard.",
      content: content,
      author: admin._id,
      category: category._id,
      tags: ["PostgreSQL", "Grafana", "Prometheus", "Monitoring", "Database"],
      status: "published",
      published: true,
      publishedAt: new Date(),
      isPremium: false,
      coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
    });
    
    console.log("Created post:", post.slug);
  } catch (error) {
      console.error(error);
  } finally {
      process.exit(0);
  }
}
run();
