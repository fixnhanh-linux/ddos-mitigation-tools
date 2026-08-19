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
# Toàn tập Giám sát Ceph Proxmox: Zabbix Template All-in-One, Bắt Log Chi tiết & Phân tích Sự cố

Quản trị hệ thống lưu trữ phân tán Ceph trên Proxmox không phải là chuyện dễ dàng. Khi số lượng dữ liệu và ổ cứng (OSD) tăng lên, bạn cần một công cụ giám sát đủ sâu và đủ nhạy bén.

Bài viết này là "Ultimate Guide" (Cẩm nang cuối cùng), gộp toàn bộ các kỹ năng cần thiết nhất thành một quy trình duy nhất. 

Chúng ta sẽ trải qua 4 nội dung chính:
1. Triển khai cấu hình Zabbix để theo dõi Ceph.
2. Tặng kèm và hướng dẫn cài đặt **Zabbix Template All-in-One** (Kết hợp REST API và Script \`system.run\`).
3. Cấu hình Script lùng sục chi tiết lỗi trong file **Cluster Log**.
4. Giải mã trạng thái \`ceph -s\` và các cách xử lý OSD bị DOWN.

---

## Phần 1: Tích hợp Giám sát Ceph vào Zabbix (Chuẩn bị Môi trường)

Thay vì cài Exporter phức tạp, chúng ta sẽ dùng thẳng Plugin nội bộ của **Zabbix Agent 2** kết hợp với **Zabbix Template All-in-One** (phiên bản đã được độ thêm tính năng).

### 1.1 Sơ đồ Kiến trúc Giám sát Kép (Dual-Engine)

Template All-in-One mà chúng ta sắp dùng sẽ quét Ceph bằng 2 luồng: 
- Luồng 1 (REST API): Dùng Agent 2 lấy toàn bộ JSON thông số băng thông, Pool, độ trễ OSD.
- Luồng 2 (system.run): Chạy bash script để bắt lỗi nhịp tim tức thì.

<pre><code class="language-mermaid">
graph TD
    Template["Zabbix Template: Ceph All-in-One"]
    
    Template --&gt; Engine1["Engine 1: Zabbix Agent 2 (REST API)"]
    Template --&gt; Engine2["Engine 2: Custom Script (system.run)"]
    
    Engine1 --&gt;|Lay JSON| Data1["- Thong so I/O (Read/Write)&lt;br&gt;- Tinh trang Pool / PGs&lt;br&gt;- Chi tiet tung OSD (Fill, Latency)"]
    
    Engine2 --&gt;|Bash Script| Data2["- Item 'Ceph-Status' (Kiem tra Health tuc thi)&lt;br&gt;- Nhan biet ngap lap tuc khi co loi"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef engine fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef data fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    
    class Template main;
    class Engine1,Engine2 engine;
    class Data1,Data2 data;
</code></pre>

### 1.2 Bật RESTful API trên Ceph
Đăng nhập SSH vào node cài Ceph Manager (thường là Proxmox Node 1) và gõ lệnh:
\`\`\`bash
ceph mgr module enable restful
ceph restful create-self-signed-cert
ceph restful create-key zabbix
\`\`\`
&gt; **Lưu ý:** Sau khi tạo key, màn hình sẽ in ra mật khẩu. Hãy lưu lại mật khẩu này.

### 1.3 Cấu hình Zabbix Agent 2 để chạy Script
Mở file \`/etc/zabbix/zabbix_agent2.conf\`, thêm dòng sau để bật quyền chạy \`system.run\` và tắt kiểm tra SSL Ceph:
\`\`\`ini
EnableRemoteCommands=1
Plugins.Ceph.InsecureSkipVerify=true
\`\`\`
Tạo file Script bash để phục vụ cho Template All-in-One:
\`\`\`bash
nano /etc/zabbix/docfile.sh
\`\`\`
Dán nội dung sau (script này trả về 0 nếu Ceph OK, 1 nếu WARN, 2 nếu ERR):
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
Cấp quyền thực thi và khởi động lại dịch vụ:
\`\`\`bash
chmod +x /etc/zabbix/docfile.sh
chown zabbix:zabbix /etc/zabbix/docfile.sh
systemctl restart zabbix-agent2
\`\`\`

---

## Phần 2: Import Zabbix Template All-in-One

Sau khi máy chủ đã sẵn sàng, bạn truy cập vào Web Zabbix.

### Bước 1: Import file Template
Lưu đoạn mã cấu hình dưới đây thành file \`ceph_all_in_one.yaml\` và vào **Configuration -&gt; Templates -&gt; Import** để tải lên.

<details>
<summary><b>[Bấm vào đây để Copy mã nguồn Template YAML]</b></summary>

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
      template: 'Ceph by Zabbix agent 2'
      name: 'Ceph by Zabbix agent 2 (All-in-One)'
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
\`\`\`
*(Ghi chú: Bản đầy đủ của YAML sẽ có chứa toàn bộ Trigger và Item của bạn).*
</details>

### Bước 2: Gán vào Host
- Mở **Configuration -&gt; Hosts**, chọn Proxmox Node của bạn.
- Sang tab **Templates**, thêm \`Ceph by Zabbix agent 2 (All-in-One)\`.
- Sang tab **Macros**, điền 3 biến quan trọng:
  - \`{$CEPH.API.URL}\` : \`https://&lt;IP_NODE_MGR&gt;:8003\`
  - \`{$CEPH.USER}\` : \`zabbix\`
  - \`{$CEPH.API.KEY}\` : *(Mật khẩu bạn đã lưu ở Phần 1)*

Chỉ mất đúng 5 phút, Zabbix của bạn sẽ tự động vẽ ra biểu đồ của toàn bộ OSD và Pool!

---

## Phần 3: Cấu hình Script lùng sục lấy chi tiết Log Cluster Ceph

Giao diện Zabbix rất đẹp để nhìn tổng quan, nhưng để tìm ra nguyên nhân sâu xa (ví dụ: ổ cứng rớt mạng lúc mấy giờ, do lỗi gì), bạn phải cấu hình thêm công cụ quét Log chi tiết.

### Sơ đồ Kiến trúc Ghi Log của Ceph
Mọi OSD đều đẩy log về Node Monitor, sau đó được chép vào file trung tâm \`/var/log/ceph/ceph.log\`.

<pre><code class="language-mermaid">
graph TD
    subgraph Local_Nodes
        OSD1["ceph-osd.0"]
        OSD2["ceph-osd.1"]
    end
    
    subgraph Monitor_Node
        MON["Ceph Monitor"]
        ClusterLog["/var/log/ceph/ceph.log"]
    end
    
    OSD1 --&gt;|Bao loi| MON
    OSD2 --&gt;|Bao loi| MON
    MON --&gt;|Ghi vao file tong| ClusterLog
</code></pre>

### Mã nguồn Script (\`ceph_log_alert.sh\`)
Script này sẽ chạy mỗi 10 phút. Nó quét file \`ceph.log\`, lọc các lỗi \`ERR\`, \`WRN\`, \`FAILED\` và gửi kết quả trực tiếp ra Telegram để bạn đọc ngay lập tức.

\`\`\`bash
nano /root/ceph_log_alert.sh
\`\`\`

\`\`\`bash
#!/bin/bash
TOKEN="BOT_TOKEN_TELEGRAM"
CHAT_ID="CHAT_ID_TELEGRAM"
LOG_FILE="/var/log/ceph/ceph.log"

# Loc ra 10 dong moi nhat chua cac tu khoa loi dac thu cua Ceph
ERROR_LOGS=$(tail -n 500 $LOG_FILE | grep -E " ERR | WRN | down | FAILED " | tail -n 10)

if [ ! -z "$ERROR_LOGS" ]; then
    MESSAGE="🔥 <b>CEPH LOG ALERT</b> 🔥%0A%0A<b>May chu:</b> $(hostname)%0A<b>Chi tiet Log:</b>%0A<pre>$ERROR_LOGS</pre>"
    
    # Chong qua tai ky tu cua API Telegram
    if [ \${#MESSAGE} -gt 4000 ]; then
        MESSAGE="\${MESSAGE:0:4000}... (Log bi cat)</pre>"
    fi

    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT_ID" -d text="$MESSAGE" -d parse_mode="HTML"
fi
\`\`\`

Cấp quyền thực thi và tạo Cronjob:
\`\`\`bash
chmod +x /root/ceph_log_alert.sh
crontab -e
# Them dong: */10 * * * * /root/ceph_log_alert.sh
\`\`\`

---

## Phần 4: Đọc mã lỗi Ceph (ceph -s) và Xử lý Sự cố

Khi nhận được Telegram hoặc cảnh báo đỏ trên Zabbix, bạn cần vào terminal và gõ \`ceph -s\`.

### 4.1 Luồng thông tin của Ceph Status
<pre><code class="language-mermaid">
graph TD
    CEPH_S["Lenh: ceph -s"] --&gt; CLUSTER["Cluster"]
    CEPH_S --&gt; HEALTH["Health (OK/WARN/ERR)"]
    CEPH_S --&gt; SERVICES["Services (MON, MGR, OSD)"]
    CEPH_S --&gt; DATA["Data (Pools, PGs, Usage)"]
</code></pre>

**Điểm mấu chốt nằm ở Services:** \`12 osds: 12 up, 12 in\`
- **IN:** Đã đăng ký với hệ thống.
- **UP:** Ổ cứng vật lý đang cắm, đang chạy. 
Nếu thấy 1 ổ không UP, hệ thống sẽ rơi vào trạng thái \`HEALTH_WARN\`.

### 4.2 Cây Quyết định (Decision Tree) Xử lý OSD bị DOWN

Khi thấy OSD bị văng ra khỏi hệ thống, đừng hoảng loạn, hãy làm theo quy trình flowchart sau:

<pre><code class="language-mermaid">
graph TD
    Start["OSD bi DOWN"] --&gt; CheckPing{"Ping toi Server do duoc khong?"}
    
    CheckPing --&gt;|Khong| NodeDie["Kiem tra cap mang / Nguon Dien dien Node"]
    CheckPing --&gt;|Co| CheckProc{"Gõ: systemctl status ceph-osd@X"}
    
    CheckProc --&gt;|Bi tat / OOM| Restart["Gõ: systemctl start ceph-osd@X"]
    
    Restart --&gt; DidItWork{"OSD chay lai duoc chua?"}
    DidItWork --&gt;|Co| EndOk["Ngoi cho Ceph tu dong bo lai du lieu (Recovery)"]
    DidItWork --&gt;|Khong| CheckDisk["Gõ: dmesg | tail (Kiem tra IO)"]
    
    CheckDisk --&gt;|O cung chet vat ly| Replace["Rut o cung cu, thao tac Thay OSD moi"]
</code></pre>

### 4.3 Khả năng Tự phục hồi dữ liệu (Self-Healing)
Một trong những lý do Ceph vĩ đại là khả năng tự bù đắp lỗi lầm:

<pre><code class="language-mermaid">
sequenceDiagram
    participant OSD as OSD Bi Loi
    participant MON as Ceph Monitor
    participant OSD_Khac as Cac OSD Con Song

    OSD-&gt;&gt;MON: OSD chet, ngung gui nhip tim (Heartbeat)
    MON-&gt;&gt;MON: MON bat canh bao HEALTH_WARN
    
    Note over MON,OSD_Khac: Cho khoang 10 phut
    
    MON-&gt;&gt;MON: MON quyet dinh loai bo (OUT) o cung chet
    MON-&gt;&gt;OSD_Khac: Cap nhat ban do (CRUSH Map)
    
    activate OSD_Khac
    OSD_Khac-&gt;&gt;OSD_Khac: Tu trao doi va nhan ban du lieu sang nhau
    OSD_Khac--&gt;&gt;MON: Hoan tat nhan ban 100% (Recovery/Backfill xong)
    deactivate OSD_Khac
    
    MON-&gt;&gt;MON: Tro ve HEALTH_OK an toan
</code></pre>

**Kết luận:**
Với 1 Template Zabbix All-in-One, 1 đoạn Script cảnh báo Log Telegram cực chuẩn và 1 bộ quy trình xử lý lỗi bài bản, Cụm Proxmox Ceph của bạn giờ đây đã trở thành một "Pháo đài" bất khả xâm phạm. Chúc bạn quản trị tốt!
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

    // Delete the previous Mega post
    const oldMegaPost = await Post.findOne({ title: { $regex: /Cẩm nang Toàn tập Ceph Proxmox: Giám sát Zabbix, Log Chi tiết/i } });
    if (oldMegaPost) {
        await Post.deleteOne({ _id: oldMegaPost._id });
        console.log("Deleted old Mega Post.");
    }

    // Delete the Zabbix Template Sharing post
    const zabbixPost = await Post.findOne({ title: { $regex: /Chia sẻ Zabbix Template All-in-One/i } });
    if (zabbixPost) {
        await Post.deleteOne({ _id: zabbixPost._id });
        console.log("Deleted old Zabbix Post.");
    }

    const htmlContent = marked.parse(markdownContent);

    // Create the ULTIMATE Mega post
    const post = new Post({
      title: "Toàn tập Giám sát Ceph Proxmox: Zabbix Template All-in-One, Bắt Log Chi tiết & Phân tích Sự cố",
      slug: "toan-tap-giam-sat-ceph-proxmox-zabbix-log-su-co-" + Date.now(),
      content: htmlContent,
      excerpt: "Cẩm nang toàn diện nhất: Tích hợp Zabbix Template All-in-One (Agent 2 API + Custom Script), cài đặt Bash script truy vết Cluster Log qua Telegram, và quy trình xử lý sự cố OSD chuyên sâu kèm hệ thống flowchart cực đỉnh.",
      author: authorId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("Ultimate Mega Post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
