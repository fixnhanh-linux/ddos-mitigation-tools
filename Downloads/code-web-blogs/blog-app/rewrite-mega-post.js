const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const markdownContent = `
# Cẩm nang Toàn tập Ceph Proxmox: Giám sát Zabbix, Đọc hiểu Ceph Status & Xử lý sự cố

Ceph là hệ thống lưu trữ phân tán mạnh mẽ và là xương sống của nhiều cụm ảo hóa Proxmox VE. Việc làm chủ Ceph không chỉ dừng lại ở việc cài đặt, mà bạn phải biết cách giám sát nó 24/7, hiểu rõ các thông số sức khỏe và tự tin xử lý sự cố khi có ổ cứng (OSD) bị hỏng.

Cẩm nang này được xây dựng như một tài liệu "Tất cả trong một" (All-in-one), bao gồm 4 phần chính:
1. Tích hợp Ceph vào Zabbix thông qua Zabbix Agent 2.
2. Giải mã và đọc hiểu kết quả của lệnh \`ceph -s\`.
3. Phân tích các trạng thái báo lỗi (HEALTH_WARN, HEALTH_ERR) và phương pháp xử lý triệt để.
4. Triển khai kịch bản tự động cảnh báo sự cố qua Telegram.

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

### 1.2 Trình tự Triển khai
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
*(Lưu lại API Key vừa được tạo)*.

**Trên Zabbix Web:** 
Gán template **Ceph by Zabbix agent 2** vào host. Sau đó điền Macros:
- \`{$CEPH.API.URL}\` : \`https://&lt;IP_NODE_MGR&gt;:8003\`
- \`{$CEPH.USER}\` : \`zabbix\`
- \`{$CEPH.PASSWORD}\` : *(API Key ở bước trên)*.

*(Mẹo xử lý lỗi SSL: Mở \`/etc/zabbix/zabbix_agent2.conf\`, thêm dòng \`Plugins.Ceph.InsecureSkipVerify=true\` và restart agent).*

### 1.3 Cơ chế Khám phá tự động (Low-Level Discovery)
Zabbix Agent 2 sẽ lấy một cục JSON khổng lồ từ API và dùng engine LLD để tự động tạo ra Items giám sát cho từng ổ cứng OSD, từng Pool và Monitor riêng biệt.

<pre><code class="language-mermaid">
graph LR
    API["Ceph REST API&lt;br&gt;(JSON Payload)"] --&gt;|Parse boi Agent 2| LLD["Zabbix LLD Engine"]
    
    LLD --&gt;|Kham pha OSD| OSD["Ceph OSDs (osd.0, osd.1)"]
    LLD --&gt;|Kham pha Pool| Pool["Ceph Pools (rbd)"]
    LLD --&gt;|Kham pha MON| MON["Ceph Monitors (pve1)"]
    
    classDef api fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef lld fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef resource fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    
    class API api;
    class LLD lld;
    class OSD,Pool,MON resource;
</code></pre>

---

## Phần 2: Giải mã toàn tập lệnh "Ceph Status" (ceph -s)

Bảng điều khiển của Zabbix tuy đẹp, nhưng trong lúc dầu sôi lửa bỏng, lệnh \`ceph -s\` trên terminal mới là công cụ hữu hiệu nhất.

### 2.1 Cấu trúc Mindmap của lệnh
Lệnh này trả về 5 cụm thông tin thiết yếu:

<pre><code class="language-mermaid">
graph TD
    CEPH_S["Lenh: ceph -s"]
    
    CEPH_S --&gt; CLUSTER["Cluster"]
    CEPH_S --&gt; HEALTH["Health (OK/WARN/ERR)"]
    CEPH_S --&gt; SERVICES["Services"]
    CEPH_S --&gt; DATA["Data"]
    CEPH_S --&gt; IO["Client I/O"]
    
    SERVICES --&gt; MON["MON: So luong va Quorum"]
    SERVICES --&gt; MGR["MGR: Active / Standby"]
    SERVICES --&gt; OSD["OSD: Tong so / So Up / So In"]
    
    DATA --&gt; POOL["Pools: Tong so"]
    DATA --&gt; PG["PGs: Trang thai (Active+Clean...)"]
    DATA --&gt; USAGE["Usage: Dung luong"]
    
    classDef main fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef section fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef detail fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    
    class CEPH_S main;
    class CLUSTER,HEALTH,SERVICES,DATA,IO section;
    class MON,MGR,OSD,POOL,PG,USAGE detail;
</code></pre>

### 2.2 Đọc hiểu các thông số cốt lõi
Khi chạy lệnh, bạn sẽ thấy kết quả tương tự thế này:
\`\`\`text
  cluster:
    id:     a1b2c3d4...
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum pve1,pve2,pve3
    osd: 12 osds: 12 up (since 3d), 12 in (since 1w) 

  data:
    pools:   4 pools, 1024 pgs
    usage:   4.5 TiB used, 10 TiB / 14.5 TiB avail 
    pgs:     1024 active+clean
\`\`\`
**Điểm mấu chốt:** Hãy nhìn vào dòng \`12 osds: 12 up, 12 in\`. 
- **IN:** OSD đã được khai báo thuộc về cụm.
- **UP:** Tiến trình OSD đang chạy.
Nếu thấy \`11 up, 12 in\` nghĩa là có 1 ổ cứng đang nằm im bất động!

### 2.3 Luồng xử lý ẩn sau lệnh CLI
Lệnh \`ceph -s\` phản hồi cực nhanh vì nó không chạy đi hỏi từng ổ cứng, mà chỉ truy xuất "Bản đồ" (Map) lưu trong RAM của các MON.
<pre><code class="language-mermaid">
graph LR
    User["Admin gõ 'ceph -s'"] --&gt;|CLI tao Request| Socket["Ceph Client API"]
    Socket --&gt;|Ket noi toi| MON_Active["Active Monitor"]
    MON_Active --&gt;|Doc tu RAM| Maps["OSD Map, MON Map..."]
    Maps --&gt;|Tra ve| User
</code></pre>

---

## Phần 3: Phân tích & Xử lý Trạng thái Health (WARN / ERR)

Khi trường Health của lệnh trên không còn là \`HEALTH_OK\` nữa, bạn cần biết chính xác mình đang đối mặt với chuyện gì.

### 3.1 Cấp độ Nghiêm trọng
<pre><code class="language-mermaid">
graph TD
    subgraph Muc_Do_Nghiem_Trong
        OK["HEALTH_OK (Hoat dong tot)"]
        WARN["HEALTH_WARN (Suy giam hieu nang / Mat du phong)"]
        ERR["HEALTH_ERR (Ngung tre I/O / Mat du lieu)"]
    end
    
    OK --&gt;|1 vai OSD down, Pool &gt; 85%| WARN
    WARN --&gt;|Mat qua nhieu OSD, Pool &gt; 95%| ERR
    
    classDef ok fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    classDef warn fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef err fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    
    class OK ok;
    class WARN warn;
    class ERR err;
</code></pre>

### 3.2 Xử lý HEALTH_WARN
- **OSD_DOWN:** Kiểm tra \`journalctl -u ceph-osd@&lt;id&gt;\` hoặc \`systemctl start ceph-osd@&lt;id&gt;\`. Nếu ổ chết hẳn vật lý thì thay ổ mới.
- **PG_DEGRADED:** Đang thiếu bản sao dữ liệu (replica) do có OSD chết. Ceph đang âm thầm copy bù đắp, bạn không cần làm gì ngoài việc ngồi chờ.
- **NEARFULL:** Dung lượng cụm đạt 85%. Hãy xóa dữ liệu rác hoặc cắm thêm ổ cứng ngay.

### 3.3 Cây Quyết định xử lý OSD (Decision Tree)
<pre><code class="language-mermaid">
graph TD
    Start["OSD bi DOWN"] --&gt; CheckPing{"Ping toi Server do duoc khong?"}
    
    CheckPing --&gt;|Khong| NodeDie["Sua loi mang / Reboot Server"]
    CheckPing --&gt;|Co| CheckProc{"systemctl status ceph-osd@X"}
    
    CheckProc --&gt;|Chets/OOM| Restart["systemctl start ceph-osd@X"]
    
    Restart --&gt; DidItWork{"Start thanh cong?"}
    DidItWork --&gt;|Co| EndOk["Cho Ceph tu Recovery"]
    DidItWork --&gt;|Khong (Crashed)| CheckDisk["Kiem tra dmesg / smartctl"]
    
    CheckDisk --&gt;|O cung chet roi| Replace["Thay OSD moi"]
</code></pre>

### 3.4 Cơ chế Tự phục hồi dữ liệu (Self-Healing)
Ceph được thiết kế để tự cứu lấy mình khi một mảng ổ cứng chết.

<pre><code class="language-mermaid">
sequenceDiagram
    participant OSD as OSD Bi Loi
    participant MON as Ceph Monitors
    participant OSD_Khac as Cac OSD Khac

    OSD-&gt;&gt;MON: Ngung gui heartbeat (Mat ket noi)
    MON-&gt;&gt;MON: Danh dau OSD la DOWN (Bao HEALTH_WARN)
    
    Note over MON,OSD_Khac: Sau 10 phut
    
    MON-&gt;&gt;MON: Danh dau OSD do la OUT (Loai khoi cum)
    MON-&gt;&gt;OSD_Khac: Tinh toan lai ban do
    activate OSD_Khac
    OSD_Khac-&gt;&gt;OSD_Khac: Tu copy cheo du lieu sang nhau de bu dap (Recovery / Backfill)
    OSD_Khac--&gt;&gt;MON: Hoan tat 100%
    deactivate OSD_Khac
    MON-&gt;&gt;MON: Tro ve HEALTH_OK
</code></pre>

---

## Phần 4: Viết Script Cảnh báo tự động qua Telegram

Thay vì 5 phút phải mở Zabbix hoặc gõ \`ceph -s\` một lần, đoạn Script Bash chạy ngầm này sẽ tự động báo tin cho bạn mỗi khi mất \`HEALTH_OK\`.

### 4.1 Sơ đồ luồng hoạt động
<pre><code class="language-mermaid">
sequenceDiagram
    participant Cron as Cronjob (5 phut)
    participant Script as Bash Script
    participant Ceph as Ceph Cluster
    participant Tele as Telegram API

    Cron-&gt;&gt;Script: Kich hoat khao sat
    Script-&gt;&gt;Ceph: Chay lenh 'ceph health'
    Ceph--&gt;&gt;Script: Tra ve trang thai (VD: HEALTH_WARN)
    
    alt Neu la HEALTH_OK
        Script-&gt;&gt;Script: Ket thuc, an toan
    else Khac HEALTH_OK
        Script-&gt;&gt;Ceph: Chay 'ceph -s' de lay nguyen nhan
        Ceph--&gt;&gt;Script: Chi tiet van ban
        Script-&gt;&gt;Tele: POST /sendMessage (Kem noi dung)
    end
</code></pre>

### 4.2 Triển khai Script (\`ceph_monitor.sh\`)
Tạo file tại \`/root/ceph_monitor.sh\` trên Proxmox Node bất kỳ:

\`\`\`bash
#!/bin/bash
TOKEN="BOT_TOKEN_CUA_BAN"
CHAT_ID="CHAT_ID_CUA_BAN"

HEALTH=$(ceph health)

if [[ "$HEALTH" != *"HEALTH_OK"* ]]; then
    DETAILS=$(ceph -s)
    
    MESSAGE="🚨 <b>CANH BAO CEPH CLUSTER</b> 🚨%0A%0A"
    MESSAGE+="<b>Trang thai:</b> $HEALTH%0A%0A"
    MESSAGE+="<b>Chi tiet (ceph -s):</b>%0A<pre>$DETAILS</pre>"

    curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
         -d chat_id="$CHAT_ID" \
         -d text="$MESSAGE" \
         -d parse_mode="HTML"
fi
\`\`\`

Cấp quyền thực thi và đưa vào Crontab:
\`\`\`bash
chmod +x /root/ceph_monitor.sh
crontab -e
# Them dong: */5 * * * * /root/ceph_monitor.sh
\`\`\`

**Kết luận:** Qua cẩm nang này, bạn đã được trang bị mọi kỹ năng từ việc theo dõi, nhận diện đến phản ứng trước các sự cố của một cụm Ceph chuẩn doanh nghiệp. Đừng bao giờ để cụm bị đầy quá 85% và hãy luôn chuẩn bị sẵn ổ cứng sơ cua nhé!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const megaPost = await Post.findOne({ title: { $regex: /Cẩm nang Toàn tập Ceph Proxmox/i } });
    if (!megaPost) {
        console.log("Could not find the Mega Ceph post.");
        return;
    }

    const htmlContent = marked.parse(markdownContent);
    megaPost.content = htmlContent;
    await megaPost.save();
    console.log("Successfully rewrote the Mega Ceph post into a unified cohesive guide!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
