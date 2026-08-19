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
# Hướng dẫn cài đặt Glances trên Ubuntu/CentOS: Giám sát toàn diện (All-in-One) qua Web và Terminal

Trong bài trước, chúng ta đã làm quen với htop (CPU), iotop (Ổ cứng), nethogs (Mạng). Phải mở 3 cửa sổ Terminal cùng lúc để xem được hết mọi thứ có vẻ hơi bất tiện?

Bạn có muốn gom tất cả CPU, RAM, Ổ cứng, Mạng, Nhiệt độ và thậm chí là **trạng thái của các Container Docker** vào chung MỘT màn hình duy nhất không? Đó chính là lúc bạn cần đến **Glances** - Công cụ giám sát "All-in-One" xịn sò nhất trên nền tảng Linux (Ubuntu/CentOS).

---

## 1. Glances là gì?

Được viết bằng Python, Glances thu thập gần như mọi thông số của hệ thống và nhồi nhét chúng vào một giao diện cực kỳ thông minh, tự động thay đổi kích thước để vừa vặn với màn hình của bạn.

Điểm "ăn tiền" nhất của Glances:
- Giám sát cả máy chủ Host và các **Docker Container** đang chạy bên trong.
- Có thể xem qua Terminal bằng kết nối SSH.
- Có sẵn chế độ **Web Server**, cho phép bạn mở trình duyệt web trên điện thoại để xem tình trạng máy chủ.
- Có khả năng xuất dữ liệu (Export) sang Prometheus, InfluxDB hoặc định dạng CSV.

## 2. Cài đặt Glances siêu tốc trên Ubuntu/CentOS

Vì Glances được viết bằng Python, cách an toàn và đa năng nhất là cài qua \`pip\`, hoặc bạn có thể dùng một câu lệnh tự động (Auto Install Script) do chính tác giả cung cấp.

Mở Terminal của CentOS hoặc Ubuntu và chạy lệnh thần thánh này:
\`\`\`bash
curl -L https://bit.ly/glances | /bin/bash
\`\`\`

Lệnh trên sẽ tự động kiểm tra hệ điều hành, cài đặt Python (nếu chưa có) và tải bản Glances mới nhất. Chỉ mất khoảng 1-2 phút.

## 3. Sử dụng Glances qua giao diện Dòng lệnh (CLI)

Rất đơn giản, bạn chỉ cần gõ lệnh:
\`\`\`bash
glances
\`\`\`

Màn hình của bạn sẽ lập tức biến thành một trung tâm điều khiển giống như trong phim khoa học viễn tưởng.
- **Góc trên bên trái:** CPU, RAM, Swap, Load Average.
- **Bên dưới:** Danh sách các tiến trình (Processes) giống hệt htop.
- **Cột bên phải:** Cực kỳ đáng giá! Nó hiển thị băng thông Mạng (Network), tốc độ Đọc/Ghi Ổ cứng (Disk I/O), và danh sách các Docker Container đang chạy.

**Các phím tắt quan trọng:**
- Phím \`c\`: Sắp xếp tiến trình theo CPU.
- Phím \`m\`: Sắp xếp tiến trình theo RAM.
- Phím \`d\`: Ẩn/Hiện cột Ổ cứng.
- Phím \`n\`: Ẩn/Hiện cột Mạng.
- Phím \`q\`: Thoát (Quit).

## 4. Chạy Glances ở chế độ Web Server (Web UI)

Đây là tính năng đáng giá nhất. Bạn không cần phải SSH vào server mới xem được thông số. Hãy bảo Glances tạo ra một trang web!

Chạy lệnh sau:
\`\`\`bash
glances -w
\`\`\`
*(Tham số \`-w\` có nghĩa là Web Server)*.

Glances sẽ mở cổng **61208**. Bây giờ hãy mở trình duyệt web của bạn và truy cập:
\`\`\`text
http://IP_MAY_CHU_CUA_BAN:61208
\`\`\`
Giao diện trên Web đẹp mắt, hiển thị màu sắc rõ ràng (Xanh = Ổn định, Vàng = Cảnh báo, Đỏ = Nguy hiểm) và tự động làm mới mỗi 2 giây.

*Lưu ý: Đừng quên mở cổng 61208 trên Firewall của bạn nhé (Dùng \`ufw allow 61208/tcp\` trên Ubuntu hoặc \`firewall-cmd --add-port=61208/tcp --permanent\` trên CentOS).*

## 5. Cấu hình Glances chạy ngầm liên tục (Systemd Service)

Nếu bạn gõ lệnh \`glances -w\`, khi bạn tắt cửa sổ SSH, trang web cũng sẽ sập theo. Để nó chạy ngầm liên tục cùng máy chủ, chúng ta sẽ tạo một Systemd Service.

Tạo file dịch vụ:
\`\`\`bash
sudo nano /etc/systemd/system/glances.service
\`\`\`
Dán nội dung sau vào:
\`\`\`ini
[Unit]
Description=Glances Web Server
After=network.target

[Service]
ExecStart=/usr/local/bin/glances -w
Restart=on-abort

[Install]
WantedBy=multi-user.target
\`\`\`
*(Lưu ý: Tùy vào hệ điều hành, đường dẫn của lệnh glances có thể là \`/usr/bin/glances\` thay vì \`/usr/local/bin/glances\`. Hãy gõ \`which glances\` để biết đường dẫn chính xác).*

Lưu lại, sau đó kích hoạt dịch vụ:
\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl enable glances
sudo systemctl start glances
\`\`\`

## Kết luận

Với **Glances**, bạn không còn phải "căng mắt" nhảy qua nhảy lại giữa htop, iotop, iftop hay docker stats nữa. Tất cả những thông tin nhịp đập sinh tử của máy chủ giờ đây đã nằm trọn trong một khung hình duy nhất, sẵn sàng phục vụ bạn cả trên môi trường đen trắng (CLI) lẫn trình duyệt web rực rỡ!
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
      title: "Hướng dẫn cài đặt Glances trên Ubuntu/CentOS: Giám sát toàn diện (All-in-One) qua Web và Terminal",
      slug: "cai-dat-glances-ubuntu-centos-all-in-one-" + Date.now(),
      content: htmlContent,
      excerpt: "Việc mở 3 màn hình để xem htop, iotop và nethogs đôi khi quá mệt mỏi? Cùng cài đặt Glances - Bảng điều khiển All-in-one tích hợp tất cả thông số của máy chủ (kể cả Docker) vào chung 1 giao diện duy nhất.",
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
