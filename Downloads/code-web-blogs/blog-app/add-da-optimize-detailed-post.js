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
# Hướng dẫn tối ưu toàn diện Server DirectAdmin và WordPress (Chi tiết A-Z)

Bài viết trước chúng ta đã học cách "bắt bệnh" khi server quá tải. Hôm nay, chúng ta sẽ đi vào phần kỹ thuật chuyên sâu nhất: Làm thế nào để **tuning (tối ưu hóa)** các dịch vụ lõi của hệ thống bao gồm Web Server, PHP-FPM và MySQL/MariaDB để server có thể chịu tải gấp 2-3 lần so với cấu hình mặc định.

Đây là những bí quyết mà các SysAdmin chuyên nghiệp thường áp dụng cho các VPS/Server chạy DirectAdmin có lượng truy cập lớn.

---

## 1. Tối ưu hóa PHP-FPM (Chìa khóa cho CPU)

Theo mặc định, DirectAdmin thường cấp cấu hình PHP-FPM khá thấp (cơ chế ondemand hoặc dynamic với max_children = 50). Khi lượng người dùng tăng đột biến, PHP sẽ không đủ process (tiến trình) để xử lý, dẫn đến website báo lỗi **503 Service Unavailable** hoặc Server bị kẹt cứng (Hang).

