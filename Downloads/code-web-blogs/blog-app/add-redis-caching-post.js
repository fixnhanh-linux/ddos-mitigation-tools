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
# Redis là gì? Tại sao các hệ thống lớn đều dùng nó để làm Caching?

Tiếp nối bài viết về Load Balancing (Cân bằng tải), hôm nay chúng ta sẽ giải quyết một "cổ chai" (Bottleneck) khác của hệ thống: **Cơ sở dữ liệu (Database)**.

Dù bạn có 10 con Server Web cực mạnh, nhưng tất cả đều trỏ về một con Database duy nhất (như MySQL/PostgreSQL) thì khi có 100.000 người dùng truy cập, ổ cứng của máy chủ Database sẽ "khóc thét" vì phải đọc dữ liệu quá nhiều. Giải pháp ở đây là gì? Đó chính là **Caching** với **Redis**.

---

## 1. Vấn đề của Database Truyền thống

Các cơ sở dữ liệu quan hệ như MySQL hay SQL Server lưu trữ dữ liệu trên **Ổ cứng (Disk/SSD)**. 
Mỗi lần người dùng vào trang chủ, hệ thống phải gửi một câu truy vấn (Query) \`SELECT * FROM products\` xuống Database. 
Database phải lục lọi trong ổ cứng để tìm danh sách sản phẩm rồi mới trả về. Quá trình này diễn ra khá chậm (tính bằng mili-giây, nhưng dồn lại 100 ngàn lần thì sẽ thành thảm họa).

Đặc biệt là với trang chủ của một web bán hàng, 100 ngàn người vào xem thì kết quả trả về **đều giống hệt nhau** (đều là danh sách 10 sản phẩm mới nhất). Việc bắt Database phải lục ổ cứng 100 ngàn lần cho cùng một kết quả là vô cùng lãng phí.

## 2. Redis là gì và nó giải quyết vấn đề thế nào?

**Redis** (Remote Dictionary Server) là một cơ sở dữ liệu phi quan hệ (NoSQL), nhưng điểm đặc biệt nhất của nó là: **Nó lưu dữ liệu trên RAM (Bộ nhớ trong) thay vì Ổ cứng**.

Tốc độ đọc/ghi của RAM nhanh hơn Ổ cứng SSD hàng chục cho tới hàng trăm lần. Redis lưu dữ liệu dưới dạng **Key-Value** (Chìa khóa - Ổ khóa), cực kỳ đơn giản và siêu tốc.

### Cơ chế Caching hoạt động ra sao?

1. Khách hàng A truy cập trang chủ.
2. Server Web hỏi **Redis**: *"Ê, mài có danh sách sản phẩm trang chủ không?"*
3. Redis tìm trong RAM: *"Chưa có!"* (Gọi là Cache Miss).
4. Server Web đành ngậm ngùi xuống hỏi **MySQL**. MySQL lục ổ cứng, trả về danh sách sản phẩm mất **100ms**.
5. Server Web lấy kết quả đó, **nhét vào Redis** (Save to Cache) với kỳ hạn là 5 phút, sau đó trả kết quả cho Khách hàng A.
6. 1 giây sau, Khách hàng B, C, D (và 99 ngàn người khác) truy cập trang chủ.
7. Server Web lại hỏi **Redis**. Lần này Redis đáp ngay: *"Có sẵn đây, lấy luôn đi!"* (Gọi là Cache Hit). Tốc độ trả về chỉ mất **1ms**!

Tuyệt vời! MySQL ở dưới đã được cứu rỗi, nó hoàn toàn thảnh thơi trong suốt 5 phút đó để dành sức xử lý các tác vụ quan trọng khác (như tạo Đơn hàng, thanh toán tiền).

## 3. Không chỉ là Caching, Redis còn làm được gì?

Vì lưu trên RAM nên dữ liệu sẽ biến mất nếu Server bị tắt/khởi động lại. Tuy nhiên, kiến trúc của Redis rất thông minh, nó có thể dùng để làm nhiều việc khác:

- **Giỏ hàng (Shopping Cart):** Giỏ hàng của khách truy cập vãng lai không cần lưu vào MySQL cho nặng data. Lưu tạm vào Redis, nếu khách tắt web hoặc để qua đêm thì tự động xóa (Set Expiration time - TTL).
- **Session Management:** Khi bạn đăng nhập vào Facebook, phiên đăng nhập của bạn (Session) thường được lưu ở Redis để tất cả các cụm Server Web đều có thể kiểm tra xem bạn đã đăng nhập chưa với tốc độ cực nhanh.
- **Bảng xếp hạng (Leaderboard):** Redis có cấu trúc dữ liệu \`Sorted Set\` cho phép sắp xếp hàng triệu điểm số của game thủ theo thời gian thực (Real-time) cực mượt.
- **Rate Limiting:** Chống Spam/DDoS bằng cách đếm số lần một IP truy cập vào web trong 1 phút. Nhờ tốc độ của RAM, Redis làm việc đếm số này hoàn hảo.

## 4. Hạn chế của Redis

Tất nhiên, cái gì cũng có giá của nó:
- **Tốn tiền:** RAM luôn đắt hơn Ổ cứng rất nhiều. Bạn không thể dùng Redis để lưu trữ toàn bộ dữ liệu 100GB của hệ thống được (Trừ khi công ty bạn siêu giàu). Redis chỉ dùng để lưu **những dữ liệu truy cập thường xuyên nhất (Hot data)**.
- **Dữ liệu dễ bay hơi:** Dù Redis có cơ chế tự backup xuống ổ cứng (AOF/RDB), nhưng bản chất nó vẫn là bộ nhớ tạm. Đừng bao giờ lưu thông tin giao dịch ngân hàng quan trọng chỉ bằng Redis!

## Kết luận

Nếu Nginx Load Balancer giúp phân tán lực lượng, thì Redis Caching chính là "thuốc tăng lực" ép xung tốc độ phản hồi của website. Sự kết hợp giữa **Nginx + Web Server (Node.js/PHP) + Redis + MySQL** chính là kiến trúc tiêu chuẩn (Standard Architecture) mà mọi lập trình viên Backend phải nắm rõ nếu muốn xây dựng hệ thống chịu tải cao!
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
      title: "Redis là gì? Tại sao các hệ thống lớn đều dùng nó để làm Caching?",
      slug: "redis-caching-la-gi-hieu-nang-" + Date.now(),
      content: htmlContent,
      excerpt: "Database của bạn bị quá tải vì hàng ngàn truy vấn lặp đi lặp lại? Cùng tìm hiểu Redis - vũ khí tối thượng giúp tăng tốc độ phản hồi của Website lên hàng chục lần thông qua kỹ thuật Caching trong RAM.",
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
