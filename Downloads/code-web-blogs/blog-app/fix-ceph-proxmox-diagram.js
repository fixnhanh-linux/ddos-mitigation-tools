const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const markdownContent = `
# Hướng dẫn Giám sát Ceph trên Proxmox VE với Prometheus & Grafana

Ceph là hệ thống lưu trữ phân tán mạnh mẽ, thường được tích hợp sẵn như một phần không thể thiết trong cụm **Proxmox Virtual Environment (VE)**. Việc giám sát chặt chẽ Ceph là cực kỳ quan trọng để đảm bảo hiệu suất (IOPS, Latency) và độ an toàn dữ liệu (OSD Health, PG States).

May mắn thay, Ceph Manager (\`ceph-mgr\`) đã được tích hợp sẵn một module xuất metrics cho Prometheus. Bạn không cần cài thêm Exporter phức tạp! Bài viết này sẽ hướng dẫn chi tiết cách cấu hình.

---

## 1. Sơ đồ Kiến trúc Giám sát Ceph Tổng thể

Dưới đây là sơ đồ mô tả cách dữ liệu được thu thập từ cụm Ceph trong Proxmox đưa về hệ thống Monitor trung tâm.

<pre><code class="language-mermaid">
graph TD
    subgraph Proxmox_Cluster
        Node1["Proxmox Node 1&lt;br&gt;(Ceph MON, MGR, OSD)"]
        Node2["Proxmox Node 2&lt;br&gt;(Ceph MON, MGR, OSD)"]
        Node3["Proxmox Node 3&lt;br&gt;(Ceph MON, MGR, OSD)"]
        
        Node1 --&gt;|Dong bo trang thai| Node2
        Node2 --&gt;|Dong bo trang thai| Node3
        
        CephMgr["Ceph Manager (Active)&lt;br&gt;Prometheus Module :9283"]
        Node1 --&gt;|Tong hop Metrics| CephMgr
        Node2 --&gt;|Tong hop Metrics| CephMgr
        Node3 --&gt;|Tong hop Metrics| CephMgr
    end

    subgraph Monitoring_Stack
        Prometheus[("Prometheus Server&lt;br&gt;(Scraper)")]
        Grafana["Grafana Dashboard&lt;br&gt;(Visualization)"]
        Alert["Alertmanager&lt;br&gt;(Canh bao su co)"]
    end
    
    Prometheus --&gt;|HTTP GET /metrics :9283| CephMgr
    Grafana --&gt;|Truy van PromQL| Prometheus
    Prometheus --&gt;|Gan Rules| Alert
    
    classDef pve fill:#c53030,stroke:#fc8181,stroke-width:2px,color:#fff;
    classDef mgr fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef prom fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    classDef graf fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    
    class Node1,Node2,Node3 pve;
    class CephMgr mgr;
    class Prometheus prom;
    class Grafana,Alert graf;
</code></pre>

---

## 2. Các bước Cấu hình Chi tiết

### Sơ đồ Trình tự Thực hiện
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin
    participant PVE as Proxmox
    participant Prom as Prometheus
    participant Graf as Grafana

    Admin-&gt;&gt;PVE: 1. Kich hoat Module Prometheus (Port 9283)
    activate PVE
    PVE--&gt;&gt;Admin: Ceph Manager san sang xuat Metrics
    deactivate PVE
    
    Admin-&gt;&gt;Prom: 2. Khai bao Target vao prometheus.yml
    activate Prom
    Prom-&gt;&gt;PVE: 3. Pull du lieu dinh ky (Scrape)
    Prom--&gt;&gt;Admin: Lay du lieu thanh cong
    deactivate Prom
    
    Admin-&gt;&gt;Graf: 4. Import Dashboard Ceph
    Graf-&gt;&gt;Prom: Lay Time-series data
    Graf--&gt;&gt;Admin: 5. Hien thi Bieu do Truc quan
</code></pre>

### Bước 1: Kích hoạt module Prometheus trên Ceph Manager
Mở shell (terminal) trên bất kỳ node Proxmox nào trong cụm và chạy lệnh sau để bật module:

\`\`\`bash
ceph mgr module enable prometheus
\`\`\`

Kiểm tra xem module đã hoạt động chưa:
\`\`\`bash
curl -s http://&lt;IP_CUA_NODE_DANG_CHAY_MGR_ACTIVE&gt;:9283/metrics | head -n 10
\`\`\`
*(Lưu ý: Bạn có thể tìm node đang chạy MGR Active bằng lệnh \`ceph -s\`)*.

### Bước 2: Khai báo Target vào Prometheus
Truy cập vào máy chủ cài đặt Prometheus của bạn, chỉnh sửa file cấu hình \`prometheus.yml\`:

\`\`\`bash
sudo nano /etc/prometheus/prometheus.yml
\`\`\`

Thêm đoạn sau vào phần \`scrape_configs\`:
\`\`\`yaml
  - job_name: 'ceph-proxmox'
    static_configs:
      - targets: 
        - '10.0.0.11:9283' # Thay bằng IP Node Proxmox 1
        - '10.0.0.12:9283' # Thay bằng IP Node Proxmox 2
        - '10.0.0.13:9283' # Thay bằng IP Node Proxmox 3
\`\`\`
*Mẹo: Khai báo IP của tất cả các node tham gia Ceph. Ceph MGR tự động định tuyến port 9283 về node đang giữ quyền Active Manager.*

Lưu file và tải lại Prometheus:
\`\`\`bash
sudo systemctl reload prometheus
\`\`\`

### Bước 3: Import Dashboard trên Grafana
1. Đăng nhập vào Grafana Web.
2. Điều hướng đến **Dashboards** -&gt; **New** -&gt; **Import**.
3. Sử dụng ID **2842** (Ceph - Cluster) hoặc **7056** (Ceph OSD Overview) đây là những dashboard cộng đồng rất chuẩn mực.
4. Chọn Data Source là **Prometheus** và nhấn **Import**.

---

## 3. Phân tích Luồng Dữ liệu (Deep Dive Data Flow)

Làm sao Prometheus module thu thập được dữ liệu của hàng trăm OSD (ổ cứng) và hiển thị tốc độ?

<pre><code class="language-mermaid">
graph LR
    subgraph Data_Generation
        OSD["Ceph OSDs&lt;br&gt;(Disk IO, Latency)"]
        MON["Ceph MONs&lt;br&gt;(Quorum Status)"]
        PG["Placement Groups&lt;br&gt;(Clean, Degraded)"]
    end
    
    subgraph Aggregation_Layer
        MGR_Core["Ceph Manager Daemon&lt;br&gt;(Tong hop trong RAM)"]
        Prom_Module["mgr/prometheus Module&lt;br&gt;(Chuyen doi sang Text Format)"]
        
        MGR_Core --&gt;|Day trang thai| Prom_Module
    end
    
    OSD --&gt;|Bao cao trang thai| MGR_Core
    MON --&gt;|Bao cao trang thai| MGR_Core
    PG --&gt;|Bao cao trang thai| MGR_Core
    
    Prom_Module --&gt;|Mo HTTP Endpoint :9283| External_World((External&lt;br&gt;Prometheus))
    
    classDef data fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef core fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef endpoint fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    
    class OSD,MON,PG data;
    class MGR_Core,Prom_Module core;
    class External_World endpoint;
</code></pre>

### 4. Các Chỉ số (Metrics) Cốt lõi cần đưa lên Cảnh báo
Khi thiết lập Alertmanager, bạn hãy chú ý đến các PromQL sau:
- **Ceph Health Status:** \`ceph_health_status != 0\` (0 = HEALTH_OK, 1 = HEALTH_WARN, 2 = HEALTH_ERR).
- **OSD Down:** \`ceph_osd_up == 0\` (Phát hiện ổ cứng bị rớt/chết).
- **Dung lượng OSD đầy:** \`ceph_osd_stat_bytes_used / ceph_osd_stat_bytes &gt; 0.85\` (Cảnh báo khi OSD đầy 85%).
- **PGs không Clean:** \`ceph_pg_clean &lt; ceph_pg_total\` (Phát hiện dữ liệu đang degraded hoặc recovery quá lâu).

Chúc các bạn xây dựng hệ thống lưu trữ Ceph trên Proxmox vững chãi và an toàn!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox/i } });
    if (post) {
      const htmlContent = marked.parse(markdownContent);
      post.content = htmlContent;
      await post.save();
      console.log("Completely overwrote Ceph Proxmox post with safe syntax!");
    } else {
        console.log("Post not found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
