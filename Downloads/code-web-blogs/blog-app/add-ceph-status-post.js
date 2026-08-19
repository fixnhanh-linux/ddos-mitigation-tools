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
# Giải mã toàn tập lệnh "Ceph Status" (ceph -s) & Kịch bản tự động Cảnh báo

Bất cứ ai từng quản trị Ceph đều biết đến lệnh "thần thánh" \`ceph status\` (hay viết tắt là \`ceph -s\`). Đây là bảng tóm tắt nhịp tim (heartbeat) thời gian thực của toàn bộ hệ thống lưu trữ khổng lồ. 

Bài viết này sẽ "giải phẫu" từng dòng kết quả của lệnh này, đồng thời hướng dẫn bạn viết một đoạn Script tự động kiểm tra \`Ceph Status\` và báo cáo qua Telegram khi có biến!

---

## 1. Sơ đồ các thành phần của Ceph Status (Mindmap)

Khi gõ lệnh \`ceph -s\`, hệ thống sẽ trả về 5 cụm thông tin chính. Sơ đồ dưới đây sẽ phân loại các nhóm thông tin đó:

<pre><code class="language-mermaid">
graph TD
    CEPH_S["Lenh: ceph -s"]
    
    CEPH_S --&gt; CLUSTER["1. Cluster"]
    CEPH_S --&gt; HEALTH["2. Health"]
    CEPH_S --&gt; SERVICES["3. Services (Dich vu)"]
    CEPH_S --&gt; DATA["4. Data (Du lieu)"]
    CEPH_S --&gt; IO["5. Client I/O"]
    
    CLUSTER --&gt; FSID["FSID (ID doc nhat cua Cum)"]
    
    HEALTH --&gt; H_OK["HEALTH_OK / WARN / ERR"]
    
    SERVICES --&gt; MON["MON: So luong va Quorum"]
    SERVICES --&gt; MGR["MGR: Active / Standby"]
    SERVICES --&gt; OSD["OSD: Tong so / So Up / So In"]
    
    DATA --&gt; POOL["Pools: Tong so pool"]
    DATA --&gt; PG["PGs: Trang thai (Active+Clean...)"]
    DATA --&gt; USAGE["Usage: Dung luong Da dung / Tong"]
    
    IO --&gt; RDWR["Client Read/Write (MB/s)"]
    IO --&gt; REC["Recovery I/O (B/s)"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef section fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef detail fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    
    class CEPH_S main;
    class CLUSTER,HEALTH,SERVICES,DATA,IO section;
    class FSID,H_OK,MON,MGR,OSD,POOL,PG,USAGE,RDWR,REC detail;
</code></pre>

---

## 2. Giải phẫu chi tiết output của lệnh \`ceph -s\`

Hãy cùng xem một mẫu kết quả thực tế của lệnh \`ceph -s\` và ý nghĩa của chúng:

\`\`\`text
  cluster:
    id:     a1b2c3d4-e5f6-7a8b-9c0d-1234567890ab  &lt;-- ID định danh duy nhất của cụm
    health: HEALTH_OK                             &lt;-- Tuyệt vời! Cụm đang khỏe mạnh.

  services:
    mon: 3 daemons, quorum pve1,pve2,pve3 (age 3d) &lt;-- Có 3 Monitor đang chạy và đã đồng thuận (Quorum).
    mgr: pve1(active, since 3d), standbys: pve2    &lt;-- Manager đang chạy ở pve1.
    osd: 12 osds: 12 up (since 3d), 12 in (since 1w) &lt;-- 12 ổ cứng khai báo (in), và cả 12 ổ đang cắm điện, kết nối tốt (up).

  data:
    pools:   4 pools, 1024 pgs                    &lt;-- Khởi tạo 4 phân vùng (pool) với 1024 cụm dữ liệu (PG).
    objects: 250k objects, 1.5 TiB                &lt;-- Đang lưu 250 ngàn tập tin (objects), tổng kích thước 1.5 TiB.
    usage:   4.5 TiB used, 10 TiB / 14.5 TiB avail &lt;-- (Lưu ý: 1.5 TiB x 3 bản sao = 4.5 TiB used).
    pgs:     1024 active+clean                    &lt;-- 100% dữ liệu đang ở trạng thái hoàn hảo (Active+Clean).

  io:
    client:   25 MiB/s rd, 10 MiB/s wr, 300 op/s rd, 150 op/s wr  &lt;-- Tốc độ Đọc/Ghi hiện tại của máy ảo Proxmox xuống Ceph.
\`\`\`

**Lưu ý quan trọng:** 
Thông số \`12 up, 12 in\` là thứ bạn phải nhìn vào mỗi ngày. 
- **IN:** OSD đã được khai báo thuộc về cụm.
- **UP:** Tiến trình OSD đang chạy và giao tiếp được với MON. 
Nếu thấy \`11 up, 12 in\` nghĩa là có 1 ổ cứng vừa bị sập!

---

## 3. Viết Bash Script Tự động Kiểm tra Status và Báo Telegram

Bạn không thể lúc nào cũng gõ \`ceph -s\` bằng tay. Đoạn mã bash dưới đây sẽ tự động chạy ngầm, nếu phát hiện chữ \`HEALTH_WARN\` hoặc \`HEALTH_ERR\`, nó sẽ chụp lại log và gửi thẳng vào Telegram cho bạn.

### Sơ đồ Trình tự hoạt động (Sequence Diagram)
<pre><code class="language-mermaid">
sequenceDiagram
    participant Cron as Cronjob (Moi 5 phut)
    participant Script as Bash Script
    participant Ceph as Ceph Cluster
    participant Tele as Telegram API
    participant Admin as Admin Phone

    Cron-&gt;&gt;Script: Kich hoat khao sat
    activate Script
    Script-&gt;&gt;Ceph: Chay lenh 'ceph health'
    Ceph--&gt;&gt;Script: Tra ve trang thai (VD: HEALTH_WARN)
    
    alt Neu la HEALTH_OK
        Script-&gt;&gt;Script: Ket thuc, khong lam gi ca
    else Neu KHAC HEALTH_OK
        Script-&gt;&gt;Ceph: Chay lenh 'ceph -s' de lay chi tiet
        Ceph--&gt;&gt;Script: Tra ve van ban chi tiet
        Script-&gt;&gt;Tele: POST /sendMessage (Kem noi dung)
        activate Tele
        Tele--&gt;&gt;Admin: Ting ting! Ban co tin nhan canh bao
        deactivate Tele
    end
    
    deactivate Script
</code></pre>

### Mã nguồn Script (\`ceph_monitor.sh\`)

Bạn tạo file \`/root/ceph_monitor.sh\` trên Proxmox Node (Node bất kỳ có cài Ceph):

\`\`\`bash
#!/bin/bash

# --- CAU HINH TELEGRAM ---
TOKEN="BOT_TOKEN_CUA_BAN"
CHAT_ID="CHAT_ID_CUA_BAN"
# -------------------------

# Lay trang thai tong the
HEALTH=$(ceph health)

# Kiem tra neu khac HEALTH_OK
if [[ "$HEALTH" != *"HEALTH_OK"* ]]; then
    # Lay chi tiet lenh ceph -s
    DETAILS=$(ceph -s)
    
    # Dinh dang tin nhan gui di
    MESSAGE="🚨 <b>CANH BAO CEPH CLUSTER</b> 🚨%0A%0A"
    MESSAGE+="<b>Trang thai:</b> $HEALTH%0A%0A"
    MESSAGE+="<b>Chi tiet (ceph -s):</b>%0A<pre>$DETAILS</pre>"

    # Gui API den Telegram
    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
         -d chat_id="$CHAT_ID" \
         -d text="$MESSAGE" \
         -d parse_mode="HTML"
fi
\`\`\`

Sau đó cấp quyền thực thi và cho chạy mỗi 5 phút bằng crontab:
\`\`\`bash
chmod +x /root/ceph_monitor.sh
crontab -e
# Them dong nay vao:
# */5 * * * * /root/ceph_monitor.sh
\`\`\`

### 4. Luồng xử lý của lệnh CLI (Mở rộng)

Bạn có bao giờ tự hỏi khi gõ lệnh \`ceph -s\`, dữ liệu từ đâu chui ra nhanh vậy không?

<pre><code class="language-mermaid">
graph LR
    User["Admin gõ 'ceph -s'"] --&gt;|CLI tao Request| Socket["Ceph Client API&lt;br&gt;(librados)"]
    
    Socket --&gt;|Ket noi toi| MON_Active["Active Monitor&lt;br&gt;(Nguoi giam sat ban do)"]
    
    MON_Active --&gt;|Doc du lieu tu RAM| Maps["OSD Map&lt;br&gt;MON Map&lt;br&gt;PG Map"]
    
    Maps --&gt;|Tra ve CLI| User
    
    classDef user fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef socket fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    classDef mon fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef data fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    
    class User user;
    class Socket socket;
    class MON_Active mon;
    class Maps data;
</code></pre>
*Sơ đồ: Lệnh \`ceph -s\` cực kỳ nhẹ, vì nó không đi hỏi từng ổ cứng, mà nó chỉ đọc "Bản đồ" (Map) đã được các Monitor (MON) tổng hợp sẵn trong RAM.*

Chỉ với 1 file Bash Script đơn giản, bạn đã tự tạo cho mình một hệ thống cảnh báo tức thời cực kỳ "xịn xò" cho Ceph rồi đấy!
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
      title: "Giải mã toàn tập lệnh 'Ceph Status' (ceph -s) & Script Cảnh báo tự động qua Telegram",
      slug: "giai-ma-lenh-ceph-status-va-script-canh-bao-telegram-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn đọc hiểu chuyên sâu từng khối thông tin của lệnh ceph status (cluster, health, services, data, io). Đi kèm kịch bản Bash Script tự động kiểm tra sức khỏe Ceph và gửi cảnh báo qua Telegram.",
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
