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
# Cài đặt Wazuh trên Ubuntu/CentOS: Hệ thống giám sát bảo mật SIEM (Phát hiện Xâm nhập & Mã độc)

Trong suốt chuỗi bài viết vừa qua, chúng ta đã học cách giám sát để đảm bảo máy chủ không bị "sập" do thiếu CPU hay RAM. Nhưng có một rủi ro còn đáng sợ hơn cả việc sập Server: **Server của bạn đang bị Hacker chiếm quyền điều khiển, lén lút đào Coin hoặc đánh cắp dữ liệu khách hàng.**

Làm sao để biết máy chủ của bạn có đang chứa mã độc (Malware/Rootkit)? Làm sao để biết một Hacker đang dò mật khẩu SSH (Brute-force) vào lúc 2 giờ sáng? 

Chào mừng bạn đến với **Wazuh** – Giải pháp giám sát an ninh mạng (SIEM & XDR) mã nguồn mở miễn phí và mạnh mẽ nhất thế giới hiện nay!

---

## 1. Wazuh là gì? Tại sao gọi nó là "Bảo vệ Hoàng gia"?

Wazuh không đo lường CPU hay RAM. Nó đo lường **Sự An Toàn**. Kiến trúc của Wazuh bao gồm 2 phần chính:
1. **Wazuh Agent:** Cài đặt trên các máy chủ con (Ubuntu, CentOS, thậm chí cả Windows). Nó hoạt động như một "Camera an ninh", liên tục quét các tệp tin hệ thống, đọc log bảo mật, kiểm tra các lỗ hổng (Vulnerabilities) chưa được vá, và tìm kiếm các dấu hiệu của Rootkit/Mã độc.
2. **Wazuh Manager (Máy chủ trung tâm):** Nhận toàn bộ cảnh báo từ các Agent và vẽ ra một Dashboard cực kỳ nguy hiểm với các mức cảnh báo màu Đỏ (Critical), Cam (High) để bạn ngay lập tức xử lý.

Đặc biệt, Wazuh có tính năng **Active Response (Phản hồi chủ động)**: Tự động khóa IP của Hacker ngay khi phát hiện nó đang quét mật khẩu SSH quá 5 lần.

## 2. Cài đặt Wazuh Server cực nhanh (Quickstart)

Thay vì phải cài từng phần (Elasticsearch, Filebeat, Kibana) cực kỳ phức tạp như thời xa xưa, đội ngũ Wazuh đã cung cấp một Script cài đặt tự động từ A đến Z.

Yêu cầu máy chủ: Ít nhất **4GB RAM** (Vì nó sử dụng công nghệ ELK Stack để lưu trữ Log).

Mở máy chủ (đóng vai trò làm Server Trung tâm) và gõ lệnh:
\`\`\`bash
curl -sO https://packages.wazuh.com/4.4/wazuh-install.sh && sudo bash ./wazuh-install.sh -a
\`\`\`
*(Quá trình này sẽ diễn ra tự động hoàn toàn, mất khoảng 10 - 15 phút tùy vào tốc độ mạng của bạn).*

Sau khi chạy xong, màn hình Terminal sẽ in ra thông tin đăng nhập:
\`\`\`text
INFO: --- Web interface ---
INFO: https://<IP_MAY_CHU>
INFO: User: admin
INFO: Password: <MẬT_KHẨU_ĐƯỢC_SINH_RA_NGẪU_NHIÊN>
\`\`\`

Bạn chỉ việc mở trình duyệt web, truy cập vào IP của máy chủ qua \`https://\` và đăng nhập. Một Dashboard bảo mật khổng lồ mang hơi hướng FBI sẽ hiện ra trước mắt bạn.

## 3. Cài đặt Wazuh Agent trên máy con (Ubuntu/CentOS)

Sau khi có Server Trung tâm, bạn cần cài "Camera an ninh" (Wazuh Agent) lên các máy chủ mà bạn muốn bảo vệ.

1. Đăng nhập vào Dashboard của Wazuh Server.
2. Bấm vào nút **Add Agent**.
3. Chọn hệ điều hành của máy con (DEB cho Ubuntu/Debian, RPM cho CentOS/Redhat).
4. Nhập IP của Wazuh Server vào ô \`Wazuh server address\`.
5. Đặt tên cho máy con ở ô \`Agent name\`.

Ngay lập tức, Dashboard sẽ sinh ra cho bạn một dòng lệnh. Bạn chỉ việc Copy dòng lệnh đó, SSH vào máy chủ con và Paste ra. Dòng lệnh sẽ có dạng tương tự như sau:
\`\`\`bash
# Tải và cài đặt Agent (Ví dụ trên Ubuntu)
wget https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_4.4.1-1_amd64.deb && sudo WAZUH_MANAGER='192.168.1.100' WAZUH_AGENT_NAME='Web_Server_01' dpkg -i ./wazuh-agent_4.4.1-1_amd64.deb

# Khởi động Agent
sudo systemctl daemon-reload
sudo systemctl enable wazuh-agent
sudo systemctl start wazuh-agent
\`\`\`

Quay lại màn hình Dashboard của Wazuh Server, bạn sẽ thấy Agent \`Web_Server_01\` hiện lên màu xanh lá cây (\`Active\`).

## 4. Trải nghiệm sức mạnh của Wazuh

Chỉ cần để Agent chạy khoảng 15 phút, bạn hãy click vào Agent đó trên Dashboard và tận hưởng các báo cáo:
- **Vulnerabilities (Lỗ hổng bảo mật):** Wazuh quét mọi phần mềm bạn đang cài (như Nginx bản cũ) và liệt kê chi tiết nó dính lỗi CVE nào, mức độ nghiêm trọng ra sao.
- **Security Events:** Liệt kê các lần đăng nhập SSH thành công và thất bại. Nếu có Hacker rà quét cổng 22, nó sẽ đỏ chót màn hình.
- **File Integrity Monitoring (FIM):** Chuyên dùng để chống mã độc. Nếu Hacker hack được web của bạn và âm thầm sửa file \`index.php\` để chèn link ẩn, Wazuh sẽ báo động ngay lập tức "File index.php vừa bị ai đó chỉnh sửa!".

## Kết luận

Nếu như CPU hay RAM bị đầy chỉ làm máy chủ chạy chậm, thì việc bị Hacker chiếm quyền có thể phá hủy toàn bộ sự nghiệp của bạn và công ty. Đừng để hệ thống chạy "mù" trên Internet. Hãy cài đặt **Wazuh** ngay hôm nay để biến hệ thống của bạn thành một pháo đài bất khả xâm phạm với các "Camera an ninh" 24/7!
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
      title: "Cài đặt Wazuh trên Ubuntu/CentOS: Hệ thống giám sát bảo mật SIEM (Phát hiện Xâm nhập & Mã độc)",
      slug: "cai-dat-wazuh-giam-sat-bao-mat-siem-ubuntu-centos-" + Date.now(),
      content: htmlContent,
      excerpt: "Bên cạnh việc giám sát CPU và RAM, bạn đã bao giờ tự hỏi liệu Server của mình có đang chứa mã độc hay đang bị Hacker tấn công dò mật khẩu? Cùng cài đặt hệ thống giám sát bảo mật siêu cấp Wazuh để biến máy chủ của bạn thành một pháo đài bất khả xâm phạm.",
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
