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
# Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix (Zabbix Agent 2)

Ở bài trước chúng ta đã tìm hiểu cách giám sát Ceph bằng Prometheus. Tuy nhiên, nếu doanh nghiệp của bạn đang sử dụng **Zabbix** làm hệ thống giám sát trung tâm, bạn hoàn toàn có thể tích hợp Ceph vào Zabbix một cách mượt mà và sâu sát nhất thông qua **Zabbix Agent 2**.

Zabbix Agent 2 hỗ trợ sẵn plugin dành riêng cho Ceph (viết bằng Golang) giúp gọi trực tiếp vào API của Ceph Manager mà không cần bất kỳ script phụ trợ nào.

---

## 1. Sơ đồ Kiến trúc Giám sát Ceph bằng Zabbix Agent 2

Plugin Ceph của Zabbix Agent 2 hoạt động bằng cách kết nối với module REST API của Ceph Manager. Bạn chỉ cần cài Zabbix Agent 2 trên 1 node Proxmox (hoặc nhiều node để dự phòng).

<pre><code class="language-mermaid">
graph TD
    subgraph Proxmox_Cluster
        Node1["Proxmox Node 1"]
        Node2["Proxmox Node 2"]
        Node3["Proxmox Node 3"]
        
        CephMgr["Ceph Manager (Active)&lt;br&gt;Module mgr/restful (Port 8003)"]
        
        Agent2["Zabbix Agent 2&lt;br&gt;(Ceph Plugin)"]
        
        Node1 --&gt;|Chay dich vu| CephMgr
        Agent2 --&gt;|HTTPS GET /server| CephMgr
    end

    subgraph Zabbix_Infrastructure
        ZServer[(Zabbix Server)]
        ZWeb["Zabbix Web Frontend"]
    end
    
    ZServer --&gt;|Passive Check :10050| Agent2
    ZServer --&gt;|Hien thi| ZWeb
    
    classDef pve fill:#c53030,stroke:#fc8181,stroke-width:2px,color:#fff;
    classDef mgr fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef agent fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    classDef zabbix fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    
    class Node1,Node2,Node3 pve;
    class CephMgr mgr;
    class Agent2 agent;
    class ZServer,ZWeb zabbix;
</code></pre>

---

## 2. Các bước Cấu hình Chi tiết

### Sơ đồ Trình tự Triển khai (Sequence Diagram)
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin
    participant Ceph as Ceph Manager
    participant ZAgent as Zabbix Agent 2
    participant ZServer as Zabbix Server

    Admin-&gt;&gt;Ceph: 1. Kich hoat RESTful Module
    Ceph--&gt;&gt;Admin: Port 8003 (Mo)
    
    Admin-&gt;&gt;Ceph: 2. Tao User API cho Zabbix
    Ceph--&gt;&gt;Admin: Tra ve API Key (Password)
    
    Admin-&gt;&gt;ZServer: 3. Add Host, Gan Template Ceph
    Admin-&gt;&gt;ZServer: 4. Dien Macro (URL, User, Pass)
    
    ZServer-&gt;&gt;ZAgent: 5. Yeu cau lay thong tin Ceph
    activate ZAgent
    ZAgent-&gt;&gt;Ceph: 6. Xac thuc &amp; Goi REST API
    Ceph--&gt;&gt;ZAgent: Tra ve file JSON (OSD, Pool, Status)
    ZAgent--&gt;&gt;ZServer: Chuyen tiep Data ve Server
    deactivate ZAgent
</code></pre>

### Bước 1: Kích hoạt RESTful Module trên Ceph
Truy cập vào SSH của node Proxmox bất kỳ và chạy lệnh kích hoạt module RESTful:

