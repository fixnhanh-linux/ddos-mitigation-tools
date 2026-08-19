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
# Cài đặt Btop trên Ubuntu/CentOS: Giao diện giám sát CLI đẹp nhất thế giới Linux

Bạn đã từng xem các bộ phim Hacker (như Mr. Robot) và trầm trồ trước những màn hình đen ngòm chớp nháy vô số biểu đồ màu sắc tuyệt đẹp? Bạn chán ngán với giao diện thô cứng, nhàm chán của lệnh \`top\` hay thậm chí là \`htop\`?

Hãy quên tất cả đi, bởi vì hôm nay chúng ta sẽ cài đặt **Btop** (hay còn gọi là btop++) – Trình giám sát hệ thống qua giao diện dòng lệnh (CLI) được cộng đồng SysAdmin bình chọn là **"Đẹp nhất, ngầu nhất và tối ưu nhất"** hiện nay.

---

## 1. Tại sao lại là Btop mà không phải htop?

Btop không chỉ là một bức bình phong đẹp mã. Nó là sự kết hợp hoàn hảo giữa thẩm mỹ và sức mạnh:
- **Ngôn ngữ C++ siêu nhẹ:** Btop được viết bằng C++ (bản nâng cấp từ bashtop/bpytop), giúp nó chạy mượt mà ngay cả trên những máy chủ có cấu hình yếu nhất mà không gây tốn tài nguyên.
- **Biểu đồ thời gian thực (Real-time Graphs):** Nó vẽ biểu đồ đường cho CPU, RAM, Network vô cùng mượt mà.
- **Giao diện game (Game-like UI):** Hỗ trợ dùng chuột trực tiếp trên Terminal để cuộn, click, và kill các tiến trình cực kỳ nhanh.
- **Theme (Giao diện màu):** Hỗ trợ hàng chục bộ màu khác nhau mang đậm phong cách Cyberpunk, Dracula, Monokai...

## 2. Hướng dẫn cài đặt Btop cực nhanh

Btop tương thích hoàn hảo với cả Ubuntu, CentOS và macOS. Tuy nhiên, vì nó khá mới, bạn có thể không tìm thấy nó trong các kho ứng dụng (Repository) quá cũ.

### Cách 1: Cài đặt qua Snap (Dành cho Ubuntu)
Nếu bạn đang dùng Ubuntu, cài đặt Btop dễ như ăn kẹo:
\`\`\`bash
sudo snap install btop
\`\`\`

### Cách 2: Cài đặt qua EPEL (Dành cho CentOS/RHEL 8 & 9)
Trên các phiên bản CentOS/RHEL mới:
\`\`\`bash
sudo yum install epel-release -y
sudo yum install btop -y
\`\`\`

### Cách 3: Tải trực tiếp bản Binary (Sử dụng được cho MỌI HĐH Linux)
Nếu máy chủ của bạn không có \`snap\` hoặc bạn dùng CentOS 7 cũ, cách tốt nhất là tải thẳng file chạy (binary) từ GitHub của tác giả. Chỉ tốn 3 lệnh:

\`\`\`bash
# 1. Tải file nén mới nhất (Ví dụ bản dành cho Linux 64-bit)
wget https://github.com/aristocratos/btop/releases/latest/download/btop-x86_64-linux-musl.tbz

# 2. Giải nén
tar -xjf btop-x86_64-linux-musl.tbz

# 3. Chạy file cài đặt
cd btop
sudo make install
\`\`\`

## 3. Khám phá sức mạnh của Btop

Sau khi cài đặt, bạn chỉ cần gõ lệnh sau để triệu hồi "Quái vật":
\`\`\`bash
btop
\`\`\`

Màn hình Terminal của bạn sẽ ngay lập tức được chia thành 4 khu vực cực kỳ chuyên nghiệp:
1. **CPU (Góc trên trái):** Hiển thị tần số (GHz), biểu đồ nhiệt độ từng nhân CPU và biểu đồ tải.
2. **Memory (Góc trên phải):** Hiển thị rõ ràng RAM và ổ cứng (Disks) đang dùng bao nhiêu, trống bao nhiêu.
3. **Network (Giữa bên phải):** Biểu đồ Upload/Download chạy liên tục giống như điện tâm đồ.
4. **Processes (Bên dưới):** Danh sách các tiến trình.

### Các phím tắt "Bá đạo" cần nhớ:
- **Phím \`Esc\`:** Mở Menu chính (Main Menu). Tại đây bạn có thể vào Options để đổi Theme (Màu sắc), hoặc đổi kiểu hiển thị.
- **Phím \`m\` / \`c\` / \`n\`:** Thay đổi cách sắp xếp tiến trình theo Memory (m), CPU (c), hoặc Network (n).
- **Phím \`e\`:** Hiển thị chi tiết (Tree view) các tiến trình con.
- **Phím \`Delete\` hoặc \`F9\`:** Tiêu diệt (Kill) tiến trình đang được chọn.

*Đặc biệt: Bạn hoàn toàn có thể dùng **Chuột** (Scroll) để cuộn lên xuống danh sách và click đúp để mở rộng thông tin mà không cần nhớ phím tắt!*

## Kết luận

Nếu bạn là một System Admin, một DevOps hay đơn giản là một Coder muốn khoe với bạn bè màn hình làm việc "chuẩn Hacker" của mình, **Btop** là phần mềm bắt buộc phải cài. Nó không chỉ biến công việc giám sát máy chủ khô khan trở thành một trải nghiệm thị giác tuyệt vời, mà còn cung cấp đầy đủ độ sâu kỹ thuật để bạn nhanh chóng tóm gọn những phần mềm đang làm giật lag Server.
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
      title: "Cài đặt Btop trên Ubuntu/CentOS: Giao diện giám sát CLI đẹp nhất thế giới Linux",
      slug: "cai-dat-btop-giam-sat-cli-hacker-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "Chán ngán giao diện khô khan của lệnh top hay htop? Cùng cài đặt Btop - Trình giám sát hệ thống (CLI) mang phong cách Cyberpunk siêu ngầu và tối ưu nhất hiện nay dành cho dân chơi Linux.",
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