**Cách cấu hình:**
Bạn cần truy cập SSH vào máy chủ và sửa file cấu hình PHP-FPM của user (thường nằm tại \`/usr/local/directadmin/data/users/{username}/php/php-fpmXX.conf\` hoặc cấu hình chung của toàn server).

Hãy điều chỉnh các thông số dựa trên dung lượng RAM của bạn (Giả sử bạn có VPS 4GB RAM, mỗi process PHP tốn khoảng 40MB):

\`\`\`ini
; Chọn cơ chế dynamic thay vì ondemand để phản hồi nhanh hơn
pm = dynamic

; Số lượng process tối đa (4000MB / 40MB = 100 process. Nên để khoảng 60-80 để dành RAM cho MySQL)
pm.max_children = 80

; Số process được tạo ra ngay khi khởi động
pm.start_servers = 10

; Số process nhàn rỗi tối thiểu và tối đa
pm.min_spare_servers = 5
pm.max_spare_servers = 20

; Khởi động lại process sau mỗi 500 request để giải phóng RAM (Chống Memory Leak)
pm.max_requests = 500
\`\`\`

Sau khi chỉnh sửa, nhớ khởi động lại PHP-FPM: \`systemctl restart php-fpm81\` (thay 81 bằng phiên bản PHP bạn đang dùng).

## 2. Bật OPcache cho PHP (Bắt buộc)

Thay vì mỗi lần có người truy cập, PHP lại phải biên dịch lại mã nguồn từ đầu, OPcache sẽ biên dịch mã PHP sang mã máy (bytecode) một lần duy nhất và lưu thẳng vào RAM. Tốc độ xử lý sẽ tăng gấp 3 lần!

Mở file \`php.ini\` của máy chủ và đảm bảo các dòng này được bật:
\`\`\`ini
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60
opcache.fast_shutdown=1
\`\`\`

## 3. Tối ưu hóa MySQL / MariaDB (Chìa khóa cho RAM và Ổ Cứng)

Nếu Database không được tối ưu, ổ cứng sẽ phải đọc/ghi (Disk I/O) liên tục gây thắt cổ chai. Cấu hình mặc định của MySQL rất yếu.

Bạn hãy mở file \`/etc/my.cnf\` (hoặc \`/etc/mysql/my.cnf\`) và thêm/chỉnh sửa các thông số sau:

\`\`\`ini
[mysqld]
# Tối đa số lượng kết nối đồng thời
max_connections = 200

# Buffer Pool: Quan trọng nhất! Chứa cache của table và index.
# Khuyến nghị: Đặt bằng 50% - 70% tổng số RAM nếu Server chỉ chạy Web + DB.
# Ví dụ VPS 4GB RAM -> Đặt 2G
innodb_buffer_pool_size = 2G

# Cache kích thước của Log file
innodb_log_file_size = 256M

# Tối ưu việc ghi log vào đĩa (0: nhanh nhất nhưng nguy cơ mất dữ liệu 1s nếu mất điện, 1: an toàn nhất nhưng chậm, 2: cân bằng)
innodb_flush_log_at_trx_commit = 2

# Giới hạn kích thước tmp table tạo trên RAM thay vì ghi ra đĩa
tmp_table_size = 64M
max_heap_table_size = 64M

# Tối ưu hóa Cache của các connection và table
thread_cache_size = 16
table_open_cache = 2000
\`\`\`

Lưu file và khởi động lại MariaDB: \`systemctl restart mariadb\`.

## 4. Tối ưu Web Server (Tận dụng LiteSpeed & Redis)

1. **LiteSpeed Web Server (LSWS) thay cho Apache:** Nếu bạn đang dùng DirectAdmin, hãy yêu cầu chuyển đổi sang OpenLiteSpeed (miễn phí) hoặc LiteSpeed Enterprise. LiteSpeed xử lý các kết nối tĩnh (Ảnh, CSS, JS) ngang ngửa Nginx và vượt trội hoàn toàn Apache.
2. **Cài đặt LiteSpeed Cache cho WordPress:** 
   - Vào Plugin WP cài đặt **LiteSpeed Cache**.
   - Bật tính năng **Enable Cache**.
   - Bật **Browser Cache** và **CSS/JS Minify**.
3. **Kích hoạt Object Cache (Redis hoặc Memcached):**
   - Bạn cần cài đặt Redis Server trên VPS (\`yum install redis\` hoặc \`apt install redis-server\`).
   - Vào cài đặt LiteSpeed Cache -> Tab **Cache** -> Tab **Object**.
   - Chọn **Redis**, điền \`127.0.0.1\` port \`6379\`.
   - Tính năng này sẽ lưu các câu lệnh (Queries) thường gặp của Database thẳng vào RAM của Redis. Những lần truy cập sau, web không cần gọi xuống Database nữa, tốc độ Load có thể giảm từ 2s xuống còn 0.2s!

## 5. Dọn dẹp Database của WordPress (WP-Optimize)

Về mặt mã nguồn, một database phình to chứa toàn rác sẽ khiến các lệnh \`SELECT\` bị chậm.
Hãy cài đặt plugin **WP-Optimize** và thực hiện các bước sau ít nhất 1 lần/tháng:
- Xóa tất cả các **Post Revisions** (Các bản lưu nháp tự động của bài viết). Có những web chứa tới 10.000 bản nháp vô nghĩa.
- Xóa các comment Spam và Trash.
- Xóa các **Transients** hết hạn (Dữ liệu tạm của các plugin/theme).
- Chạy tính năng **Optimize database tables** để dồn phân mảnh.

## Kết luận

Việc tối ưu hóa hệ thống là một quá trình liên tục (Monitor -> Analyze -> Optimize). 
Hãy áp dụng cẩn thận từng bước một: 
1. Bật OPcache và Redis Object Cache (Dễ nhất và hiệu quả ngay lập tức).
2. Tối ưu MySQL \`innodb_buffer_pool_size\` (Giải quyết vấn đề Disk I/O).
3. Tinh chỉnh lại \`pm.max_children\` của PHP-FPM để máy chủ không bị treo khi có hàng ngàn người truy cập cùng lúc.

Chúc máy chủ của bạn luôn vững vàng trước mọi cơn bão traffic!
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
      title: "Hướng dẫn tối ưu toàn diện Server DirectAdmin và WordPress (Chi tiết A-Z)",
      slug: "toi-uu-toan-dien-server-directadmin-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Bí quyết cấu hình chuyên sâu (Tuning) cho PHP-FPM, MySQL/MariaDB và Web Server để giúp hệ thống chịu tải gấp 2-3 lần. Hướng dẫn chi tiết thiết lập OPcache và Redis Object Cache.",
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
