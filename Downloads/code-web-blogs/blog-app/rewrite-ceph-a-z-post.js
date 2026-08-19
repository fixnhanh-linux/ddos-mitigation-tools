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
# Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z

Giám sát cụm Ceph trên Proxmox bằng Zabbix giúp bạn nắm bắt chính xác trạng thái hoạt động của hệ thống lưu trữ phân tán. Trong bài viết này, tôi sẽ hướng dẫn chi tiết từ A-Z cách cấu hình RESTful API trên Ceph, và đặc biệt là cách viết bash script (đẩy vào crontab) để Zabbix Agent đọc log trạng thái tức thời cực kỳ chính xác!

---

## 1. Cấu hình trên Host Proxmox (Bật RESTful API)

Để Zabbix có thể kéo dữ liệu (JSON) về số lượng OSD, Pool, cấu hình... chúng ta cần dùng module \`restful\` của Ceph Manager (MGR).

### Các bước kiểm tra và thực hiện:
1. **Tìm Node đang làm Active Manager:** Dùng lệnh \`ceph -s\` để check xem host nào đang là head node mgr (Active Monitor/Manager). Sau đó truy cập SSH vào host đó.
2. **Kiểm tra Module Restful:** Kiểm tra xem module này đã được bật hay chưa.
3. **Kiểm tra Port 8003:** Nếu module đã bật, gõ lệnh \`ss -lnt\` để xem port 8003 đã mở (listen) chưa.
4. **Xử lý nếu Port chưa mở:** Nếu chưa mở, thực hiện restart lại module restful. Nếu module báo online mà port vẫn chưa mở, hãy SSH sang các host (node) khác trong cụm Ceph kiểm tra xem port 8003 đang mở ở đâu để tiến hành cấu hình tiếp ở đó.

### Cấu hình bằng Dòng lệnh (CLI)
Trên node đang chạy Active MGR, hãy gõ tuần tự các lệnh sau:

\`\`\`bash
# 1. Bat module restful
ceph mgr module enable restful

# 2. Tao user (key) cho zabbix-monitor
ceph restful create-key zabbix-monitor

# 3. Tao chung chi tu ky (Self-signed Cert) de chay HTTPS
ceph restful create-self-signed-cert

# 4. Kiem tra danh sach key hien co (Day la noi ban lay API Key password de nhap vao Zabbix)
ceph restful list-keys

# 5. Khoi dong lai module de ap dung
ceph restful restart
\`\`\`

### Test thử API bằng CURL
Sau khi có API Key (chuỗi UUID), bạn có thể test trực tiếp bằng CURL để xem dữ liệu JSON trả về. Cú pháp như sau:
\`\`\`bash
# curl -k https://&lt;USER&gt;:&lt;API_KEY&gt;@127.0.0.1:8003/server
curl -k https://zabbix-monitor:02af02fa-9994-47f3-a970-0c8101005c7c@127.0.0.1:8003/server
\`\`\`
*(Sau bước này, bạn nhập URL, User và API Key vào Macro của Template Ceph trên Zabbix Web là Zabbix có thể tự động lấy dữ liệu về).*

---

## 2. Cấu hình Script lấy chi tiết Log Cluster Ceph (Zabbix Agent)

Đây là bí kíp thực chiến để lấy chính xác thông tin lệnh \`ceph health\` ghi ra file text, và dùng Zabbix Agent gọi script đọc file đó lên (thường kết hợp với item \`system.run\` trên Zabbix).

Chúng ta sẽ tạo 2 đoạn script: một cái chạy định kỳ bằng Crontab để ghi log, một cái dùng để Zabbix đọc log.

### Thực hiện từng bước:

Đầu tiên, di chuyển vào thư mục của Zabbix Agent và tạo các file cần thiết:
\`\`\`bash
cd /etc/zabbix/
touch cephstatus.txt docfile.sh cephstatus.sh

# Cap quyen thuc thi
chmod +x cephstatus.txt
chmod +x docfile.sh
chmod +x cephstatus.sh
\`\`\`

#### Viết nội dung cho cephstatus.sh (Ghi Log)
Script này có nhiệm vụ chạy lệnh \`ceph health\`, đè kết quả vào file txt, và ghi tiếp ngày giờ xuống dòng dưới.

\`\`\`bash
cat &lt;&lt; EOF &gt; /etc/zabbix/cephstatus.sh
#!/bin/sh
ceph health &gt; /etc/zabbix/cephstatus.txt
date &gt;&gt; /etc/zabbix/cephstatus.txt
EOF
\`\`\`

#### Viết nội dung cho docfile.sh (Đọc Log)
Script này dùng để đọc nội dung file text vừa ghi, gán vào biến và in ra ngoài. Đây là file mà Zabbix sẽ gọi!

\`\`\`bash
nano /etc/zabbix/docfile.sh
\`\`\`
Dán đoạn mã sau vào:
\`\`\`bash
#!/bin/sh
value=\$(cat /etc/zabbix/cephstatus.txt)
echo "\$value"
\`\`\`

*(Lưu ý: Trong code bash, gán biến phải dùng cú pháp \`value=\$(cat file)\` thay vì \`value= cat file\` để tránh lỗi).*

### Test Script và Đặt lịch (Cronjob)
Chạy thử 2 file vừa tạo xem có lỗi gì không:
\`\`\`bash
./cephstatus.sh
./docfile.sh
\`\`\`
Nếu kết quả in ra dòng chữ kiểu như \`HEALTH_OK\\nTue Jul 28...\` là chuẩn!

Cuối cùng, chúng ta đưa file \`cephstatus.sh\` vào lịch trình chạy tự động mỗi phút của hệ thống Linux:
\`\`\`bash
crontab -e
\`\`\`
Thêm dòng sau vào dưới cùng:
\`\`\`bash
* * * * * /etc/zabbix/cephstatus.sh
\`\`\`

---

## 3. Hoàn tất trên Zabbix Web

Trên Zabbix, bạn chỉ cần gán Template **"Ceph by Zabbix agent 2"** và thêm một Item tùy chỉnh với key:
\`\`\`text
system.run[/etc/zabbix/docfile.sh]
\`\`\`
Mỗi phút, Crontab sẽ chạy ngầm \`ceph health\` và lưu vào file. Cùng lúc đó Zabbix Server sẽ truy xuất vào file này thông qua script \`docfile.sh\`. Bạn sẽ có một hệ thống giám sát Ceph kép: vừa mạnh mẽ toàn diện (qua REST API), vừa phản hồi siêu tốc (qua Bash script)! Chúc các bạn cấu hình thành công!
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
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    // Xóa bài Mega Post cũ
    const megaPost = await Post.findOne({ title: { $regex: /Toàn tập Giám sát Ceph Proxmox/i } });
    if (megaPost) {
        await Post.deleteOne({ _id: megaPost._id });
        console.log("Deleted old mega post.");
    }

    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z",
      slug: "huong-dan-monitor-ceph-proxmox-zabbix-full-a-z-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn chi tiết từ A-Z cấu hình giám sát Ceph trên Proxmox với Zabbix. Bao gồm cấu hình RESTful API và viết script crontab ghi log trạng thái (ceph health) cho Zabbix Agent gọi qua system.run.",
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
