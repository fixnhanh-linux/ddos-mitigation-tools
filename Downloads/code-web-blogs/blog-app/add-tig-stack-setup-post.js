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
# Xây dựng hệ thống giám sát TIG Stack (Telegraf, InfluxDB, Grafana) siêu việt bằng Docker

Nếu bạn đã làm quen với Prometheus, hẳn bạn đã biết sức mạnh của việc thu thập và vẽ biểu đồ giám sát. Tuy nhiên, trong thế giới DevOps, Prometheus không phải là vị vua duy nhất. Chúng ta còn có một "Kỳ phùng địch thủ" cực kỳ khét tiếng, đặc biệt được ưa chuộng trong các hệ thống IoT và tài chính: **TIG Stack**.

**TIG Stack** là sự kết hợp của 3 phần mềm: **Telegraf**, **InfluxDB** và **Grafana**. Hôm nay, chúng ta sẽ tự tay dựng hệ thống này lên Ubuntu/CentOS chỉ trong vòng 5 phút bằng Docker.

---

## 1. TIG Stack hoạt động như thế nào?

Giống như việc bạn mở một nhà hàng:
1. **Telegraf (Nhân viên phục vụ):** Là một Agent siêu nhẹ cài trên máy chủ. Nó đi vòng quanh hệ thống, thu thập mọi thông số từ CPU, RAM, Ổ cứng cho đến số lượng query MySQL, số kết nối Nginx... rồi bưng bê tất cả về kho.
2. **InfluxDB (Nhà kho cơ sở dữ liệu):** Khác với MySQL, InfluxDB là một Time-Series Database (Cơ sở dữ liệu chuỗi thời gian). Nó sinh ra chỉ để lưu trữ hàng triệu dữ liệu số (như nhiệt độ, % CPU) thay đổi liên tục theo từng giây, với tốc độ ghi (Write) khủng khiếp.
3. **Grafana (Bảng menu hiển thị):** Lấy dữ liệu từ nhà kho InfluxDB và vẽ ra những biểu đồ tuyệt đẹp để bạn chiêm ngưỡng.

*So với Prometheus (cơ chế PULL - trung tâm đi kéo dữ liệu), Telegraf dùng cơ chế PUSH (chủ động đẩy dữ liệu về trung tâm), cực kỳ phù hợp khi các máy chủ con nằm ở những mạng nội bộ khác nhau.*

## 2. Chuẩn bị file cấu hình Telegraf

Trước khi chạy Docker, chúng ta cần một file cấu hình cho Telegraf để dạy nó biết phải "thu thập" những gì.

Tạo một thư mục chứa dự án:
\`\`\`bash
mkdir -p /opt/tig-stack
cd /opt/tig-stack
\`\`\`

Sau đó, sinh ra file \`telegraf.conf\` mặc định:
\`\`\`bash
docker run --rm telegraf telegraf config > telegraf.conf
\`\`\`

## 3. Khởi chạy TIG Stack bằng Docker Compose

Ngay trong thư mục \`/opt/tig-stack\`, hãy tạo file \`docker-compose.yml\`:

\`\`\`yaml
version: '3.8'

services:
  # Nhà kho dữ liệu
  influxdb:
    image: influxdb:1.8
    container_name: influxdb
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=telegraf
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=adminpassword
      - INFLUXDB_USER=telegraf
      - INFLUXDB_USER_PASSWORD=telegrafpassword
    volumes:
      - influxdb-data:/var/lib/influxdb
    restart: always

  # Nhân viên thu thập dữ liệu (Giám sát chính máy chủ đang chạy Docker này)
  telegraf:
    image: telegraf:latest
    container_name: telegraf
    depends_on:
      - influxdb
    volumes:
      - ./telegraf.conf:/etc/telegraf/telegraf.conf:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro # Cho phép giám sát Docker
    restart: always

  # Bảng hiển thị đồ họa
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - influxdb
    restart: always

volumes:
  influxdb-data:
  grafana-data:
\`\`\`

Chạy lệnh để khởi động toàn bộ hệ thống:
\`\`\`bash
docker-compose up -d
\`\`\`

## 4. Kết nối và Vẽ biểu đồ trên Grafana

Sau khi các Container báo \`Up\`, dữ liệu đã bắt đầu được Telegraf nạp liên tục vào InfluxDB. Giờ là lúc chúng ta thưởng thức thành quả.

1. Mở trình duyệt truy cập: \`http://IP_MAY_CHU:3000\` (Đăng nhập bằng user/pass mặc định là \`admin / admin\`).
2. Vào phần **Connections -> Data Sources** và chọn **InfluxDB**.
3. Điền thông tin kết nối như sau:
   - **URL:** \`http://influxdb:8086\`
   - **Database:** \`telegraf\`
   - **User:** \`admin\`
   - **Password:** \`adminpassword\`
   - Bấm **Save & Test**. Nếu hiện thông báo "Data source is working", bạn đã kết nối thành công!

### Import Dashboard có sẵn
Telegraf có hàng ngàn Dashboard được cộng đồng chia sẻ sẵn. Thay vì tự kéo thả biểu đồ, bạn chỉ cần Import.
- Vào menu **Dashboards -> Import**.
- Nhập ID \`928\` (Đây là Dashboard kinh điển dành cho Telegraf).
- Bấm **Load**. Chọn Data source là InfluxDB vừa tạo.
- Bấm **Import**.

Bùm! Một trang tổng quan tuyệt đẹp hiển thị Tải CPU, dung lượng RAM, số lượng Process, dung lượng Ổ cứng lập tức hiện ra.

## Kết luận

**TIG Stack** là một lựa chọn cực kỳ vững chắc dành cho các hệ thống cần lưu trữ lượng dữ liệu khổng lồ (Metrics) qua nhiều năm liền. Nhờ cơ chế PUSH của Telegraf, bạn không cần phải đục lỗ Firewall (mở port) trên các máy chủ con như Node Exporter của Prometheus. Hãy thử cài đặt và cảm nhận sức mạnh của bộ 3 hoàn hảo này nhé!
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
      title: "Xây dựng hệ thống giám sát TIG Stack (Telegraf, InfluxDB, Grafana) siêu việt bằng Docker",
      slug: "cai-dat-tig-stack-telegraf-influxdb-grafana-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "Bên cạnh Prometheus, TIG Stack là bộ 3 huyền thoại không thể thiếu trong giới DevOps. Cùng tìm hiểu cách cài đặt và cấu hình Telegraf thu thập dữ liệu, lưu vào InfluxDB và vẽ đồ thị siêu đẹp trên Grafana.",
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
