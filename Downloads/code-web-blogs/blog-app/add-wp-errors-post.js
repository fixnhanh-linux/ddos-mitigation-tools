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
# Tổng hợp và cách khắc phục 5 lỗi phổ biến nhất trên website WordPress

Trong quá trình quản trị một website WordPress, chắc chắn bạn sẽ ít nhất một lần đối mặt với các thông báo lỗi khiến trang web ngừng hoạt động. Đừng hoảng hốt, hầu hết các lỗi này đều rất phổ biến và có cách khắc phục khá đơn giản nếu bạn hiểu bản chất của chúng.

Dưới đây là 5 lỗi thường gặp nhất và cách xử lý chi tiết.

---

## 1. Lỗi kết nối Cơ sở dữ liệu (Error Establishing a Database Connection)

Đây là lỗi phổ biến nhất, xảy ra khi mã nguồn WordPress không thể kết nối tới Database (MySQL/MariaDB). Khi đó, website sẽ chỉ hiển thị một dòng thông báo lỗi trắng trơn.

**Nguyên nhân:**
- Sai thông tin cấu hình trong file \`wp-config.php\`.
- Database server bị sập hoặc quá tải.
- Database bị hỏng (corrupted).

**Cách khắc phục:**
1. Mở file \`wp-config.php\` ở thư mục gốc (root) và kiểm tra lại 4 thông số: \`DB_NAME\`, \`DB_USER\`, \`DB_PASSWORD\`, \`DB_HOST\`. Đảm bảo không có dư khoảng trắng.
2. Kiểm tra xem service MySQL/MariaDB trên server có đang chạy hay không. (Dùng lệnh \`systemctl status mysql\` hoặc restart dịch vụ).
3. Nếu Database bị hỏng, hãy thêm dòng \`define('WP_ALLOW_REPAIR', true);\` vào file \`wp-config.php\`, sau đó truy cập đường dẫn \`yoursite.com/wp-admin/maint/repair.php\` để sửa lỗi.

## 2. Màn hình trắng chết chóc (White Screen of Death - WSoD)

Website không hiển thị bất kỳ lỗi nào, chỉ có một màn hình trắng xóa.

**Nguyên nhân:**
- Giới hạn bộ nhớ PHP (PHP Memory Limit) quá thấp.
- Lỗi xung đột Plugin hoặc Theme.
- Bị rỗng file do nhiễm mã độc.

**Cách khắc phục:**
1. **Bật chế độ Debug:** Mở \`wp-config.php\`, đổi \`define('WP_DEBUG', false);\` thành \`true\`. Lúc này màn hình trắng sẽ hiển thị dòng báo lỗi cụ thể để bạn biết file nào đang gây ra lỗi.
2. **Tăng PHP Memory Limit:** Thêm dòng \`define('WP_MEMORY_LIMIT', '256M');\` vào \`wp-config.php\`.
3. **Vô hiệu hóa toàn bộ Plugin:** Đổi tên thư mục \`wp-content/plugins\` thành \`plugins_old\`. Nếu website hoạt động lại, hãy đổi tên về như cũ và tiến hành vô hiệu hóa từng plugin để tìm thủ phạm.

## 3. Lỗi 500 Internal Server Error

Đây là một lỗi máy chủ chung chung, thường xảy ra khi có cấu hình sai trong file \`.htaccess\` hoặc cạn kiệt bộ nhớ PHP.

**Cách khắc phục:**
1. **Kiểm tra file \`.htaccess\`:** Truy cập qua FTP/File Manager, đổi tên file \`.htaccess\` thành \`.htaccess_old\`. Tải lại trang, nếu web vào được thì vào **Settings > Permalinks** và nhấn Save để WordPress tự tạo lại file mới.
2. Kiểm tra lại quyền (CHMOD) của các thư mục (\`755\`) và tệp tin (\`644\`).
3. Kiểm tra Error Log của server (Apache/Nginx) để xem chi tiết lỗi.

## 4. Lỗi "Briefly unavailable for scheduled maintenance"

Lỗi này kẹt lại trên màn hình khi quá trình cập nhật WordPress, Theme hoặc Plugin bị gián đoạn (do rớt mạng hoặc hết thời gian thực thi).

**Cách khắc phục:**
Trong lúc cập nhật, WordPress tạo ra một file tên là \`.maintenance\` ở thư mục gốc để khóa website. Khi cập nhật lỗi, file này không tự xóa đi.
- **Giải pháp:** Bạn chỉ cần truy cập vào File Manager hoặc FTP, tìm và xóa file \`.maintenance\` đi là xong!

## 5. Lỗi 404 Not Found (Khi truy cập các bài viết)

Trang chủ vẫn vào được bình thường, nhưng cứ bấm vào một bài viết bất kỳ thì lại bị báo lỗi 404. 

**Nguyên nhân:** 
Thường do file \`.htaccess\` bị thiếu quy tắc viết lại đường dẫn (Rewrite Rules) sau khi bạn chuyển host hoặc cài đặt SSL.

**Cách khắc phục:**
Đăng nhập vào bảng quản trị wp-admin, truy cập **Cài đặt (Settings) > Đường dẫn tĩnh (Permalinks)**. Bạn không cần sửa gì cả, chỉ việc cuộn xuống dưới cùng và nhấn nút **Lưu thay đổi (Save Changes)**. WordPress sẽ tự động cấu hình lại (Flush rewrite rules) và sửa lỗi 404.

> [!TIP]
> Việc sao lưu (backup) tự động hàng ngày bằng các plugin như *UpdraftPlus* là phao cứu sinh tuyệt vời nhất. Nếu gặp một lỗi không thể khắc phục, bạn có thể dễ dàng Restore lại bản sao lưu của ngày hôm qua!
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
      title: "Tổng hợp và cách khắc phục 5 lỗi phổ biến nhất trên website WordPress",
      slug: "khac-phuc-loi-pho-bien-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Lỗi thiết lập cơ sở dữ liệu (Database Connection), màn hình trắng chết chóc (WSoD) hay lỗi 500 Internal Server Error là những ác mộng với người dùng WordPress. Bài viết này sẽ hướng dẫn bạn cách xử lý chúng nhanh chóng.",
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
