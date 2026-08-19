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
# Hướng dẫn chi tiết (Setup) cài đặt Zabbix Server để giám sát toàn bộ hạ tầng

Ở bài viết trước, chúng ta đã so sánh Zabbix và Prometheus. Nếu bạn quyết định chọn Zabbix vì sự toàn diện và độ ổn định của nó dành cho hệ thống máy chủ vật lý, thì đây là bài viết dành cho bạn.

Cài đặt Zabbix không đơn giản như chạy một lệnh Docker của Prometheus, nó đòi hỏi bạn phải thiết lập Web Server (Nginx/Apache), PHP và Database (MySQL/PostgreSQL). Tuy nhiên, đừng lo, hướng dẫn Step-by-Step dưới đây sẽ giúp bạn làm chủ mọi thứ!

---

## 1. Yêu cầu hệ thống chuẩn bị (Prerequisites)

- Một máy chủ/VPS chạy **Ubuntu 22.04 LTS** (hoặc 20.04).
- Cấu hình tối thiểu: **2GB RAM, 2 Core CPU** (Khuyến nghị 4GB RAM).
- Quyền truy cập SSH (Root).
- Đã trỏ một tên miền (Subdomain) về IP của Server (Ví dụ: \`zabbix.domain.com\`).

## 2. Các bước cài đặt Zabbix Server

*(Chúng ta sẽ cài đặt Zabbix phiên bản LTS mới nhất sử dụng MySQL và Nginx).*

### Bước 1: Thêm Repository của Zabbix vào Ubuntu
Tải gói cấu hình repo chính thức từ Zabbix và cài đặt nó để đảm bảo chúng ta tải đúng phiên bản chuẩn:

\`\`\`bash
wget https://repo.zabbix.com/zabbix/6.4/ubuntu/pool/main/z/zabbix-release/zabbix-release_6.4-1+ubuntu22.04_all.deb
dpkg -i zabbix-release_6.4-1+ubuntu22.04_all.deb
apt update
\`\`\`

### Bước 2: Cài đặt Zabbix Server, Frontend, Agent
Chạy lệnh sau để cài đặt toàn bộ "combo" lõi của Zabbix, giao diện Web (Frontend dùng Nginx) và Zabbix Agent (để tự giám sát chính máy chủ chứa Zabbix):

\`\`\`bash
apt install zabbix-server-mysql zabbix-frontend-php zabbix-nginx-conf zabbix-sql-scripts zabbix-agent
\`\`\`

### Bước 3: Cài đặt và cấu hình Database (MySQL/MariaDB)
Zabbix cần một nơi để lưu trữ hàng núi dữ liệu. Chúng ta sẽ dùng MariaDB.

\`\`\`bash
apt install mariadb-server
systemctl start mariadb
systemctl enable mariadb
\`\`\`

Tiếp theo, tạo một Database và User cho Zabbix:
\`\`\`bash
mysql -u root -p
\`\`\`
*(Nhập mật khẩu root của MySQL, nếu chưa có cứ nhấn Enter).*

Chạy các lệnh SQL sau trong dấu nhắc \`MariaDB >\`:
\`\`\`sql
CREATE DATABASE zabbix character set utf8mb4 collate utf8mb4_bin;
CREATE USER 'zabbix'@'localhost' IDENTIFIED BY 'MatKhauSieuKho123!';
GRANT ALL PRIVILEGES ON zabbix.* TO 'zabbix'@'localhost';
SET GLOBAL log_bin_trust_function_creators = 1;
quit;
\`\`\`

### Bước 4: Nạp dữ liệu cấu trúc (Schema) vào Database
Zabbix có sẵn một file chứa cấu trúc các bảng dữ liệu. Bạn hãy nạp nó vào Database \`zabbix\` vừa tạo:

\`\`\`bash
zcat /usr/share/zabbix-sql-scripts/mysql/server.sql.gz | mysql --default-character-set=utf8mb4 -uzabbix -p zabbix
\`\`\`
*(Nhập mật khẩu \`MatKhauSieuKho123!\` khi được hỏi).*

Sau khi import thành công, hãy tắt quyền tạo function đi cho bảo mật:
\`\`\`bash
mysql -u root -p -e "SET GLOBAL log_bin_trust_function_creators = 0;"
\`\`\`

### Bước 5: Cấu hình Zabbix Server và Nginx
1. Sửa file cấu hình Zabbix Server:
\`\`\`bash
nano /etc/zabbix/zabbix_server.conf
\`\`\`
Tìm dòng \`DBPassword=\`, bỏ dấu \`#\` ở đầu và điền mật khẩu của bạn vào:
\`\`\`ini
DBPassword=MatKhauSieuKho123!
\`\`\`
Lưu và thoát (Ctrl+O, Enter, Ctrl+X).

2. Sửa file cấu hình Nginx cho Zabbix:
\`\`\`bash
nano /etc/zabbix/nginx.conf
\`\`\`
Tìm các dòng \`listen\` và \`server_name\`, bỏ dấu \`#\` và sửa lại tên miền của bạn:
\`\`\`nginx
listen 80;
server_name zabbix.domain.com;
\`\`\`

### Bước 6: Khởi động hệ thống
Mọi thứ đã sẵn sàng. Hãy kích hoạt tất cả các dịch vụ chạy ngầm cùng hệ thống:

\`\`\`bash
systemctl restart zabbix-server zabbix-agent nginx php8.1-fpm
systemctl enable zabbix-server zabbix-agent nginx php8.1-fpm
\`\`\`

## 3. Hoàn tất cài đặt trên Giao diện Web

Mở trình duyệt web của bạn lên và truy cập vào \`http://zabbix.domain.com\`.
Bạn sẽ thấy màn hình chào mừng **"Welcome to Zabbix!"**.

1. Nhấn **Next step**, hệ thống sẽ check xem PHP có đủ điều kiện không (Thường là OK hết xanh lè).
2. Tới phần **Configure DB connection**, nhập password \`MatKhauSieuKho123!\` vào ô DB Password.
3. Cứ Next liên tục cho tới bước **Pre-installation summary**, nhấn **Finish**.

**Tài khoản đăng nhập mặc định của Zabbix là:**
- Username: **Admin** *(Chữ A viết hoa)*
- Password: **zabbix**

## Kết luận
Xin chúc mừng! Bạn đã sở hữu một cỗ máy giám sát hạng nặng. Việc tiếp theo bạn cần làm là thay đổi mật khẩu mặc định ngay lập tức, và sau đó bắt đầu cài đặt **Zabbix Agent** lên các Máy chủ/VPS khác trong hệ thống của bạn để add chúng vào Dashboard này.
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
      title: "Hướng dẫn chi tiết (Setup) cài đặt Zabbix Server để giám sát toàn bộ hạ tầng",
      slug: "setup-cai-dat-zabbix-server-chi-tiet-" + Date.now(),
      content: htmlContent,
      excerpt: "Zabbix cực kỳ mạnh mẽ nhưng việc cài đặt lại khiến nhiều Newbie nản lòng. Cùng làm theo hướng dẫn từng bước (Step-by-step) dưới đây để tự tay dựng một Zabbix Server hoàn chỉnh trên Linux.",
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
