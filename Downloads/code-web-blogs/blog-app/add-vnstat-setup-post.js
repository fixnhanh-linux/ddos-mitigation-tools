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
# Cài đặt vnStat trên Ubuntu/CentOS: Giám sát lưu lượng Băng thông (Bandwidth) để không bị trừ tiền oan

Hầu hết các nhà cung cấp VPS giá rẻ (như DigitalOcean, Vultr, Linode) đều giới hạn băng thông mạng hàng tháng (thường là 1TB hoặc 2TB). Nếu server của bạn bị tấn công DDoS hoặc bị kẻ xấu lợi dụng để tải file liên tục, dung lượng mạng sẽ vượt quá giới hạn và cuối tháng thẻ tín dụng của bạn sẽ bị trừ một khoản tiền khổng lồ.

Để ngăn chặn viễn cảnh tồi tệ này, bạn bắt buộc phải biết máy chủ của mình đã xài hết bao nhiêu GB băng thông trong tháng này. Và công cụ hoàn hảo, nhẹ nhàng nhất để làm việc đó chính là **vnStat**.

---

## 1. vnStat là gì? Vì sao phải dùng nó?

Các công cụ như \`nethogs\`, \`iftop\` hay \`Glances\` chỉ cho bạn biết tốc độ mạng **ngay tại thời điểm hiện tại** (Ví dụ: 10 MB/s). Nếu bạn khởi động lại máy chủ, mọi dữ liệu đếm được sẽ biến mất.

Ngược lại, **vnStat** đóng vai trò như một người kế toán mẫn cán. Nó liên tục ghi chép lại tổng số Gigabyte (GB) dữ liệu đã Gửi đi (TX) và Nhận về (RX) vào một file cơ sở dữ liệu lưu trên ổ cứng. Nhờ đó, bạn có thể dễ dàng xem lại báo cáo băng thông theo Ngày, theo Tuần hoặc theo Tháng.

vnStat chạy cực kỳ nhẹ (gần như không tốn CPU) vì nó không phân tích từng gói tin (packet sniffing) mà chỉ đọc số liệu có sẵn từ nhân Linux.

## 2. Hướng dẫn cài đặt vnStat

- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt update
  sudo apt install vnstat -y
  \`\`\`

- **Trên CentOS/RHEL:**
  \`\`\`bash
  sudo yum install epel-release -y
  sudo yum install vnstat -y
  \`\`\`

Sau khi cài đặt xong, hãy đảm bảo rằng dịch vụ vnStat đã được bật để chạy ngầm và tự động khởi động cùng máy chủ:
\`\`\`bash
sudo systemctl enable vnstat
sudo systemctl start vnstat
\`\`\`

## 3. Cách xem Báo cáo Băng thông bằng dòng lệnh (CLI)

*Lưu ý: Ngay sau khi cài đặt, vnStat cần khoảng 5 phút để thu thập dữ liệu ban đầu. Nếu bạn gõ lệnh xem ngay lập tức, nó có thể báo lỗi "Not enough data available".*

Để xem tổng quan băng thông, bạn chỉ cần gõ lệnh:
\`\`\`bash
vnstat
\`\`\`

Kết quả trả về sẽ giống như sau:
\`\`\`text
                      rx      /      tx      /     total    /   estimated
 eth0:
       Sep '23      10.50 GiB /   55.20 GiB  /   65.70 GiB  /  150.00 GiB
       Oct '23       2.10 GiB /   12.40 GiB  /   14.50 GiB  /   45.00 GiB
\`\`\`
*(Giải thích: rx = Nhận về, tx = Gửi đi. Nó thậm chí còn tính toán ước tính (estimated) xem với tốc độ dùng hiện tại thì cuối tháng bạn sẽ tiêu thụ hết bao nhiêu GiB).*

**Một số lệnh vnStat hữu ích khác:**
- Xem báo cáo chi tiết **theo ngày**: \`vnstat -d\`
- Xem báo cáo chi tiết **theo giờ**: \`vnstat -h\`
- Xem biểu đồ giám sát **theo thời gian thực** (Real-time): \`vnstat -l\`

## 4. Tích hợp giao diện Web (vnStat PHP Frontend)

Nếu bạn không thích nhìn màn hình đen trắng và muốn xem biểu đồ cột trực quan trên trình duyệt (giống như Google Analytics), bạn có thể cài đặt giao diện Web cho vnStat.

Yêu cầu: Máy chủ của bạn phải cài sẵn Web Server (Nginx/Apache) và PHP.

**Bước 1:** Tải bộ mã nguồn vnstat-php-frontend:
\`\`\`bash
cd /var/www/html
sudo wget https://github.com/bjd/vnstat-php-frontend/archive/master.zip
sudo unzip master.zip
sudo mv vnstat-php-frontend-master vnstat
\`\`\`

**Bước 2:** Cấp quyền cho thư mục:
\`\`\`bash
sudo chown -R www-data:www-data /var/www/html/vnstat
\`\`\`

Bây giờ hãy mở trình duyệt và truy cập: \`http://IP_MAY_CHU_CUA_BAN/vnstat\`. Bạn sẽ thấy một bảng Dashboard hiển thị rất trực quan các biểu đồ băng thông (Hourly, Daily, Monthly). 

*Mẹo bảo mật: Hãy cấu hình Nginx Basic Auth (htpasswd) cho thư mục \`/vnstat\` để không ai ngoài bạn xem được thông tin này nhé!*

## Kết luận

Với **vnStat**, bạn đã nắm trong tay bảng sao kê chi tiết đến từng MB dữ liệu ra vào máy chủ. Hãy tạo thói quen mỗi sáng thứ 2 hàng tuần gõ lệnh \`vnstat -m\` để kiểm tra băng thông tháng này, bạn sẽ tránh được những cú "sốc" về tài chính từ nhà cung cấp VPS!
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
      title: "Cài đặt vnStat trên Ubuntu/CentOS: Giám sát lưu lượng Băng thông (Bandwidth) để không bị trừ tiền oan",
      slug: "cai-dat-vnstat-giam-sat-bang-thong-centos-ubuntu-" + Date.now(),
      content: htmlContent,
      excerpt: "Các VPS (như DigitalOcean, Vultr) đều giới hạn Băng thông 1TB/tháng. Nếu bị DDoS vắt kiệt băng thông, bạn sẽ bị trừ một đống tiền vào cuối tháng. Cùng cài đặt vnStat để ghi lại sổ sách và ngăn chặn viễn cảnh này.",
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
