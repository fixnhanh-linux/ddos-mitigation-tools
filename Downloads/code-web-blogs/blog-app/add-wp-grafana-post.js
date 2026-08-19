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
# Hướng dẫn giám sát toàn diện Server WordPress bằng Prometheus và Grafana

Với những hệ thống WordPress có lượng truy cập lớn, việc chỉ ngồi "đoán" xem server có đang bị quá tải hay không là điều vô cùng rủi ro. Thay vì thế, các SysAdmin chuyên nghiệp luôn sử dụng các hệ thống giám sát (Monitoring) để theo dõi các chỉ số theo thời gian thực (Real-time).

Và "cặp bài trùng" mã nguồn mở mạnh mẽ nhất hiện nay chính là **Prometheus** (thu thập dữ liệu) và **Grafana** (hiển thị giao diện Dashboard đẹp mắt).

Bài viết này sẽ hướng dẫn tổng quan quy trình xây dựng hệ thống giám sát cho Server WordPress của bạn.

---

## 1. Hệ sinh thái Prometheus + Grafana hoạt động như thế nào?

Hệ thống hoạt động theo mô hình Pull (Kéo dữ liệu) và bao gồm 3 thành phần chính:
- **Node Exporter (Cài trên VPS WordPress):** Đây là một công cụ nhỏ đóng vai trò "nội gián", có nhiệm vụ đọc các thông số hệ thống (CPU, RAM, Disk I/O) trên server WordPress và phơi bày nó ra một cổng (thường là Port 9100).
- **Prometheus Server (Nên cài ở một VPS độc lập):** Là máy chủ trung tâm. Cứ mỗi 15 giây, nó sẽ kết nối đến cổng 9100 của VPS WordPress để "kéo" các số liệu về và lưu trữ vào database chuỗi thời gian (Time-series database).
- **Grafana:** Là giao diện người dùng. Nó sẽ kết nối vào Prometheus Server, truy xuất các số liệu và vẽ lên những biểu đồ trực quan, sinh động.

## 2. Các chỉ số quan trọng cần giám sát cho WordPress

Không phải cứ vẽ thật nhiều biểu đồ là tốt, hãy tập trung vào các thông số cốt lõi ảnh hưởng trực tiếp đến sự sống còn của WordPress:

1. **CPU Usage (Mức sử dụng CPU):** 
   WordPress chạy bằng PHP, và PHP "ăn" CPU rất nhiều. Nếu CPU liên tục chạm đỉnh (100%), website sẽ trả về lỗi 502/503.
2. **Memory Usage (Mức sử dụng RAM):** 
   Cần theo dõi sát để đảm bảo RAM không bị cạn. Khi RAM hết, máy chủ sẽ dùng đến SWAP (ổ cứng ảo), lúc này website sẽ load chậm như rùa bò.
3. **MySQL/MariaDB Performance:** 
   Bạn nên cài đặt thêm \`mysqld_exporter\` để xem số lượng kết nối đồng thời (Connections), truy vấn chậm (Slow Queries). Database thường là "nút thắt cổ chai" (bottleneck) lớn nhất của WordPress.
4. **Disk I/O và Disk Space:** 
   Tốc độ đọc/ghi ổ cứng và tỷ lệ đầy ổ cứng. Nếu ổ đĩa đạt 100% (cả dung lượng lẫn Inodes), MariaDB sẽ tự động ngắt kết nối.

## 3. Các bước cài đặt cơ bản

*(Đây là hướng dẫn tổng quan, chi tiết từng dòng lệnh bạn nên tham khảo document chính thức).*

- **Bước 1:** Cài đặt Node Exporter lên server chứa mã nguồn WordPress.
- **Bước 2:** Cài đặt Prometheus Server (Nên dùng Docker để cài đặt nhanh chóng và sạch sẽ: \`docker run -p 9090:9090 prom/prometheus\`).
- **Bước 3:** Chỉnh sửa file \`prometheus.yml\` để trỏ IP về server WordPress (Khai báo job scrape_configs).
- **Bước 4:** Cài đặt Grafana (Cũng thông qua Docker: \`docker run -p 3000:3000 grafana/grafana\`).
- **Bước 5:** Đăng nhập vào Grafana, thêm Data Source là Prometheus.
- **Bước 6 (Quan trọng):** Đừng tự vẽ Dashboard từ đầu! Hãy vào thư viện [Grafana Dashboards](https://grafana.com/grafana/dashboards/), tìm mã số **1860** (Node Exporter Full) và Import vào Grafana của bạn. Chỉ 1 click, bạn sẽ có một bảng điều khiển hoàn hảo!

## 4. Thiết lập cảnh báo (Alerting) qua Telegram hoặc Slack

Điều tuyệt vời nhất của Grafana là khả năng tự động cảnh báo. Hãy cấu hình Alert Manager:
- **Nếu CPU > 90%** trong vòng 5 phút -> Gửi tin nhắn qua Telegram Bot.
- **Nếu RAM trống < 10%** -> Gửi thông báo khẩn qua Slack cho đội kỹ thuật.
- **Nếu Web Server bị down** -> Call webhook tự động khởi động lại service.

## Kết luận
Dù việc cài đặt ban đầu đòi hỏi chút kỹ năng về Linux, nhưng khi đã có Grafana, bạn sẽ thấy việc quản trị hệ thống nhàn nhã hơn rất nhiều. Chúc bạn xây dựng thành công "trung tâm chỉ huy" cho hệ thống website của mình!
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
      title: "Hướng dẫn giám sát toàn diện Server WordPress bằng Prometheus và Grafana",
      slug: "giam-sat-server-wordpress-prometheus-grafana-" + Date.now(),
      content: htmlContent,
      excerpt: "Làm sao để biết server của bạn đang chịu tải như thế nào? Xây dựng hệ thống giám sát (Monitoring) chuyên nghiệp bằng Prometheus và Grafana để hiển thị trực quan các thông số CPU, RAM, Disk, MySQL cho website WordPress.",
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