\`\`\`bash
# Bật module RESTful
ceph mgr module enable restful

# Tạo chứng chỉ SSL tự ký cho module (Bắt buộc)
ceph restful create-self-signed-cert

# Tạo user API cho Zabbix và lấy Password (API Key)
ceph restful create-key zabbix
\`\`\`
Lệnh cuối cùng sẽ in ra một chuỗi mật khẩu (VD: \`xxxx-yyyy-zzzz\`). Hãy **lưu lại mật khẩu này**.

Kiểm tra xem API đã hoạt động chưa:
\`\`\`bash
curl -k https://&lt;IP_NODE_MGR&gt;:8003/server
\`\`\`

### Bước 2: Cấu hình Zabbix Agent 2
Zabbix Agent 2 có thể không cần sửa cấu hình local nếu bạn dùng Macro trên Zabbix Web. Bạn chỉ cần đảm bảo Agent 2 đã cài trên node Proxmox và dịch vụ đang chạy:
\`\`\`bash
apt install zabbix-agent2
systemctl enable zabbix-agent2 --now
\`\`\`
*(Đảm bảo trong \`/etc/zabbix/zabbix_agent2.conf\` đã trỏ \`Server=\` về IP của Zabbix Server).*

### Bước 3: Cấu hình trên Zabbix Web
1. Đăng nhập vào Zabbix Frontend.
2. Vào **Data collection** -&gt; **Hosts** -&gt; Tạo mới hoặc chọn Host Proxmox đã cài Agent 2.
3. Ở phần **Templates**, tìm và gán template chính thức: \`Ceph by Zabbix agent 2\`.
4. Chuyển sang tab **Macros**, nhấn **Inherited and host macros**, tìm và thay đổi các giá trị sau:
   - \`{$CEPH.API.URL}\` : \`https://&lt;IP_NODE_MGR&gt;:8003\`
   - \`{$CEPH.USER}\` : \`zabbix\`
   - \`{$CEPH.PASSWORD}\` : *(Nhập API Key bạn lấy ở Bước 1)*
5. Nhấn **Update** để lưu.

---

## 3. Cơ chế Khám phá tự động (Low-Level Discovery)

Plugin Ceph của Zabbix Agent 2 cực kỳ thông minh. Nó sẽ kết nối vào API một lần và tự động tạo ra hàng loạt Items cho hệ thống bằng cơ chế LLD.

<pre><code class="language-mermaid">
graph LR
    API["Ceph REST API&lt;br&gt;(JSON Payload)"] --&gt;|Parse boi Agent 2| LLD["Zabbix LLD Engine"]
    
    LLD --&gt;|Khám phá OSD| OSD["Ceph OSDs&lt;br&gt;(osd.0, osd.1...)"]
    LLD --&gt;|Khám phá Pool| Pool["Ceph Pools&lt;br&gt;(rbd, cephfs...)"]
    LLD --&gt;|Khám phá MON| MON["Ceph Monitors&lt;br&gt;(pve1, pve2)"]
    
    OSD --&gt; Metric1[Latency, IOPS]
    Pool --&gt; Metric2[Read/Write Bytes, Dung luong]
    MON --&gt; Metric3[Quorum Status]
    
    classDef api fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef lld fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef resource fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    classDef metric fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    
    class API api;
    class LLD lld;
    class OSD,Pool,MON resource;
    class Metric1,Metric2,Metric3 metric;
</code></pre>

### 4. Xử lý lỗi thường gặp
- **Lỗi SSL Certificate:** Vì chứng chỉ tự ký sinh ra ở Bước 1 là "Insecure", Zabbix Agent 2 đôi khi sẽ từ chối kết nối. Để khắc phục, mở file \`/etc/zabbix/zabbix_agent2.conf\` và thêm dòng này vào cuối:
  \`\`\`ini
  Plugins.Ceph.InsecureSkipVerify=true
  \`\`\`
  Sau đó khởi động lại Agent: \`systemctl restart zabbix-agent2\`.

- **MGR Active bị đổi Node (Failover):** Nếu node đang chạy MGR Active bị sập, IP trong cấu hình \`{$CEPH.API.URL}\` có thể bị chết. Để an toàn, bạn nên thiết lập **HAProxy** hoặc cấu hình Macro chỉ tới Virtual IP / DNS Round-Robin thay vì trỏ thẳng IP vật lý.

Chúc bạn thành công với việc hợp nhất Ceph Monitoring vào hệ sinh thái Zabbix!
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
      title: "Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix (Zabbix Agent 2)",
      slug: "huong-dan-monitor-ceph-proxmox-zabbix-agent-2-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn thiết lập plugin Ceph tích hợp sẵn trên Zabbix Agent 2, giao tiếp với Ceph RESTful API để giám sát Proxmox Ceph một cách toàn diện và sâu sát. Kèm 3 sơ đồ chi tiết.",
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
