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
# Cài đặt sysstat (sar) trên Ubuntu/CentOS: Truy tìm nguyên nhân Server sập từ đêm hôm trước

Hãy tưởng tượng một kịch bản rất hay gặp: Sáng ngủ dậy, bạn thấy thông báo Server vừa bị khởi động lại (Reboot) lúc 2 giờ sáng. 

Bạn vội vàng SSH vào Server và gõ lệnh \`htop\`, nhưng vô ích! \`htop\` chỉ cho bạn biết trạng thái *hiện tại*, nó không thể "quay ngược thời gian" để cho bạn biết lúc 2 giờ sáng CPU hay RAM đã bị vắt kiệt như thế nào.

Đó là lúc bạn cần đến **sysstat (sar)** – Chiếc "Hộp đen" máy bay của hệ điều hành Linux. Nó âm thầm ghi lại toàn bộ hoạt động của hệ thống cứ mỗi 10 phút một lần và lưu vào ổ cứng để bạn có thể xem lại bất cứ lúc nào!

---

## 1. Cài đặt sysstat trên Ubuntu và CentOS

Công cụ \`sar\` (System Activity Reporter) nằm trong gói phần mềm có tên là \`sysstat\`. Nó nhẹ đến mức gần như không tồn tại, nhưng lại là bùa hộ mệnh của mọi SysAdmin.

- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt update
  sudo apt install sysstat -y
  \`\`\`
  *Lưu ý trên Ubuntu:* Mặc định sysstat bị tắt. Bạn phải mở file \`/etc/default/sysstat\`, tìm dòng \`ENABLED="false"\` và sửa thành \`ENABLED="true"\`. Sau đó khởi động lại dịch vụ: \`sudo systemctl restart sysstat\`.

- **Trên CentOS/RHEL/AlmaLinux:**
  \`\`\`bash
  sudo yum install sysstat -y
  sudo systemctl enable sysstat
  sudo systemctl start sysstat
  \`\`\`

Sau khi cài đặt, hệ thống sẽ tự động tạo một Cronjob cứ mỗi 10 phút lại lưu lại trạng thái CPU, RAM, Disk I/O một lần vào thư mục \`/var/log/sysstat\` (CentOS) hoặc \`/var/log/sysstat/\` (Ubuntu).

## 2. Cách xem lại "Băng ghi hình" bằng lệnh \`sar\`

Vì \`sar\` ghi chép dữ liệu liên tục, bạn có thể dễ dàng gọi nó ra để truy vấn. *Lưu ý: Nếu bạn vừa mới cài xong, hãy đợi 10 phút để nó thu thập mẻ dữ liệu đầu tiên.*

### 1. Xem lại lịch sử CPU của ngày hôm nay
Chỉ cần gõ lệnh:
\`\`\`bash
sar
\`\`\`
Kết quả trả về sẽ chia theo từng mốc thời gian (vd: 10:00, 10:10, 10:20...). Cột quan trọng nhất là **%idle** (phần trăm CPU đang rảnh rỗi). Nếu lúc 02:00 sáng, \`%idle\` = 0.00, nghĩa là CPU của bạn đã bị quá tải 100% vào lúc đó.

### 2. Xem lại lịch sử RAM (Bộ nhớ)
Bạn muốn biết RAM có bị cạn kiệt (OOM - Out of Memory) hay không? Hãy dùng tham số \`-r\`:
\`\`\`bash
sar -r
\`\`\`
Cột **%memused** sẽ cho bạn biết tỷ lệ phần trăm RAM đã bị sử dụng tại từng mốc thời gian. Nếu nó đạt mức 99%, chắc chắn Server của bạn đã bị sập do tràn RAM.

### 3. Xem lại lịch sử Ổ cứng (Disk I/O)
Có những lúc CPU và RAM rất rảnh, nhưng Server vẫn treo do ổ cứng bị quá tải (Disk Bottleneck). Hãy gõ lệnh:
\`\`\`bash
sar -d -p
\`\`\`
Cột **%util** cho biết ổ cứng của bạn đang bị "vắt kiệt" bao nhiêu phần trăm công suất. Nếu thấy \`%util\` bám trụ ở mức 95-100%, bạn nên kiểm tra xem có tiến trình nào đang ghi Log điên cuồng hay đang Backup dữ liệu hay không.

## 4. Làm sao để xem dữ liệu của những ngày trước đó?

Theo mặc định, lệnh \`sar\` chỉ hiển thị dữ liệu của **ngày hôm nay**. Nếu bạn muốn điều tra một vụ sập Server xảy ra vào **ngày 15 của tháng này**, bạn phải đọc trực tiếp từ file nhật ký.

Các file nhật ký (Log) của sar được đặt tên theo cấu trúc \`saXX\` (với XX là ngày trong tháng, ví dụ \`sa15\` là ngày 15).

\`\`\`bash
# Trên CentOS:
sar -f /var/log/sa/sa15

# Trên Ubuntu:
sar -f /var/log/sysstat/sa15
\`\`\`

Bạn có thể kết hợp thêm tham số thời gian để thu hẹp phạm vi tìm kiếm. Ví dụ: Xem tình trạng RAM của ngày 15, từ lúc 01:00 đến 03:00 sáng:
\`\`\`bash
sar -r -f /var/log/sa/sa15 -s 01:00:00 -e 03:00:00
\`\`\`

## Kết luận

Zabbix hay Grafana rất tuyệt vời, nhưng nếu máy chủ của bạn mất mạng hoặc bị sập hoàn toàn, các hệ thống trung tâm đó sẽ bị mù thông tin. Đó là lúc **sysstat (sar)** chứng minh giá trị vô song của mình. Nó là chiếc "Hộp đen" lưu giữ những bằng chứng đanh thép nhất nằm ngay trên ổ cứng, giúp bạn tự tin điều tra mọi nguyên nhân giật lag hay sập nguồn của bất kỳ máy chủ Linux nào!
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
      title: "Cài đặt sysstat (sar) trên Ubuntu/CentOS: Truy tìm nguyên nhân Server sập từ đêm hôm trước",
      slug: "cai-dat-sysstat-sar-kiem-tra-log-server-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "htop hay Btop chỉ cho bạn thấy Server đang bị gì lúc này. Nhưng nếu Server bị sập lúc 2 giờ sáng thì sao? Cùng tìm hiểu cách cài đặt sysstat (sar) - Chiếc hộp đen giúp bạn quay ngược thời gian để xem lại biến động CPU/RAM trong quá khứ.",
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
