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
# Cách kiểm tra Website ngốn tài nguyên trên Server DirectAdmin và hướng dẫn tối ưu

Khi quản lý một VPS hoặc Server cài đặt bảng điều khiển **DirectAdmin (DA)** chứa hàng chục đến hàng trăm website, sẽ có những lúc máy chủ rơi vào trạng thái quá tải (CPU Load vọt lên 100%, RAM cạn kiệt, MySQL treo).

Việc đầu tiên cần làm không phải là vội vàng nâng cấp (upgrade) Server, mà là phải "bắt đúng bệnh, tìm đúng thủ phạm". Bài viết này sẽ hướng dẫn bạn cách tìm ra website nào đang ngốn tài nguyên nhất và cách tối ưu chúng.

---

## 1. Cách truy tìm "thủ phạm" ngốn tài nguyên trên DirectAdmin

Để biết user hay website nào đang chiếm dụng tài nguyên, bạn cần có quyền truy cập SSH (Root) hoặc quyền Admin trên giao diện DirectAdmin.

### Cách 1: Sử dụng giao diện DirectAdmin (Trực quan nhất)
1. Đăng nhập vào DirectAdmin với quyền **Admin**.
2. Tìm đến mục **System Info & Files** -> Chọn **Process Monitor** (hoặc **Service Monitor**).
3. Tại đây, DirectAdmin sẽ liệt kê các tiến trình đang chạy. Hãy sắp xếp cột **%CPU** hoặc **%MEM** từ cao xuống thấp.
4. Nếu bạn thấy tiến trình có định dạng \`php-fpm: pool username\`, thì \`username\` đó chính là chủ sở hữu website đang vắt kiệt CPU.

### Cách 2: Sử dụng lệnh \`top\` và \`htop\` qua SSH
Đây là cách các SysAdmin thường dùng vì nó real-time và chính xác.
1. SSH vào server bằng quyền root.
2. Gõ lệnh \`top -c\` hoặc \`htop\`.
3. Nhấn phím \`Shift + P\` để sắp xếp theo CPU, hoặc \`Shift + M\` để sắp xếp theo RAM.
4. Tìm ở cột **COMMAND** hoặc **USER**. Nếu thấy user nào chạy quá nhiều tiến trình \`lsphp\` hoặc \`php-fpm\` với %CPU cao ngất ngưởng, hãy ghi chú lại user đó.

### Cách 3: Kiểm tra MySQL / MariaDB (Database)
Đôi khi CPU tăng không phải do PHP mà là do MySQL phải xử lý các truy vấn chậm (Slow queries).
1. Truy cập SSH.
2. Chạy lệnh: \`mysqladmin processlist\` hoặc đăng nhập mysql và gõ \`SHOW FULL PROCESSLIST;\`.
3. Nhìn cột **db** (Tên Database) và cột **Time** (Thời gian chạy). Nếu một database liên tục có các câu lệnh bị kẹt vài chục giây ở trạng thái \`Sending data\` hoặc \`Copying to tmp table\`, website sở hữu Database đó chính là nguyên nhân.

## 2. Nguyên nhân phổ biến khiến Website ngốn tài nguyên

Sau khi đã xác định được website, bạn cần vào kiểm tra mã nguồn. Thường nguyên nhân sẽ rơi vào 3 trường hợp sau (đặc biệt đối với WordPress):

1. **Bị tấn công (DDoS / Botnet / XML-RPC):** Website bị hàng vạn IP truy cập cùng lúc vào file \`xmlrpc.php\` hoặc \`wp-login.php\`.
2. **Plugin lỗi hoặc quá nặng:** Các plugin thống kê truy cập, plugin liên quan đến WooComerce tính toán sai logic tạo ra vòng lặp vô tận.
3. **Mã độc (Malware / Backdoor):** Hacker lợi dụng server của bạn để đào coin hoặc spam email.

## 3. Các phương pháp Tối ưu và Xử lý

### A. Đối phó với tấn công và Bot xấu
- **Chặn XML-RPC:** Mở file \`.htaccess\` của website đó lên và thêm đoạn code sau để chặn hoàn toàn (nếu không dùng app mobile WordPress):
  \`\`\`apache
  <Files xmlrpc.php>
    Order Deny,Allow
    Deny from all
  </Files>
  \`\`\`
- **Kích hoạt Cloudflare:** Đổi Nameserver qua Cloudflare và bật chế độ **Under Attack Mode** để lọc bot.

### B. Tối ưu mã nguồn Website
- **Sử dụng Cache (Bắt buộc):** Nếu bạn dùng Litespeed Web Server trên DirectAdmin, bắt buộc phải cài đặt plugin **LiteSpeed Cache**. Cache sẽ giúp web chuyển từ PHP động sang HTML tĩnh, giảm 90% tải cho CPU.
- **Tối ưu Database:** Xóa bớt các bản nháp (Post revisions), dọn dẹp các table rác do plugin cũ để lại bằng plugin **WP-Optimize**.

### C. Giới hạn tài nguyên bằng CloudLinux
Nếu bạn cho thuê hosting (Shared Hosting), một user quá tải sẽ kéo sập cả server. Lời khuyên là hãy cài đặt hệ điều hành **CloudLinux** tích hợp vào DirectAdmin.
- CloudLinux sử dụng LVE Manager để "nhốt" mỗi user vào một lồng kính. Bạn có thể set cứng: *User A chỉ được dùng tối đa 1 CPU và 1GB RAM*. Nếu User A xài lố, website của họ sẽ báo lỗi 508 Resource Limit Reached, còn các website khác trên server vẫn chạy phà phà.

## Kết luận
Bằng việc sử dụng các công cụ giám sát tiến trình và kiểm tra Database, bạn hoàn toàn có thể "chỉ mặt đặt tên" thủ phạm gây chậm Server DirectAdmin. Hãy luôn nhớ: Tối ưu Cache và bảo mật trước khi nghĩ đến việc bỏ tiền nâng cấp RAM/CPU nhé!
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
      title: "Cách kiểm tra Website ngốn tài nguyên trên Server DirectAdmin và hướng dẫn tối ưu",
      slug: "kiem-tra-website-ngon-tai-nguyen-directadmin-" + Date.now(),
      content: htmlContent,
      excerpt: "Server DirectAdmin của bạn thường xuyên báo tải cao (High Load) nhưng không rõ website nào đang là thủ phạm? Khám phá ngay các công cụ kiểm tra tài nguyên và bí kíp tối ưu triệt để.",
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
