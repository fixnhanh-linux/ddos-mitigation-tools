const mongoose = require("mongoose");

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

const content = `
# Hướng dẫn cài đặt Grafana Alloy và Giám sát PostgreSQL

Grafana Alloy là một công cụ thu thập telemetry (metrics, logs, traces, profiles) mã nguồn mở, mạnh mẽ và linh hoạt. Nó có thể được sử dụng để thu thập dữ liệu từ nhiều nguồn khác nhau, bao gồm cả cơ sở dữ liệu PostgreSQL, và gửi dữ liệu đó đến Grafana, Prometheus hoặc các hệ thống giám sát khác.

Bài viết này sẽ hướng dẫn bạn cách cài đặt Grafana Alloy và cấu hình nó để giám sát một máy chủ PostgreSQL.

## 1. Yêu cầu hệ thống

*   Một máy chủ Linux (ví dụ: Ubuntu/Debian) hoặc Windows/macOS. Trong hướng dẫn này, chúng ta sẽ sử dụng Ubuntu.
*   Máy chủ PostgreSQL đã được cài đặt và đang chạy.
*   Quyền truy cập root hoặc sudo trên máy chủ.
*   (Tùy chọn) Máy chủ Grafana / Prometheus để nhận và hiển thị dữ liệu.

## 2. Cài đặt Grafana Alloy

Bạn có thể cài đặt Grafana Alloy thông qua trình quản lý gói (như APT hoặc YUM), sử dụng file nhị phân (binary), hoặc chạy dưới dạng Docker container. Dưới đây là hướng dẫn cài đặt qua APT trên Ubuntu/Debian.

### Thêm kho lưu trữ Grafana

1. Cài đặt các gói cần thiết:
   \`\`\`bash
   sudo apt-get install -y apt-transport-https software-properties-common wget
   \`\`\`

2. Thêm khóa GPG của Grafana:
   \`\`\`bash
   sudo mkdir -p /etc/apt/keyrings/
   wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
   \`\`\`

3. Thêm kho lưu trữ Grafana:
   \`\`\`bash
   echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
   \`\`\`

### Cài đặt Alloy

1. Cập nhật danh sách gói và cài đặt Alloy:
   \`\`\`bash
   sudo apt-get update
   sudo apt-get install -y alloy
   \`\`\`

2. Kích hoạt và khởi động dịch vụ Alloy:
   \`\`\`bash
   sudo systemctl enable alloy
   sudo systemctl start alloy
   \`\`\`

3. Kiểm tra trạng thái của Alloy:
   \`\`\`bash
   sudo systemctl status alloy
   \`\`\`

## 3. Cấu hình PostgreSQL để giám sát

Để Grafana Alloy có thể thu thập các metrics từ PostgreSQL (sử dụng exporter tích hợp sẵn), bạn cần tạo một user trong cơ sở dữ liệu với quyền đọc thích hợp.

1. Đăng nhập vào PostgreSQL dưới quyền người dùng \`postgres\`:
   \`\`\`bash
   sudo -u postgres psql
   \`\`\`

2. Tạo một user mới (ví dụ: \`alloy_monitor\`) với mật khẩu an toàn:
   \`\`\`sql
   CREATE USER alloy_monitor WITH PASSWORD 'your_secure_password';
   \`\`\`

3. Gán quyền \`pg_monitor\` cho user mới (cần thiết trên PostgreSQL 10 trở lên):
   \`\`\`sql
   GRANT pg_monitor TO alloy_monitor;
   \`\`\`

   *(Lưu ý: Nếu bạn sử dụng PostgreSQL cũ hơn, bạn có thể phải cấp quyền \`SELECT\` trên các bảng và view hệ thống một cách thủ công).*

4. Thoát khỏi psql:
   \`\`\`sql
   \\q
   \`\`\`

## 4. Cấu hình Grafana Alloy giám sát PostgreSQL

File cấu hình chính của Grafana Alloy thường nằm ở \`/etc/alloy/config.alloy\`. Grafana Alloy sử dụng ngôn ngữ cấu hình riêng (Alloy config language, dựa trên HCL).

1. Mở file cấu hình để chỉnh sửa:
   \`\`\`bash
   sudo nano /etc/alloy/config.alloy
   \`\`\`

2. Cấu hình thành phần \`prometheus.exporter.postgres\` để kết nối đến PostgreSQL và thu thập metrics, sau đó sử dụng \`prometheus.scrape\` để scrape metrics từ exporter đó và \`prometheus.remote_write\` để gửi đến Prometheus hoặc Grafana Cloud.

   Thêm đoạn cấu hình sau vào file:

   \`\`\`alloy
   // Cấu hình PostgreSQL Exporter
   prometheus.exporter.postgres "local_pg" {
     data_source_names = ["postgresql://alloy_monitor:your_secure_password@localhost:5432/postgres?sslmode=disable"]
   }

   // Scrape metrics từ PostgreSQL Exporter
   prometheus.scrape "postgres_metrics" {
     targets    = prometheus.exporter.postgres.local_pg.targets
     forward_to = [prometheus.remote_write.default.receiver]
     scrape_interval = "15s"
   }

   // Gửi metrics đến hệ thống lưu trữ (ví dụ: Prometheus nội bộ hoặc Grafana Cloud)
   prometheus.remote_write "default" {
     endpoint {
       url = "http://<prometheus-server-ip>:9090/api/v1/write"
       
       // Nếu bạn sử dụng Grafana Cloud, bạn cần cấu hình basic_auth
       // basic_auth {
       //   username = "<your_grafana_cloud_username>"
       //   password = "<your_grafana_cloud_api_key>"
       // }
     }
   }
   \`\`\`

   **Lưu ý quan trọng:**
   * Thay thế \`your_secure_password\` bằng mật khẩu bạn đã tạo ở bước 3.
   * Thay thế URL trong \`prometheus.remote_write\` bằng địa chỉ máy chủ Prometheus thực tế của bạn. Nếu bạn chưa có Prometheus, bạn có thể đẩy thẳng lên Grafana Cloud.

3. Lưu file và khởi động lại dịch vụ Alloy để áp dụng cấu hình:
   \`\`\`bash
   sudo systemctl restart alloy
   \`\`\`

4. Kiểm tra log của Alloy để đảm bảo không có lỗi:
   \`\`\`bash
   sudo journalctl -u alloy -f
   \`\`\`

## 5. Trực quan hóa dữ liệu trên Grafana

Sau khi Alloy bắt đầu gửi metrics PostgreSQL lên Prometheus (hoặc Grafana Cloud), bạn có thể hiển thị chúng trên Grafana:

1. Đăng nhập vào giao diện Grafana của bạn.
2. Đảm bảo bạn đã thêm nguồn dữ liệu (Data Source) Prometheus mà Alloy đang gửi dữ liệu tới.
3. Tạo một Dashboard mới hoặc nhập (Import) một Dashboard có sẵn. Bạn có thể tìm các dashboard mẫu tuyệt vời cho PostgreSQL trên trang [Grafana Dashboards](https://grafana.com/grafana/dashboards/).
   * Một dashboard phổ biến cho PostgreSQL Exporter có ID là \`9628\` (PostgreSQL Database).
4. Khi Import Dashboard, chọn Data Source Prometheus của bạn và bạn sẽ thấy các biểu đồ giám sát hiệu suất cơ sở dữ liệu PostgreSQL hiển thị!

---
**Chúc mừng!** Bạn đã cài đặt thành công Grafana Alloy và sử dụng nó để giám sát cơ sở dữ liệu PostgreSQL. Grafana Alloy là một giải pháp All-in-one tuyệt vời giúp đơn giản hóa kiến trúc giám sát (observability) của bạn.
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

    const post = new Post({
      title: "Hướng dẫn cài đặt Grafana Alloy và Giám sát PostgreSQL",
      slug: "huong-dan-cai-dat-grafana-alloy-giam-sat-postgresql-" + Date.now(),
      content: content,
      excerpt: "Hướng dẫn cài đặt Grafana Alloy và cấu hình nó để giám sát một máy chủ PostgreSQL, bao gồm cả thiết lập user PostgreSQL và viết file config.alloy.",
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
