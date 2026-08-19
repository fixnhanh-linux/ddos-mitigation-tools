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
# Hướng dẫn di chuyển (Migrate) website WordPress sang Hosting/Server mới an toàn 100%

Việc chuyển nhà (migrate) cho website WordPress từ máy chủ cũ sang máy chủ mới thường là nỗi ám ảnh với nhiều quản trị viên vì lo sợ lỗi hiển thị, rớt thứ hạng SEO hoặc thậm chí là mất trắng dữ liệu. 

Thực tế, quá trình này rất đơn giản nếu bạn làm theo đúng quy trình. Có hai phương pháp phổ biến: Sử dụng Plugin tự động và Chuyển thủ công.

---

## Cách 1: Sử dụng Plugin All-in-One WP Migration (Dành cho người mới)

Đây là cách an toàn và dễ dàng nhất, thích hợp cho các website có dung lượng vừa và nhỏ (dưới 512MB nếu dùng bản miễn phí).

### Bước 1: Xuất dữ liệu ở Hosting cũ
1. Đăng nhập vào Admin của website hiện tại.
2. Cài đặt và kích hoạt plugin **All-in-One WP Migration**.
3. Truy cập **All-in-One WP Migration > Export**.
4. Chọn **Export to > File**. Hệ thống sẽ nén toàn bộ database, themes, plugins và media thành một tệp \`.wpress\`.
5. Tải file này về máy tính.

### Bước 2: Chuẩn bị ở Hosting mới
1. Trỏ tên miền (Domain) về địa chỉ IP của Hosting mới.
2. Cài đặt một trang WordPress trắng (hoàn toàn mới) trên Hosting mới.
3. Cài đặt plugin **All-in-One WP Migration** trên trang web mới này.

### Bước 3: Nhập dữ liệu
1. Truy cập **All-in-One WP Migration > Import** trên website mới.
2. Kéo thả file \`.wpress\` đã tải ở Bước 1 vào.
3. Đợi quá trình hoàn tất, nhấn "Proceed" khi được hỏi có muốn ghi đè dữ liệu hay không.
4. Đăng nhập lại với tài khoản Admin của website cũ và vào **Settings > Permalinks** nhấn "Save Changes" 2 lần để cập nhật lại đường dẫn tĩnh.

---

## Cách 2: Di chuyển thủ công (Dành cho Web lớn / SysAdmin)

Nếu website của bạn có dung lượng lớn (vài GB), việc dùng plugin sẽ dễ dẫn đến tình trạng timeout hoặc out of memory. Lúc này, phương pháp thủ công là tối ưu nhất.

### Bước 1: Nén mã nguồn (Source Code)
Truy cập vào File Manager của cPanel/DirectAdmin cũ hoặc qua SSH:
- Nén toàn bộ thư mục \`public_html\` (hoặc thư mục chứa web) thành một file \`.zip\` hoặc \`.tar.gz\`.
- Tải file nén này về máy hoặc chuyển trực tiếp sang máy chủ mới bằng lệnh \`wget\` hoặc \`rsync\`.

### Bước 2: Xuất cơ sở dữ liệu (Export Database)
- Vào **phpMyAdmin** trên hosting cũ.
- Chọn database của website và nhấn nút **Export** (định dạng SQL).
- Tải file \`.sql\` về máy.

### Bước 3: Upload lên Hosting mới
- Đăng nhập vào Control Panel của hosting mới.
- Upload và giải nén file mã nguồn vào thư mục root (thường là \`public_html\`).
- Tạo một Database mới, kèm User và Password mới.
- Vào **phpMyAdmin** trên hosting mới, chọn Database vừa tạo và nhấn **Import** để tải file \`.sql\` lên.

### Bước 4: Chỉnh sửa file wp-config.php
Đây là bước quyết định để website nhận diện được database mới.
Mở file \`wp-config.php\` tại thư mục root trên máy chủ mới và sửa lại 3 thông số sau cho khớp với thông tin bạn vừa tạo ở Bước 3:
\`\`\`php
define( 'DB_NAME', 'tên_database_mới_của_bạn' );
define( 'DB_USER', 'tên_user_database_mới' );
define( 'DB_PASSWORD', 'mật_khẩu_database_mới' );
\`\`\`

### Bước 5: Kiểm tra và hoàn thiện
- Trỏ lại DNS của tên miền về IP của Server mới.
- Chờ đợi DNS cập nhật (có thể từ vài phút đến vài giờ tùy nhà mạng).
- Đăng nhập vào wp-admin, lưu lại **Permalinks** để tránh lỗi 404 cho các trang con.

> [!WARNING]
> Trong suốt quá trình trỏ DNS và làm quen với máy chủ mới, đừng vội xóa dữ liệu ở máy chủ cũ. Hãy giữ lại ít nhất 7 ngày để đề phòng có sự cố không mong muốn và bạn cần phải quay xe (rollback) khẩn cấp.
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
      title: "Hướng dẫn di chuyển (Migrate) website WordPress sang Hosting/Server mới an toàn 100%",
      slug: "huong-dan-di-chuyen-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Việc chuyển nhà (migrate) cho website WordPress thường là nỗi ám ảnh với nhiều người vì lo sợ rớt thứ hạng SEO hoặc mất dữ liệu. Đừng lo, bài viết này sẽ hướng dẫn bạn các cách di chuyển an toàn nhất.",
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
