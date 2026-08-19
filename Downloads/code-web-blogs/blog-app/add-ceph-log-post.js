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
# Hướng dẫn viết Script trích xuất và Cảnh báo Log chi tiết của Ceph Cluster

Nếu như \`ceph -s\` chỉ cho bạn biết tình trạng "bề nổi" của tảng băng chìm, thì **Cluster Log** chính là hồ sơ bệnh án ghi lại toàn bộ "bề chìm" của hệ thống Ceph: từng ổ OSD bị rớt mạng chập chờn, từng đợt dọn dẹp Scrubbing, hay các lỗi xác thực đều nằm trong Log.

Bài viết này sẽ cung cấp cho bạn một **kịch bản (Bash Script) cực kỳ tối ưu** để tự động dò quét các dòng lỗi (ERR/WARN) trong Cluster Log và gửi báo cáo chi tiết về Telegram (hoặc Zabbix).

---

## 1. Kiến trúc Ghi Log của cụm Ceph (Logging Architecture)

Trước khi viết script lấy log, chúng ta cần hiểu log của Ceph được sinh ra và lưu trữ như thế nào. 

Trong một cụm Ceph, mọi tiến trình con (OSD, MGR, MDS) đều đẩy log cục bộ của chúng (local logs) về cho các **Monitor (MON)**. Monitor sẽ tổng hợp lại thành một file duy nhất gọi là **Cluster Log**.

<pre><code class="language-mermaid">
graph TD
    subgraph Local_Nodes
        OSD1["ceph-osd.0&lt;br&gt;(/var/log/ceph/ceph-osd.0.log)"]
        OSD2["ceph-osd.1&lt;br&gt;(/var/log/ceph/ceph-osd.1.log)"]
        MGR["ceph-mgr.pve1&lt;br&gt;(/var/log/ceph/ceph-mgr.pve1.log)"]
    end
    
    subgraph Monitor_Quorum
        MON["Active Ceph Monitor&lt;br&gt;(Nguoi tong hop Log)"]
    end
    
    subgraph Centralized_Log
        ClusterLog["Ceph Cluster Log&lt;br&gt;(/var/log/ceph/ceph.log)"]
    end
    
    OSD1 --&gt;|Gui tin nhan loi| MON
    OSD2 --&gt;|Gui tin nhan loi| MON
    MGR --&gt;|Gui thong tin| MON
    
    MON --&gt;|Ghi vao file tong| ClusterLog
    
    classDef node fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef mon fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    classDef log fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    
    class OSD1,OSD2,MGR node;
    class MON mon;
    class ClusterLog log;
</code></pre>

Chính vì vậy, để phân tích tình hình toàn cụm, chúng ta **chỉ cần đọc file \`/var/log/ceph/ceph.log\`** trên node đang chạy Monitor là đủ!

---

## 2. Kịch bản Bash Script (Extract & Alert)

Yêu cầu đặt ra: Cứ mỗi 10 phút, Script sẽ chạy để quét file log. Nếu phát hiện ra các từ khóa như \`ERR\`, \`WRN\` (Warning) hoặc \`FAILED\`, nó sẽ trích xuất 20 dòng gần nhất chứa lỗi đó và gửi đi.

### Sơ đồ thuật toán của Script

<pre><code class="language-mermaid">
sequenceDiagram
    participant Cron
    participant Script
    participant LogFile as /var/log/ceph/ceph.log
    participant Telegram

    Cron-&gt;&gt;Script: Chay moi 10 phut
    activate Script
    Script-&gt;&gt;LogFile: Kiem tra su thay doi (tail &amp; grep)
    LogFile--&gt;&gt;Script: Tra ve 20 dong log moi nhat
    
    Script-&gt;&gt;Script: Loc ra dong chua 'ERR', 'WRN', 'down'
    
    alt Co loi xay ra
        Script-&gt;&gt;Script: Dinh dang log thanh HTML/Markdown
        Script-&gt;&gt;Telegram: POST gui toan bo chi tiet Log
        Telegram--&gt;&gt;Admin: Ting ting! (Doc log truc tiep tren Dien thoai)
    else Khong co loi
        Script-&gt;&gt;Script: Thoat êm ru (Silent)
    end
    deactivate Script
</code></pre>

### 3. Triển khai Mã nguồn (Code)

Bạn hãy SSH vào Node đang chạy Ceph Monitor (thường là Proxmox Node 1), tạo file script:

\`\`\`bash
nano /root/ceph_log_alert.sh
\`\`\`

Dán nội dung siêu xịn này vào:

\`\`\`bash
#!/bin/bash

# CAU HINH TELEGRAM
TOKEN="BOT_TOKEN_CUA_BAN"
CHAT_ID="CHAT_ID_CUA_BAN"

# Duong dan file cluster log
LOG_FILE="/var/log/ceph/ceph.log"

# Dung journalctl neu log he thong ghi vao systemd (Proxmox 7/8 thuong dung cai nay)
# LOG_CMD="journalctl -u ceph-mon@$(hostname) --since '10 minutes ago'"

# Dung tail neu doc truc tiep tu file ceph.log
LOG_CMD="tail -n 500 $LOG_FILE"

# Loc ra cac dong chua ERR hoac WRN (bo qua cac log thong thuong)
ERROR_LOGS=$(eval $LOG_CMD | grep -E " ERR | WRN | down | FAILED " | tail -n 10)

if [ ! -z "$ERROR_LOGS" ]; then
    # Header cua tin nhan
    MESSAGE="🔥 <b>CEPH CLUSTER LOG ALERT</b> 🔥%0A%0A"
    MESSAGE+="<b>Thoi gian:</b> $(date '+%Y-%m-%d %H:%M:%S')%0A"
    MESSAGE+="<b>May chu:</b> $(hostname)%0A%0A"
    MESSAGE+="<b>Chi tiet Log:</b>%0A<pre>$ERROR_LOGS</pre>"
    
    # Neu log qua dai, Telegram se tu choi, chung ta can gioi han ky tu
    if [ \${#MESSAGE} -gt 4000 ]; then
        MESSAGE="\${MESSAGE:0:4000}... (Log da bi cat bot)</pre>"
    fi

    # Gui API den Telegram
    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
         -d chat_id="$CHAT_ID" \
         -d text="$MESSAGE" \
         -d parse_mode="HTML"
fi
\`\`\`

### 4. Phân tích điểm ưu việt của Script này
1. **Lệnh Grep Regex (\`-E\`):** Script sử dụng biểu thức chính quy (Regex) để bắt đúng chữ \` ERR \` (có khoảng trắng) thay vì \`error\` (để tránh bắt nhầm các từ không quan trọng).
2. **Cơ chế giới hạn dòng (\`tail -n 10\`):** Giả sử hệ thống sập mạng, file log sinh ra 10.000 dòng lỗi, nếu gửi hết sẽ làm đứng app Telegram. Script chỉ gửi 10 dòng lỗi mới nhất để bạn nắm tình hình.
3. **Chống quá tải API:** Cơ chế đếm ký tự (\`\${#MESSAGE} -gt 4000\`) giúp cắt bớt log nếu tin nhắn vượt quá giới hạn 4096 ký tự của Telegram.

**Cấp quyền và đưa vào chạy tự động:**
\`\`\`bash
chmod +x /root/ceph_log_alert.sh
crontab -e
# Kiem tra log lien tuc moi 10 phut:
# */10 * * * * /root/ceph_log_alert.sh
\`\`\`

Vậy là xong! Chỉ với một đoạn script ngắn gọn, cụm Ceph của bạn giờ đây đã có hẳn một "hệ thống giám sát vi phân" – báo cáo từng nhịp thở, từng tiến trình OSD ngay lập tức khi có biến!
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
      title: "Cấu hình Script trích xuất và cảnh báo Log chi tiết của Ceph Cluster",
      slug: "cau-hinh-script-trich-xuat-log-chi-tiet-ceph-cluster-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn kiến trúc ghi log của Ceph và cách viết Bash Script tự động dùng regex quét các lỗi (ERR, WARN) sâu trong /var/log/ceph/ceph.log để cảnh báo qua Telegram.",
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
