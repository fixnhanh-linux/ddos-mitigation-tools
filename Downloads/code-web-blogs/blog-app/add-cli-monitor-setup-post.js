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
# Bộ 3 công cụ giám sát dòng lệnh (CLI) bắt buộc phải có trên Ubuntu/CentOS: htop, iotop, nethogs

Giả sử bạn nhận được cảnh báo từ Zabbix hoặc Prometheus báo rằng Server đang bị quá tải (Full 100% CPU hoặc RAM). Bạn lập tức SSH vào Server. Câu hỏi đặt ra là: **Làm sao để biết chính xác tiến trình (Process) nào đang "ăn" tài nguyên để mà kill nó?**

Đó là lúc bạn cần đến "Bộ 3 phép thuật" trên giao diện dòng lệnh (CLI): **htop** (Giám sát CPU/RAM), **iotop** (Giám sát Ổ cứng) và **nethogs** (Giám sát Băng thông mạng). Đây là những công cụ đầu tiên bạn phải cài khi setup một máy chủ mới chạy Ubuntu hoặc CentOS.

---

## 1. htop - Phiên bản nâng cấp hoàn hảo của lệnh 'top'

Lệnh \`top\` có sẵn trên mọi máy Linux, nhưng nó cực kỳ khó nhìn và khó thao tác. **htop** ra đời để giải quyết vấn đề đó với giao diện màu sắc, hỗ trợ chuột và các phím tắt trực quan.

### Cài đặt htop
- **Trên Ubuntu/Debian:** \`sudo apt update && sudo apt install htop -y\`
- **Trên CentOS/RHEL:** \`sudo yum install epel-release -y && sudo yum install htop -y\`

### Cách sử dụng
Chỉ cần gõ lệnh \`htop\` và Enter. 
- Bạn sẽ thấy ngay biểu đồ thanh (Bar chart) hiển thị số Core CPU đang chạy ở trên cùng.
- Nhấn phím **F6 (Sort by)**: Để sắp xếp xem thằng nào đang ăn CPU nhiều nhất, hoặc RAM nhiều nhất (MEM).
- Nhấn phím **F9 (Kill)**: Di chuyển phím mũi tên đến tiến trình đang treo, bấm F9 rồi Enter để tiêu diệt nó ngay lập tức.
- Nhấn phím **F10 (Quit)**: Để thoát.

## 2. iotop - Truy tìm thủ phạm làm "treo" ổ cứng

Đôi khi CPU và RAM của bạn rất rảnh rỗi, nhưng Server vẫn lag tung chảo. Lý do là vì Ổ cứng (Disk I/O) đang bị vắt kiệt (Ví dụ: MySQL đang xuất file Backup nặng 50GB, hoặc Server đang bị dính mã độc tống tiền mã hóa file).

**iotop** sẽ chỉ mặt đặt tên chính xác tiến trình nào đang Đọc (Read) hoặc Ghi (Write) dữ liệu xuống ổ cứng với tốc độ bao nhiêu MB/s.

### Cài đặt iotop
- **Trên Ubuntu/Debian:** \`sudo apt install iotop -y\`
- **Trên CentOS/RHEL:** \`sudo yum install iotop -y\`

### Cách sử dụng
Vì iotop cần đọc các thông số cấp thấp của nhân Kernel, bạn phải chạy nó bằng quyền root:
\`\`\`bash
sudo iotop -o
\`\`\`
*(Tham số \`-o\` nghĩa là "Only": Chỉ hiển thị những tiến trình đang thực sự đọc/ghi ổ cứng vào lúc này, ẩn đi những tiến trình đang ngủ).*

Chỉ cần nhìn vào cột **DISK READ** và **DISK WRITE**, bạn sẽ ngay lập tức biết thủ phạm làm lag máy.

## 3. nethogs - Bắt quả tang phần mềm ngốn Băng thông mạng

Nếu bạn dùng lệnh \`iftop\` (rất nổi tiếng), nó chỉ cho bạn biết *IP nào đang kết nối tới máy bạn*. Nhưng nó KHÔNG cho biết *phần mềm nào* trong máy bạn đang tải dữ liệu. 
Đó là lý do chúng ta nên dùng **nethogs**. Nó gom nhóm băng thông mạng (Network Traffic) theo từng tiến trình (PID). Rất hữu ích để phát hiện máy chủ có đang bị biến thành Botnet đi tấn công máy khác hay không!

### Cài đặt nethogs
- **Trên Ubuntu/Debian:** \`sudo apt install nethogs -y\`
- **Trên CentOS/RHEL:** \`sudo yum install epel-release -y && sudo yum install nethogs -y\`

### Cách sử dụng
Tương tự iotop, hãy chạy bằng quyền root và chỉ định tên card mạng (Thường là \`eth0\` hoặc \`ens3\`). Nếu bạn không nhớ tên card mạng, chỉ cần gõ:
\`\`\`bash
sudo nethogs
\`\`\`
Ngay lập tức, bạn sẽ thấy cột **SENT** (Gửi đi) và **RECEIVED** (Nhận về). Nó sẽ ghi đích danh chương trình (Ví dụ: \`sshd\`, \`nginx\`, \`wget\`) đang tải dữ liệu. Nếu thấy một tiến trình lạ hoắc tên là \`crypto_miner\` đang liên tục gửi hàng MB dữ liệu đi, bạn biết phải dùng lệnh \`kill\` để xử lý nó rồi đấy!

## Kết luận

Zabbix hay Prometheus giống như hệ thống Camera an ninh, báo cho bạn biết nhà có trộm. Còn **htop, iotop, nethogs** chính là vũ khí cận chiến để bạn trực tiếp xông vào nhà và bắt tận tay thủ phạm. Một SysAdmin thực thụ không bao giờ để máy chủ Ubuntu/CentOS của mình thiếu vắng 3 công cụ sinh tử này!
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
      title: "Bộ 3 công cụ giám sát dòng lệnh (CLI) bắt buộc phải có trên Ubuntu/CentOS: htop, iotop, nethogs",
      slug: "cai-dat-htop-iotop-nethogs-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "Nhận được cảnh báo Server bị lag, việc đầu tiên bạn làm là gì? Hãy cài đặt và sử dụng ngay bộ 3 công cụ CLI thần thánh này để truy tìm chính xác thủ phạm đang vắt kiệt CPU, RAM, Ổ cứng và Băng thông mạng.",
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
