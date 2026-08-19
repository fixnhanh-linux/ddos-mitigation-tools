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
# Zabbix vs Prometheus: Cuộc chiến của hai gã khổng lồ Monitoring

Khi bắt tay vào xây dựng hệ thống giám sát (Monitoring) cho hạ tầng công nghệ thông tin, một trong những câu hỏi kinh điển nhất mà các kỹ sư DevOps / SysAdmin phải đối mặt là: **"Nên xài Zabbix hay Prometheus?"**

Cả hai đều là những công cụ mã nguồn mở hàng đầu, hoàn toàn miễn phí nhưng lại có triết lý thiết kế và mục tiêu hoàn toàn trái ngược nhau. Bài viết này sẽ mổ xẻ chi tiết ưu và nhược điểm của từng bên.

---

## 1. Zabbix: Tượng đài "Bao thầu tất cả" (All-in-one)

Được ra mắt từ năm 2001, Zabbix là một trong những công cụ giám sát lâu đời và phổ biến nhất trong các doanh nghiệp truyền thống (Ngân hàng, Viễn thông, Công ty sản xuất).

### Ưu điểm của Zabbix
- **Tất cả trong một (All-in-one):** Zabbix có sẵn mọi thứ: Từ thu thập dữ liệu (Zabbix Agent), máy chủ lưu trữ (Zabbix Server), giao diện hiển thị (Web Frontend) cho đến hệ thống cảnh báo (Alerting). Cài một cục là có đủ xài.
- **Dễ dùng cho người không biết code:** Giao diện web của Zabbix cho phép bạn click chuột để thiết lập cảnh báo, thêm máy chủ mà không cần viết các file cấu hình YAML phức tạp.
- **Giám sát thiết bị vật lý cực tốt:** Zabbix hỗ trợ giao thức SNMP rất mạnh, giúp nó dễ dàng "nói chuyện" với các thiết bị mạng truyền thống như Router Cisco, Switch, Máy in, hay UPS.

### Nhược điểm của Zabbix
- **Hiệu suất lưu trữ (Database Bottleneck):** Zabbix lưu dữ liệu vào cơ sở dữ liệu quan hệ (MySQL hoặc PostgreSQL). Khi bạn có hàng ngàn máy chủ, database sẽ phình to khủng khiếp, truy vấn sẽ trở nên cực kỳ chậm chạp.
- **Nặng nề:** Quá trình cài đặt và duy trì Zabbix Server đòi hỏi khá nhiều tài nguyên (RAM, CPU).

## 2. Prometheus: Kẻ thống trị kỷ nguyên Cloud Native

Được sinh ra tại SoundCloud và sau đó tặng cho quỹ CNCF (cùng nhà với Kubernetes), Prometheus đại diện cho thế hệ giám sát hiện đại.

### Ưu điểm của Prometheus
- **Cơ sở dữ liệu Time-Series siêu tốc:** Prometheus tự xây dựng database riêng tối ưu cho dữ liệu dạng chuỗi thời gian (TSDB). Nó có thể ghi hàng triệu điểm dữ liệu mỗi giây mà không cần một cụm MySQL khổng lồ.
- **Mô hình Pull (Kéo):** Thay vì bắt các máy chủ con (Agent) phải đẩy dữ liệu lên trung tâm, Prometheus sẽ tự đi gõ cửa từng máy chủ để "kéo" dữ liệu về. Nhờ vậy, nếu một máy chủ bị sập mạng, Prometheus sẽ biết ngay lập tức (vì kéo không được).
- **Tích hợp hoàn hảo với Kubernetes:** Prometheus và Kubernetes sinh ra là để dành cho nhau. Prometheus tự động phát hiện (Service Discovery) các Container mới được K8s tạo ra và đưa vào danh sách giám sát trong chớp mắt.
- **Ngôn ngữ truy vấn mạnh mẽ (PromQL):** Bạn có thể viết các câu lệnh toán học phức tạp để tính toán (Ví dụ: Tính % CPU tăng trưởng trung bình trong 5 phút qua).

### Nhược điểm của Prometheus
- **Chỉ làm đúng một việc:** Prometheus không tự vẽ biểu đồ đẹp được (phải dùng chung với **Grafana**), và cũng không tự đi thu thập dữ liệu phần cứng được (phải cài thêm **Node Exporter**).
- **Khó học:** Phải viết các file cấu hình bằng mã lệnh, phải học cú pháp PromQL. Không phù hợp với người dùng thích giao diện "Click & Point".

## 3. Tổng kết: Bạn thuộc phe nào?

Không có công cụ nào hoàn hảo, chỉ có công cụ phù hợp với hạ tầng của bạn.

**Hãy chọn Zabbix nếu:**
- Hệ thống của bạn chủ yếu là máy chủ vật lý, VPS truyền thống, Router, Switch.
- Bạn cần một giải pháp "cài phát ăn ngay", có sẵn giao diện dễ dùng để bàn giao cho đội ngũ IT Helpdesk không rành về code.
- Công ty của bạn muốn lưu trữ dữ liệu lịch sử trong nhiều năm trời (Zabbix + PostgreSQL làm việc này tốt hơn).

**Hãy chọn Prometheus nếu:**
- Hệ thống của bạn chạy trên Docker, Kubernetes hoặc Cloud.
- Máy chủ và Container của bạn được bật/tắt liên tục (Auto-scaling).
- Bạn đang xây dựng một đội ngũ DevOps chuyên nghiệp và muốn tích hợp sâu với **Grafana** để tạo ra các Dashboard lộng lẫy.
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // 1. Get User
    let user = await User.findOne({});
    let authorId;
    if (user) {
      authorId = user._id;
    } else {
      console.log("No user found. Creating dummy user...");
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    // 2. Find or Create Category
    let category = await Category.findOne({ slug: "giam-sat" });
    if (!category) {
      category = await Category.create({
        name: "Giám sát",
        slug: "giam-sat",
        description: "Chuyên mục Giám sát và Vận hành Hệ thống"
      });
      console.log("Created new category 'Giám sát'");
    } else {
      console.log("Found existing category 'Giám sát'");
    }
    const catId = category._id;

    // 3. Update previous monitoring post (if exists)
    const oldPost = await Post.findOneAndUpdate(
      { slug: { $regex: /giam-sat-may-chu-prometheus-grafana/ } },
      { $set: { category: catId } },
      { new: true }
    );
    if (oldPost) {
      console.log("Updated category for old post:", oldPost.title);
    }
    
    const oldPost2 = await Post.findOneAndUpdate(
      { slug: { $regex: /giam-sat-application-wordpress/ } },
      { $set: { category: catId } },
      { new: true }
    );
    if (oldPost2) {
      console.log("Updated category for old post 2:", oldPost2.title);
    }

    // 4. Create new post
    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Zabbix vs Prometheus: Cuộc chiến của hai gã khổng lồ Monitoring",
      slug: "zabbix-vs-prometheus-so-sanh-" + Date.now(),
      content: htmlContent,
      excerpt: "Nên chọn Zabbix truyền thống, mạnh mẽ hay Prometheus hiện đại, sinh ra cho Cloud? Cùng so sánh chi tiết ưu nhược điểm để tìm ra giải pháp giám sát phù hợp nhất cho hệ thống của bạn.",
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
