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
# Hướng dẫn tạo Item "Ceph-Status" bằng lệnh system.run trong Zabbix

Ngoài việc dùng Zabbix Agent 2 với REST API (như hướng dẫn trước), rất nhiều Admin thích một cách tiếp cận **"cổ điển, linh hoạt và bạo lực"** hơn: Tự viết Bash Script và cho Zabbix gọi trực tiếp thông qua hàm \`system.run[]\`.

Dựa trên cấu hình thực tế, bài viết này sẽ hướng dẫn bạn cách thiết lập một Item có tên **Ceph-Status** chạy bằng kịch bản \`/etc/zabbix/docfile.sh\`.

---

## 1. Cơ chế hoạt động của \`system.run\`

Mặc định, Zabbix Agent không cho phép Server tùy ý thực thi lệnh shell trên máy Client để đảm bảo bảo mật. Để có thể chạy được key \`system.run[/etc/zabbix/docfile.sh]\`, Zabbix Agent sẽ đóng vai trò như một cầu nối:

<pre><code class="language-mermaid">
sequenceDiagram
    participant ZWeb as Zabbix Server
    participant ZAgent as Zabbix Agent (Client)
    participant OS as Linux OS (Proxmox)
    participant Ceph as Ceph Cluster

    ZWeb-&gt;&gt;ZAgent: Gui yeu cau: system.run[/etc/zabbix/docfile.sh]
    activate ZAgent
    
    ZAgent-&gt;&gt;ZAgent: Kiem tra quyen (EnableRemoteCommands)
    ZAgent-&gt;&gt;OS: Thuc thi shell script (quyen zabbix)
    activate OS
    OS-&gt;&gt;Ceph: Chay lenh 'ceph health'
    Ceph--&gt;&gt;OS: Tra ve 'HEALTH_OK'
    OS-&gt;&gt;OS: Xu ly chuoi va bien thanh con so (VD: 0)
    OS--&gt;&gt;ZAgent: Ket qua = 0
    deactivate OS
    
    ZAgent--&gt;&gt;ZWeb: Tra gia tri 0 ve he thong
    deactivate ZAgent
</code></pre>

---

## 2. Các bước triển khai chi tiết

### Bước 1: Cho phép Zabbix Agent chạy lệnh từ xa
Mở file cấu hình của Zabbix Agent trên máy Proxmox/Ceph (thường là \`/etc/zabbix/zabbix_agentd.conf\` hoặc \`/etc/zabbix/zabbix_agent2.conf\`):
\`\`\`bash
nano /etc/zabbix/zabbix_agentd.conf
\`\`\`
Tìm và sửa (hoặc thêm) hai dòng sau:
\`\`\`ini
EnableRemoteCommands=1
LogRemoteCommands=1
\`\`\`
Khởi động lại Zabbix Agent:
\`\`\`bash
systemctl restart zabbix-agent
\`\`\`

### Bước 2: Tạo kịch bản \`docfile.sh\`
Bạn tạo một file script tại đúng đường dẫn mà Item gọi tới. Mục đích của script này là gọi lệnh \`ceph health\` và trả về một con số nguyên để Zabbix dễ dàng gắn Trigger cảnh báo (0 = OK, 1 = WARN, 2 = ERR).

\`\`\`bash
nano /etc/zabbix/docfile.sh
\`\`\`
Dán nội dung sau vào:
\`\`\`bash
#!/bin/bash

# Vi chay duoi quyen user 'zabbix', can chi dinh ro duong dan lenh ceph
HEALTH=$(sudo ceph health 2&gt;/dev/null)

if [[ "$HEALTH" == *"HEALTH_OK"* ]]; then
    echo 0
elif [[ "$HEALTH" == *"HEALTH_WARN"* ]]; then
    echo 1
elif [[ "$HEALTH" == *"HEALTH_ERR"* ]]; then
    echo 2
else
    # Truong hop khong the ket noi toi Ceph
    echo 3 
fi
\`\`\`

**Rất quan trọng - Cấp quyền cho script:**
\`\`\`bash
chmod +x /etc/zabbix/docfile.sh
chown zabbix:zabbix /etc/zabbix/docfile.sh
\`\`\`

*(Lưu ý: Vì user \`zabbix\` mặc định không có quyền chạy lệnh ceph, bạn phải thêm zabbix vào file sudoers không cần password, hoặc cấp quyền đọc file keyring ceph cho group zabbix).*

### Bước 3: Cấu hình Item trên Zabbix Web
Đăng nhập vào Zabbix Web, tạo một Item mới với các thông số sau:
- **Name:** Ceph-Status
- **Type:** Zabbix agent
- **Key:** \`system.run[/etc/zabbix/docfile.sh]\`
- **Type of information:** Numeric (unsigned)
- **Update interval:** 30s hoặc 1m
- **History storage period:** 90d

### Bước 4: Tạo Triggers cảnh báo
Bây giờ, vì kết quả trả về là số, việc tạo Trigger cực kỳ dễ dàng:
- **Cảnh báo Warning:** \`last(/Host/system.run[/etc/zabbix/docfile.sh])=1\`
- **Cảnh báo Disaster:** \`last(/Host/system.run[/etc/zabbix/docfile.sh])=2\`
- **Cảnh báo Unknown/Mất kết nối:** \`last(/Host/system.run[/etc/zabbix/docfile.sh])=3\`

---

## 3. Tổng kết ưu nhược điểm của \`system.run\`

<pre><code class="language-mermaid">
graph LR
    SystemRun["system.run[script.sh]"]
    
    SystemRun --&gt;|Uu diem| Uu1["Tuy bien 100% logic bang Bash/Python"]
    SystemRun --&gt;|Uu diem| Uu2["Khong can cau hinh API phuc tap"]
    
    SystemRun --&gt;|Nhuoc diem| Nhuoc1["Rui ro bao mat (Remote Code Execution)"]
    SystemRun --&gt;|Nhuoc diem| Nhuoc2["Kho quan ly hang loat khi co nhieu server"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef pro fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    classDef con fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    
    class SystemRun main;
    class Uu1,Uu2 pro;
    class Nhuoc1,Nhuoc2 con;
</code></pre>

Phương pháp này cực kỳ hiệu quả cho những hệ thống cần triển khai nhanh hoặc cần nhúng thêm các logic kiểm tra đặc thù của riêng doanh nghiệp mà các Template có sẵn của Zabbix không làm được!
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

    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn cấu hình Item 'Ceph-Status' bằng system.run trong Zabbix",
      slug: "huong-dan-cau-hinh-item-ceph-status-bang-system-run-" + Date.now(),
      content: htmlContent,
      excerpt: "Bí quyết triển khai Item tùy chỉnh Ceph-Status bằng system.run[/etc/zabbix/docfile.sh] để giám sát Ceph mà không cần cấu hình REST API. Phân tích luồng thực thi lệnh và cách gán Trigger cảnh báo.",
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
