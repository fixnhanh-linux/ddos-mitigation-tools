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
# Hướng dẫn sử dụng Nginx làm Reverse Proxy và Load Balancer (Cân bằng tải)

Bạn đã bao giờ thắc mắc làm thế nào các ông lớn như Shopee, Facebook hay Google có thể chịu được hàng triệu lượng truy cập (Traffic) cùng một lúc mà không bị sập chưa? Dĩ nhiên là họ không xài một cái máy chủ (Server) "siêu to khổng lồ", mà họ xài hàng vạn máy chủ nhỏ giàn trải ra.

Kỹ thuật để phân chia đều lượng truy cập khổng lồ đó cho các máy chủ nhỏ xử lý được gọi là **Load Balancing (Cân bằng tải)**. Và công cụ phổ biến nhất, nhẹ nhất, mạnh mẽ nhất để làm việc này chính là **Nginx**.

---

## 1. Reverse Proxy là gì?

Trước khi nói về Load Balancing, chúng ta phải hiểu **Reverse Proxy (Proxy ngược)**.

Bình thường, khi bạn truy cập một trang web, máy tính của bạn sẽ kết nối thẳng đến máy chủ chứa mã nguồn của trang web đó. 
Nhưng nếu dùng Reverse Proxy, bạn sẽ kết nối đến **máy chủ Proxy** trước. Máy chủ Proxy này sẽ đứng ra làm "tiếp tân", nhận yêu cầu của bạn, chạy ra phía sau hỏi máy chủ mã nguồn (Backend Server), lấy kết quả rồi đem ra trả lại cho bạn.

**Lợi ích của Reverse Proxy:**
- **Bảo mật:** Hacker sẽ chỉ nhìn thấy IP của Proxy, không bao giờ biết IP thật của Backend Server.
- **Cache dữ liệu:** Proxy có thể nhớ (cache) lại các tấm ảnh, file CSS. Lần sau có người hỏi, nó trả luôn cho nhanh mà không cần phiền đến Backend Server nữa.
- **Quản lý chứng chỉ SSL:** Proxy sẽ đứng ra gánh việc mã hóa HTTPS cho toàn bộ hệ thống phía sau.

## 2. Load Balancer (Cân bằng tải) là gì?

Đây là "cảnh giới" cao hơn của Reverse Proxy.
Giả sử trang web của bạn quá nổi tiếng, một cái Backend Server đằng sau không gánh nổi. Bạn bèn mua thêm 2 cái Backend Server nữa (Tổng cộng là 3 cái giống hệt nhau).

Lúc này, Nginx (đóng vai trò Load Balancer) sẽ làm nhiệm vụ "chia bài". 
- Khách thứ 1 vào -> Nginx ném cho Server A xử lý.
- Khách thứ 2 vào -> Nginx ném cho Server B xử lý.
- Khách thứ 3 vào -> Nginx ném cho Server C.
- Khách thứ 4 vào -> Quay vòng lại ném cho Server A.

Cách chia bài (Thuật toán) phổ biến nhất này gọi là **Round Robin (Vòng tròn)**.

## 3. Thực hành cấu hình Nginx Load Balancer

Giả sử bạn có 1 con Server Nginx đóng vai trò Cân bằng tải, và đằng sau nó là 3 con Server Web chạy code (Node.js/PHP) với các IP lần lượt là:
- \`10.0.0.1\`
- \`10.0.0.2\`
- \`10.0.0.3\`

Mở file cấu hình của Nginx trên máy chủ Cân bằng tải (Thường nằm ở \`/etc/nginx/nginx.conf\` hoặc \`/etc/nginx/conf.d/default.conf\`):

\`\`\`nginx
# 1. Khai báo một nhóm các máy chủ (Upstream)
upstream backend_servers {
    server 10.0.0.1;
    server 10.0.0.2;
    server 10.0.0.3;
}

# 2. Cấu hình Server "Tiếp tân"
server {
    listen 80;
    server_name www.domain.com;

    location / {
        # Đẩy tất cả yêu cầu về nhóm máy chủ vừa khai báo ở trên
        proxy_pass http://backend_servers;
        
        # Gửi kèm thông tin IP thật của khách hàng cho máy chủ Backend biết
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
    }
}
\`\`\`

Lưu file lại và khởi động lại Nginx:
\`\`\`bash
nginx -t
systemctl reload nginx
\`\`\`

Tuyệt vời! Kể từ giây phút này, bất cứ ai truy cập vào \`www.domain.com\`, Nginx sẽ tự động chia đều tải cho 3 con Server kia. Nếu 1 trong 3 con Server bị cháy ổ cứng tắt phụt, Nginx sẽ tự động nhận biết và chỉ chia bài cho 2 con còn lại (Tính năng Health Check).

## 4. Các thuật toán chia bài (Load Balancing Methods) cao cấp

Nếu bạn không thích chia vòng tròn (Round Robin), Nginx cung cấp cho bạn nhiều "trò" hơn:

- **Least Connections (Ít kết nối nhất):**
  Nginx sẽ soi xem con Server nào đang rảnh rỗi nhất, ít người đang truy cập nhất thì nó ném khách mới vào con đó.
  \`\`\`nginx
  upstream backend_servers {
      least_conn;
      server 10.0.0.1;
      server 10.0.0.2;
  }
  \`\`\`

- **IP Hash (Bám dính IP):**
  Đảm bảo rằng Khách A lần đầu được chia cho Server 1, thì những lần sau Khách A quay lại web vẫn sẽ được Server 1 phục vụ (Rất quan trọng với các web bán hàng cần giữ lại Giỏ hàng / Session đăng nhập).
  \`\`\`nginx
  upstream backend_servers {
      ip_hash;
      server 10.0.0.1;
      server 10.0.0.2;
  }
  \`\`\`

- **Weight (Chia theo tỉ lệ sức mạnh):**
  Server 1 là máy xịn (RAM 64GB), Server 2 là máy cùi (RAM 4GB). Bạn muốn Server 1 gánh gấp 3 lần Server 2.
  \`\`\`nginx
  upstream backend_servers {
      server 10.0.0.1 weight=3;
      server 10.0.0.2 weight=1;
  }
  \`\`\`

## Kết luận

Với vài chục dòng cấu hình ngắn gọn, Nginx chứng minh tại sao nó lại là "ông vua" của thế giới Web Server hiện tại. Nắm vững Nginx Reverse Proxy và Load Balancer là tấm vé thông hành bắt buộc để hệ thống của bạn bước từ "dự án sinh viên" lên thành "Hạ tầng chịu tải ngàn người dùng"!
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
      title: "Hướng dẫn sử dụng Nginx làm Reverse Proxy và Load Balancer (Cân bằng tải)",
      slug: "nginx-reverse-proxy-load-balancer-" + Date.now(),
      content: htmlContent,
      excerpt: "Làm thế nào để các trang web lớn như Shopee, Facebook có thể chịu được hàng triệu người truy cập cùng lúc? Bí mật nằm ở kỹ thuật Cân bằng tải (Load Balancing) và Reverse Proxy. Cùng tìm hiểu và cấu hình bằng Nginx.",
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
