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
# Chia sẻ Zabbix Template "All-in-One": Giám sát Ceph toàn diện (API + Custom Script)

Nếu bạn cảm thấy mệt mỏi vì phải cấu hình lắt nhắt nhiều thông số để giám sát cụm Ceph, thì bài viết này là dành cho bạn! 

Hôm nay tôi sẽ chia sẻ một **Zabbix Template tùy chỉnh (Modified Template)**. Đây là phiên bản nâng cấp từ bản gốc "Ceph by Zabbix agent 2", được lai tạo thêm các phương thức giám sát "bạo lực" thông qua Bash Script để mang lại hiệu quả cao nhất.

---

## 1. Template All-in-One này có gì đặc biệt?

Thay vì chỉ dùng 1 phương thức, Template này sử dụng sức mạnh kép (Dual-Engine) để theo dõi Ceph:

<pre><code class="language-mermaid">
graph TD
    Template["Zabbix Template: Ceph All-in-One"]
    
    Template --&gt; Engine1["Engine 1: Zabbix Agent 2 (REST API)"]
    Template --&gt; Engine2["Engine 2: Custom Script (system.run)"]
    
    Engine1 --&gt;|Lay JSON| Data1["- Thong so I/O (Read/Write)&lt;br&gt;- Tinh trang Pool / PGs&lt;br&gt;- Chi tiet tung OSD (Fill, Latency)"]
    
    Engine2 --&gt;|Bash Script| Data2["- Item 'Ceph-Status' (Kiem tra Health tuc thi)&lt;br&gt;- Trigger chu dong quet Log"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef engine fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef data fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    
    class Template main;
    class Engine1,Engine2 engine;
    class Data1,Data2 data;
</code></pre>

- **Phần cốt lõi:** Vẫn dùng Zabbix Agent 2 gọi HTTP tới Port 8003 (Ceph RESTful) để dùng tính năng Low-Level Discovery (LLD) tự động bắt các OSD và Pool.
- **Phần độ thêm:** Tích hợp sẵn Item mang tên **\`Ceph-Status\`** với key \`system.run[/etc/zabbix/docfile.sh]\`. Nhờ vậy, ngay khi Ceph báo HEALTH_WARN, Trigger của Script sẽ nảy ngay lập tức mà không cần chờ parse JSON.

---

## 2. Hướng dẫn 3 Bước Cài đặt Template

### Bước 1: Chuẩn bị Môi trường cho Custom Script
Vì Template này có gọi lệnh shell, bạn cần cho phép Zabbix Agent thực thi lệnh từ xa. Mở SSH vào Node Proxmox/Ceph:

\`\`\`bash
# 1. Cho phep system.run
nano /etc/zabbix/zabbix_agent2.conf
# &gt;&gt; Them dong: EnableRemoteCommands=1
# &gt;&gt; Bo qua SSL Ceph: Plugins.Ceph.InsecureSkipVerify=true

# 2. Restart dich vu
systemctl restart zabbix-agent2
\`\`\`

Tạo file Script trả về trạng thái Ceph:
\`\`\`bash
nano /etc/zabbix/docfile.sh
\`\`\`
Dán nội dung sau:
\`\`\`bash
#!/bin/bash
HEALTH=$(sudo ceph health 2&gt;/dev/null)
if [[ "$HEALTH" == *"HEALTH_OK"* ]]; then
    echo 0
elif [[ "$HEALTH" == *"HEALTH_WARN"* ]]; then
    echo 1
else
    echo 2
fi
\`\`\`
Cấp quyền thực thi:
\`\`\`bash
chmod +x /etc/zabbix/docfile.sh
chown zabbix:zabbix /etc/zabbix/docfile.sh
\`\`\`

### Bước 2: Bật RESTful API trên Ceph
Nếu bạn chưa bật Module này, hãy chạy lệnh:
\`\`\`bash
ceph mgr module enable restful
ceph restful create-self-signed-cert
ceph restful create-key zabbix
\`\`\`
*(Hãy copy lại đoạn mật khẩu API key vừa sinh ra).*

### Bước 3: Import Template vào Zabbix Web
Bạn lưu đoạn cấu hình dưới đây thành file \`ceph_all_in_one.yaml\` và Import vào Zabbix (Configuration -&gt; Templates -&gt; Import):

<details>
<summary><b>Bấm vào đây để Copy mã YAML của Template</b></summary>

\`\`\`yaml
zabbix_export:
  version: '6.2'
  date: '2026-07-28T05:33:29Z'
  template_groups:
    -
      uuid: a571c0d144b14fd4a87a9d9b2aa9fcd6
      name: Templates/Applications
  templates:
    -
      uuid: 09fb25d089f7467f860895f6e71d3fa2
      template: 'Ceph by Zabbix agent 2 (All-in-one)'
      name: 'Ceph by Zabbix agent 2 (All-in-one)'
      groups:
        -
          name: Templates/Applications
      items:
        -
          name: 'Ceph: Get df'
          key: 'ceph.df.details["{$CEPH.CONNSTRING}","{$CEPH.USER}","{$CEPH.API.KEY}"]'
          value_type: TEXT
        -
          name: Ceph-Status
          key: 'system.run[/etc/zabbix/docfile.sh]'
          delay: 30s
          value_type: TEXT
          # (Luu y: Day chi la ban tom luoc de hien thi, YAML day du ban export tu server nhe)
\`\`\`
</details>

### Bước 4: Gán Template cho Host
- Vào **Configuration -&gt; Hosts**, chọn Host Proxmox của bạn.
- Sang tab **Templates**, gõ \`Ceph by Zabbix agent 2 (All-in-one)\`.
- Sang tab **Macros**, điền 3 thông số:
  - \`{$CEPH.API.URL}\` : \`https://&lt;IP_NODE_MGR&gt;:8003\`
  - \`{$CEPH.USER}\` : \`zabbix\`
  - \`{$CEPH.API.KEY}\` : *(API Key ở bước 2)*

## 3. Lời kết
Sự kết hợp giữa **Zabbix Agent 2 API** (chi tiết, đầy đủ dữ liệu) và **system.run** (nhanh, phản ứng tức thì, có thể tùy biến quét log) biến Template này thành vũ khí tối thượng cho bất kỳ hệ thống lưu trữ nào. 

Chỉ cần cài 1 lần, bạn sẽ có toàn bộ biểu đồ I/O băng thông, tình trạng ổ OSD và cả cảnh báo nhịp tim tức thời của Ceph!
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
      title: "Chia sẻ Zabbix Template All-in-One: Giám sát Ceph toàn diện (API + Custom Script)",
      slug: "chia-se-zabbix-template-all-in-one-ceph-" + Date.now(),
      content: htmlContent,
      excerpt: "Chia sẻ và hướng dẫn import Zabbix Template giám sát Ceph phiên bản độ (All-in-one). Kết hợp hoàn hảo giữa Low-Level Discovery của Agent 2 và tốc độ cảnh báo tức thì của bash script system.run.",
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
