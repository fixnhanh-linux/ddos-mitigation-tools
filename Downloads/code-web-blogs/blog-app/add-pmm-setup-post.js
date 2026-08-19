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
# Cài đặt Percona Monitoring (PMM): Giám sát và tối ưu hóa Database MySQL/MariaDB chuyên sâu

Hầu hết các công cụ chúng ta đã cài đặt từ trước đến nay (như Zabbix, Prometheus, Glances) đều làm rất tốt việc giám sát "Phần cứng" (Hardware) như CPU, RAM, Network. Nhưng khi trang web của bạn bị chậm, nguyên nhân lại thường nằm ở **Database (Cơ sở dữ liệu)** bị quá tải bởi các câu lệnh truy vấn (Slow Query).

Làm sao để biết câu lệnh SQL nào đang "ngốn" nhiều thời gian nhất? Làm sao để theo dõi InnoDB Buffer Pool hay tình trạng Deadlock?

Chào mừng bạn đến với **PMM (Percona Monitoring and Management)** – Nền tảng giám sát Database mã nguồn mở đỉnh cao nhất thế giới do chính Percona phát triển.

---

## 1. PMM là gì?

PMM là một giải pháp giám sát chuyên biệt dành cho các hệ quản trị cơ sở dữ liệu như **MySQL, MariaDB, PostgreSQL** và cả **MongoDB**.

Nó được xây dựng dựa trên lõi của Prometheus và Grafana, nhưng đã được Percona "độ" lại với hàng chục Dashboard được thiết kế riêng bởi các chuyên gia DBA hàng đầu. Bằng cách cài đặt PMM, bạn có thể:
- Tìm ra những câu lệnh SQL chậm nhất (Query Analytics).
- Giám sát số lượng Connection, Thread chạy ngầm.
- Phân tích và đưa ra gợi ý tối ưu các thông số cấu hình (\`my.cnf\`).

Kiến trúc của nó gồm 2 phần: **PMM Server** (nhận và hiển thị dữ liệu) và **PMM Client** (cài trên máy chủ chứa Database).

## 2. Cài đặt PMM Server bằng Docker (Chỉ mất 2 phút)

Cách tốt nhất và được khuyên dùng nhất để chạy PMM Server là sử dụng Docker. Hãy chạy nó trên một máy chủ (hoặc VPS) riêng biệt, có RAM tối thiểu 2GB.

\`\`\`bash
# 1. Tải image PMM Server mới nhất
docker pull percona/pmm-server:2

# 2. Tạo một volume để lưu trữ dữ liệu giám sát vĩnh viễn (tránh mất data khi khởi động lại)
docker create -v /srv --name pmm-data percona/pmm-server:2 /bin/true

# 3. Chạy PMM Server
docker run -d \
  -p 80:80 -p 443:443 \
  --volumes-from pmm-data \
  --name pmm-server \
  --restart always \
  percona/pmm-server:2
\`\`\`

Bây giờ, hãy mở trình duyệt và truy cập vào IP của máy chủ PMM: \`http://IP_MAY_CHU\`.
- **Username mặc định:** \`admin\`
- **Password mặc định:** \`admin\`

(Hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay trong lần đăng nhập đầu tiên).

## 3. Cài đặt PMM Client trên máy chủ chứa Database

Tiếp theo, bạn cần SSH vào máy chủ đang chạy MySQL/MariaDB của bạn để cài đặt PMM Client.

- **Trên Ubuntu/Debian:**
  \`\`\`bash
  wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb
  sudo dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb
  sudo apt update
  sudo apt install pmm2-client -y
  \`\`\`

- **Trên CentOS/RHEL 7/8:**
  \`\`\`bash
  sudo yum install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm
  sudo yum install pmm2-client -y
  \`\`\`

## 4. Kết nối Client với Server và bắt đầu giám sát MySQL

### Bước 1: Khai báo với PMM Server
Đầu tiên, bạn cần nói cho PMM Client biết PMM Server nằm ở đâu:
\`\`\`bash
pmm-admin config --server-insecure-tls --server-url=https://admin:MAT_KHAU_CUA_BAN@IP_CUA_PMM_SERVER:443
\`\`\`
*(Hãy thay \`MAT_KHAU_CUA_BAN\` và \`IP_CUA_PMM_SERVER\` bằng thông tin thực tế).*

### Bước 2: Tạo User trong MySQL để PMM thu thập dữ liệu
Đăng nhập vào MySQL của bạn (\`mysql -u root -p\`) và chạy các lệnh sau:
\`\`\`sql
CREATE USER 'pmm'@'localhost' IDENTIFIED BY 'MatKhauChoPMM';
GRANT SELECT, PROCESS, SUPER, REPLICATION CLIENT, RELOAD ON *.* TO 'pmm'@'localhost';
GRANT SELECT, UPDATE, DELETE, DROP ON performance_schema.* TO 'pmm'@'localhost';
FLUSH PRIVILEGES;
EXIT;
\`\`\`

### Bước 3: Thêm dịch vụ MySQL vào PMM
Cuối cùng, quay lại Terminal và ra lệnh cho PMM Client bắt đầu gửi dữ liệu MySQL về Server:
\`\`\`bash
pmm-admin add mysql --username=pmm --password=MatKhauChoPMM --query-source=perfschema
\`\`\`
Nếu kết quả trả về chữ \`MySQL Service added\`, xin chúc mừng!

## 5. Tận hưởng bộ tính năng của Percona

Quay lại giao diện Web của PMM Server, bạn sẽ thấy máy chủ Database của mình đã xuất hiện. Hãy khám phá:
- **MySQL Instances Overview:** Xem bức tranh toàn cảnh về Tốc độ đọc/ghi ổ đĩa, RAM.
- **MySQL InnoDB Details:** Theo dõi sát sao bộ nhớ đệm Buffer Pool – Trái tim của InnoDB.
- **PMM Query Analytics (QAN):** Đây là "vũ khí hủy diệt". Nó liệt kê chi tiết mọi câu lệnh SQL đang chạy, câu lệnh nào tốn nhiều tài nguyên nhất, chạy mất bao nhiêu mili-giây. Nhờ đó, bạn sẽ biết ngay bảng (table) nào đang thiếu Index để tối ưu lập tức.

## Kết luận

Nếu ứng dụng Web của bạn là chiếc xe đua, thì Database chính là động cơ. Thay vì mù mờ ngồi đoán xem vì sao web load chậm, việc cài đặt **PMM (Percona Monitoring and Management)** sẽ soi sáng mọi ngóc ngách trong "động cơ" MySQL/MariaDB của bạn, giúp bạn tối ưu hệ thống ở cấp độ của một Chuyên gia DBA thực thụ!
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
      title: "Cài đặt Percona Monitoring (PMM): Giám sát và tối ưu hóa Database MySQL/MariaDB chuyên sâu",
      slug: "cai-dat-pmm-giam-sat-mysql-mariadb-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "CPU và RAM đều ổn nhưng Web vẫn load chậm? Đó là do Database bị nghẽn! Cùng tìm hiểu cách cài đặt PMM - nền tảng giám sát Cơ sở dữ liệu chuyên nghiệp nhất thế giới để truy tìm những câu lệnh SQL chậm nhất.",
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
