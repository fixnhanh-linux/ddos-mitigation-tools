const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const markdownContent = `
# Cẩm nang Toàn tập Ceph Proxmox: Giám sát Zabbix, Log Chi tiết & Xử lý sự cố

Ceph là hệ thống lưu trữ phân tán mạnh mẽ và là xương sống của nhiều cụm ảo hóa Proxmox VE. Việc làm chủ Ceph không chỉ dừng lại ở việc cài đặt, mà bạn phải biết cách giám sát nó 24/7, hiểu rõ các thông số sức khỏe và tự tin xử lý sự cố khi có ổ cứng (OSD) bị hỏng.

Cẩm nang này được xây dựng như một tài liệu "Tất cả trong một" (All-in-one), bao gồm 5 phần chính để giám sát Ceph ở cấp độ cao nhất:
1. Tích hợp Ceph vào Zabbix thông qua Zabbix Agent 2 (REST API).
2. Tích hợp Ceph vào Zabbix bằng thủ thuật \`system.run\` (Custom Script).
3. Đọc hiểu kết quả lệnh \`ceph -s\` và các cấp độ cảnh báo (HEALTH_WARN, ERR).
4. Viết Script tự động cảnh báo \`ceph status\` qua Telegram.
5. Viết Script quét chuyên sâu file Log (Cluster Log) để truy vết lỗi.

---

## Phần 1: Tích hợp Giám sát Ceph vào Zabbix (Agent 2)

Thay vì sử dụng các Exporter phức tạp, Zabbix Agent 2 hỗ trợ sẵn một plugin nội bộ (viết bằng Golang) giúp gọi trực tiếp vào module RESTful của Ceph Manager.

### 1.1 Sơ đồ Kiến trúc Giám sát Ceph bằng Zabbix Agent 2

Bạn chỉ cần cài Zabbix Agent 2 trên 1 node Proxmox (hoặc nhiều node để dự phòng).

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

### 1.2 Trình tự Triển khai (Zabbix Agent 2)
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin
    participant Ceph as Ceph Manager
    participant ZAgent as Zabbix Agent 2
    participant ZServer as Zabbix Server

    Admin-&gt;&gt;Ceph: Kich hoat RESTful Module
    Ceph--&gt;&gt;Admin: Mo Port 8003
    
    Admin-&gt;&gt;Ceph: Tao User API cho Zabbix
    Ceph--&gt;&gt;Admin: Tra ve API Key (Password)
    
    Admin-&gt;&gt;ZServer: Add Host, Gan Template Ceph
    Admin-&gt;&gt;ZServer: Dien Macro (URL, User, Pass)
    
    ZServer-&gt;&gt;ZAgent: Yeu cau lay thong tin Ceph
    activate ZAgent
    ZAgent-&gt;&gt;Ceph: Xac thuc &amp; Goi REST API
    Ceph--&gt;&gt;ZAgent: Tra ve JSON (OSD, Pool, Status)
    ZAgent--&gt;&gt;ZServer: Chuyen tiep ve Server
    deactivate ZAgent
</code></pre>

**Thực thi trên Proxmox:**
\`\`\`bash
ceph mgr module enable restful
ceph restful create-self-signed-cert
ceph restful create-key zabbix
\`\`\`

**Trên Zabbix Web:** 
Gán template **Ceph by Zabbix agent 2** vào host. Điền Macros:
- \`{$CEPH.API.URL}\` : \`https://&lt;IP_NODE_MGR&gt;:8003\`
- \`{$CEPH.USER}\` : \`zabbix\`
- \`{$CEPH.PASSWORD}\` : *(API Key ở bước trên)*.

*(Mẹo: Mở \`/etc/zabbix/zabbix_agent2.conf\`, thêm dòng \`Plugins.Ceph.InsecureSkipVerify=true\` để tắt kiểm tra SSL).*

---

## Phần 2: (Nâng cao) Giám sát bằng Item Tùy chỉnh (system.run)

Nếu bạn không thích dùng API, bạn có thể tự viết Script và cho Zabbix gọi nó thông qua tính năng \`system.run\`.

<pre><code class="language-mermaid">
sequenceDiagram
    participant ZWeb as Zabbix Server
    participant ZAgent as Zabbix Agent
    participant Ceph as Ceph Cluster

    ZWeb-&gt;&gt;ZAgent: Yeu cau: system.run[/etc/zabbix/docfile.sh]
    ZAgent-&gt;&gt;Ceph: Chay file shell script (Goi lenh ceph health)
    Ceph--&gt;&gt;ZAgent: Tra ve 'HEALTH_OK'
    ZAgent--&gt;&gt;ZWeb: Ket qua = 0 (OK)
</code></pre>

**Cách làm:**
1. Bật \`EnableRemoteCommands=1\` trong \`/etc/zabbix/zabbix_agentd.conf\`.
2. Tạo file \`/etc/zabbix/docfile.sh\` với nội dung trả về số 0 nếu OK, 1 nếu WARN, 2 nếu ERR.
3. Trên Zabbix, tạo Item với key \`system.run[/etc/zabbix/docfile.sh]\` và cấu hình Trigger cảnh báo tương ứng.

---

## Phần 3: Giải mã lệnh "Ceph Status" và Lỗi Sức khỏe

### 3.1 Cấu trúc Mindmap của lệnh \`ceph -s\`

<pre><code class="language-mermaid">
graph TD
    CEPH_S["Lenh: ceph -s"]
    
    CEPH_S --&gt; CLUSTER["Cluster"]
    CEPH_S --&gt; HEALTH["Health (OK/WARN/ERR)"]
    CEPH_S --&gt; SERVICES["Services (MON, MGR, OSD)"]
    CEPH_S --&gt; DATA["Data (Pools, PGs)"]
    CEPH_S --&gt; IO["Client I/O"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef section fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    class CEPH_S main;
    class CLUSTER,HEALTH,SERVICES,DATA,IO section;
</code></pre>

**Điểm mấu chốt:** Hãy nhìn vào dòng \`12 osds: 12 up, 12 in\`. 
Nếu thấy \`11 up, 12 in\` nghĩa là có 1 ổ cứng đang nằm im bất động (DOWN)!

### 3.2 Cây Quyết định xử lý OSD bị lỗi (Decision Tree)
<pre><code class="language-mermaid">
graph TD
    Start["OSD bi DOWN"] --&gt; CheckPing{"Ping toi Server do duoc khong?"}
    CheckPing --&gt;|Khong| NodeDie["Sua loi mang / Reboot Server"]
    CheckPing --&gt;|Co| CheckProc{"systemctl status ceph-osd@X"}
    CheckProc --&gt;|Chet| Restart["systemctl start ceph-osd@X"]
    Restart --&gt; DidItWork{"Start thanh cong?"}
    DidItWork --&gt;|Co| EndOk["Cho Ceph tu Recovery"]
    DidItWork --&gt;|Khong| CheckDisk["Kiem tra O cung (dmesg, smartctl)"]
    CheckDisk --&gt;|Chet vat ly| Replace["Thay OSD moi"]
</code></pre>

---

## Phần 4: Script Tự động Cảnh báo Ceph Status qua Telegram

Thay vì mở Zabbix, đoạn Script Bash chạy ngầm này sẽ báo tin cho bạn mỗi khi Ceph mất trạng thái \`HEALTH_OK\`.

<pre><code class="language-mermaid">
sequenceDiagram
    participant Cron as Cronjob (5 phut)
    participant Script as Bash Script
    participant Ceph as Ceph Cluster
    participant Tele as Telegram API

    Cron-&gt;&gt;Script: Kich hoat khao sat
    Script-&gt;&gt;Ceph: Chay lenh 'ceph health'
    
    alt Neu la HEALTH_OK
        Script-&gt;&gt;Script: Ket thuc, an toan
    else Khac HEALTH_OK
        Script-&gt;&gt;Ceph: Chay 'ceph -s' de lay nguyen nhan
        Ceph--&gt;&gt;Script: Chi tiet van ban
        Script-&gt;&gt;Tele: POST den Telegram
    end
</code></pre>

**Mã nguồn (\`/root/ceph_monitor.sh\`):**
\`\`\`bash
#!/bin/bash
TOKEN="BOT_TOKEN_CUA_BAN"
CHAT_ID="CHAT_ID_CUA_BAN"

HEALTH=$(ceph health)
if [[ "$HEALTH" != *"HEALTH_OK"* ]]; then
    DETAILS=$(ceph -s)
    MESSAGE="🚨 <b>CANH BAO CEPH CLUSTER</b> 🚨%0A%0A<b>Trang thai:</b> $HEALTH%0A%0A<b>Chi tiet:</b>%0A<pre>$DETAILS</pre>"
    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT_ID" -d text="$MESSAGE" -d parse_mode="HTML"
fi
\`\`\`

---

## Phần 5: Script Trích xuất và Cảnh báo Log Chi tiết (Cluster Log)

Nếu \`ceph -s\` là "bề nổi", thì **Cluster Log** chính là "bề chìm" lưu lại mọi dao động của hệ thống. 

### 5.1 Sơ đồ kiến trúc Ghi Log
Các tiến trình OSD/MGR đều đẩy log về Monitor, và Monitor sẽ ghi tất cả vào file trung tâm \`/var/log/ceph/ceph.log\`.

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

### 5.2 Kịch bản Lọc Log (Quét lỗi ERR/WARN)
Tạo file \`/root/ceph_log_alert.sh\` để quét log mỗi 10 phút, nếu thấy chữ \`ERR\` hoặc \`WRN\`, nó sẽ báo ngay.

\`\`\`bash
#!/bin/bash
TOKEN="BOT_TOKEN_CUA_BAN"
CHAT_ID="CHAT_ID_CUA_BAN"
LOG_FILE="/var/log/ceph/ceph.log"

# Loc ra 10 dong moi nhat chua loi
ERROR_LOGS=$(tail -n 500 $LOG_FILE | grep -E " ERR | WRN | down | FAILED " | tail -n 10)

if [ ! -z "$ERROR_LOGS" ]; then
    MESSAGE="🔥 <b>CEPH LOG ALERT</b> 🔥%0A%0A<b>May chu:</b> $(hostname)%0A<b>Chi tiet Log:</b>%0A<pre>$ERROR_LOGS</pre>"
    
    # Gioi han ky tu tranh loi Telegram
    if [ \${#MESSAGE} -gt 4000 ]; then
        MESSAGE="\${MESSAGE:0:4000}... (Log bi cat)</pre>"
    fi

    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT_ID" -d text="$MESSAGE" -d parse_mode="HTML"
fi
\`\`\`

Bạn chỉ cần thêm Script này vào Crontab (\`*/10 * * * * /root/ceph_log_alert.sh\`) là cụm Ceph của bạn sẽ được bảo vệ 2 lớp: Vừa giám sát tình trạng (Status), vừa giám sát sự kiện ngầm (Logs).

**Kết luận:** Qua cẩm nang toàn diện này, bạn đã trang bị đủ "vũ khí" từ Zabbix Web, Zabbix Agent cho đến Telegram Script để làm chủ hoàn toàn cụm Proxmox Ceph của mình!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // 1. Rewrite the MEGA POST
    const megaPost = await Post.findOne({ title: { $regex: /Cẩm nang Toàn tập Ceph Proxmox/i } });
    if (megaPost) {
        megaPost.title = "Cẩm nang Toàn tập Ceph Proxmox: Giám sát Zabbix, Log Chi tiết & Xử lý sự cố";
        megaPost.content = marked.parse(markdownContent);
        await megaPost.save();
        console.log("Successfully rewrote the Mega Ceph post!");
    } else {
        console.log("Could not find Mega Ceph post.");
    }
    
    // 2. Delete the standalone Log Post
    const logPost = await Post.findOne({ title: { $regex: /Cấu hình Script trích xuất/i } });
    if (logPost) {
        await Post.deleteOne({ _id: logPost._id });
        console.log("Deleted standalone Log Post.");
    }
    
    // 3. Delete the standalone system.run post
    const systemRunPost = await Post.findOne({ title: { $regex: /system.run/i } });
    if (systemRunPost) {
        await Post.deleteOne({ _id: systemRunPost._id });
        console.log("Deleted standalone system.run Post.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
