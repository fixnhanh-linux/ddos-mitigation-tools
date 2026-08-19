const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const zabbixDetailedDiagrams = `
<h2>1. Sơ đồ Kiến trúc Giám sát Đa máy chủ (Multi-OS Architecture)</h2>
<pre><code class="language-mermaid">
graph TD
    subgraph "Monitored Linux Servers"
        Ubuntu[Ubuntu / Debian]
        CentOS[CentOS / RHEL]
        Oracle[Oracle Linux]
        
        Agent2["Zabbix Agent 2&lt;br&gt;(Golang, Tích hợp sẵn Plugin)"]
        AgentClassic["Zabbix Agent Classic&lt;br&gt;(C, Nhẹ, Truyền thống)"]
        
        Ubuntu -.-&gt; Agent2
        CentOS -.-&gt; AgentClassic
        Oracle -.-&gt; Agent2
    end

    subgraph "Zabbix Infrastructure"
        ZProxy["Zabbix Proxy&lt;br&gt;(Gom dữ liệu mạng nội bộ)"]
        ZServer[(Zabbix Server)]
        ZWeb["Zabbix Web Frontend"]
    end

    Agent2 --&gt;|Port 10050 / 10051| ZProxy
    AgentClassic --&gt;|Port 10050 / 10051| ZServer
    ZProxy --&gt;|Bulk Data| ZServer
    ZServer -.-&gt; ZWeb
    
    classDef os fill:#2b6cb0,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef agent fill:#c53030,stroke:#fc8181,stroke-width:2px,color:#fff;
    classDef core fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    
    class Ubuntu,CentOS,Oracle os;
    class Agent2,AgentClassic agent;
    class ZServer,ZProxy,ZWeb core;
</code></pre>

<h2>2. Sơ đồ chi tiết Quy trình Bash Script Tự động</h2>
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin
    participant Script as install-zabbix-agent.sh
    participant OS as HĐH (apt/yum)
    participant Config as /etc/zabbix/
    participant ZService as systemd

    Admin-&gt;&gt;Script: Chạy curl &amp; bash
    activate Script
    
    Script-&gt;&gt;Script: 1. Hỏi người dùng: IP Server? Chọn bản Agent 1 hay 2?
    Script-&gt;&gt;OS: 2. Phát hiện OS (Ubuntu, CentOS, Debian...)
    activate OS
    OS--&gt;&gt;Script: Tải &amp; Cài Repo Zabbix tương ứng
    deactivate OS
    
    Script-&gt;&gt;Config: 3. Ghi đè thông số Server=, ServerActive=, Hostname=
    Script-&gt;&gt;ZService: 4. systemctl enable &amp; start zabbix-agent(2)
    
    activate ZService
    ZService--&gt;&gt;Script: Trạng thái: Active (Running)
    deactivate ZService
    
    Script--&gt;&gt;Admin: Thông báo hoàn tất &amp; HD thêm Host lên Web!
    deactivate Script
</code></pre>

<h2>3. So sánh Luồng Active vs Passive Checks</h2>
<pre><code class="language-mermaid">
graph LR
    subgraph "Passive Check (Zabbix hỏi -&gt; Agent trả lời)"
        P_Server[Zabbix Server] --&gt;|1. Gửi yêu cầu lấy CPU| P_Agent[Zabbix Agent]
        P_Agent --&gt;|2. Trả kết quả| P_Server
    end
    
    subgraph "Active Check (Agent chủ động gửi)"
        A_Server[Zabbix Server] --&gt;|1. Gửi danh sách nhiệm vụ| A_Agent[Zabbix Agent]
        A_Agent --&gt;|2. Tự định kỳ gửi data lên Server| A_Server
    end
    
    classDef passive fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef active fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    
    class P_Server,P_Agent passive;
    class A_Server,A_Agent active;
</code></pre>
<hr/>
`;

const nodeExporterDetailedDiagrams = `
<h2>1. Kiến trúc Giám sát với Prometheus &amp; Node Exporter</h2>
<pre><code class="language-mermaid">
graph TD
    subgraph "Target Servers (Cần giám sát)"
        Server1["Web Server&lt;br&gt;(Node Exporter :9100)"]
        Server2["DB Server&lt;br&gt;(Node Exporter :9100)"]
        
        Server1 -.->|Metrics: CPU, RAM, Disk, Net| OS1[OS Metrics]
        Server2 -.->|Metrics: CPU, RAM, Disk, Net| OS2[OS Metrics]
    end

    subgraph "Monitoring Core"
        Prometheus[("Prometheus Server&lt;br&gt;Time-Series DB")]
        Grafana["Grafana Dashboards"]
        AlertManager["Alertmanager"]
    end
    
    Prometheus --&gt;|HTTP GET /metrics (Scrape)| Server1
    Prometheus --&gt;|HTTP GET /metrics (Scrape)| Server2
    
    Grafana --&gt;|PromQL Queries| Prometheus
    Prometheus --&gt;|Gửi Rules bị vi phạm| AlertManager
    AlertManager --&gt;|Gửi thông báo| Telegram[Telegram / Email / Slack]
    
    classDef target fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    classDef prom fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    classDef grafana fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef alert fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    
    class Server1,Server2 target;
    class Prometheus prom;
    class Grafana grafana;
    class AlertManager,Telegram alert;
</code></pre>

<h2>2. Sơ đồ chi tiết Quy trình Script (Cài đặt + Tự động cấu hình Prometheus)</h2>
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin
    participant Script as Bash Script
    participant Target as Target Server
    participant Prom as Prometheus Server

    Admin-&gt;&gt;Script: Chạy Script Cài đặt
    activate Script
    
    Script-&gt;&gt;Target: 1. Tạo user 'prometheus' &amp; tải Node Exporter
    Script-&gt;&gt;Target: 2. Cài đặt file systemd service
    activate Target
    Target--&gt;&gt;Script: Node Exporter đang chạy trên Port 9100
    deactivate Target
    
    Script-&gt;&gt;Admin: Hỏi thông tin SSH của Prometheus Server (IP, User, Pass)
    Admin--&gt;&gt;Script: Cung cấp thông tin
    
    Script-&gt;&gt;Prom: 3. SSHpass kết nối vào Prometheus
    activate Prom
    Prom-&gt;&gt;Prom: 4. Inject IP Target vào cuối file prometheus.yml
    Prom-&gt;&gt;Prom: 5. systemctl reload prometheus
    Prom--&gt;&gt;Script: Cấu hình Prometheus thành công
    deactivate Prom
    
    Script-&gt;&gt;Script: 6. Tự động xóa (rm -f) script cài đặt
    Script--&gt;&gt;Admin: Hoàn tất toàn bộ quy trình!
    deactivate Script
</code></pre>

<h2>3. Vòng đời Xử lý Dữ liệu của Node Exporter</h2>
<pre><code class="language-mermaid">
graph LR
    Kernel[Linux Kernel / procfs / sysfs] --&gt;|Đọc thô| Exporter[Node Exporter]
    Exporter --&gt;|Chuyển hóa sang dạng Text| HTTP[HTTP Server :9100/metrics]
    HTTP --&gt;|Pulls| Prometheus[(Prometheus TSDB)]
    Prometheus --&gt;|Lưu trữ &amp; Nén| Disk[(Local Disk)]
    
    classDef linux fill:#718096,stroke:#cbd5e0,stroke-width:2px,color:#fff;
    classDef app fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    classDef prom fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    
    class Kernel,Disk linux;
    class Exporter,HTTP app;
    class Prometheus prom;
</code></pre>
<hr/>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // 1. Zabbix Post
    const zabbixPost = await Post.findOne({ title: { $regex: /Hướng dẫn Cài đặt Zabbix Agent Tự động/i } });
    if (zabbixPost) {
      let content = zabbixPost.content;
      // Remove old diagram block
      content = content.replace(/<h2>Sơ đồ Kiến trúc Giám sát với Zabbix Agent<\/h2>[\s\S]*?<\/code><\/pre>/i, "");
      
      if (content.includes("<h1")) {
          content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + zabbixDetailedDiagrams);
      } else {
          content = zabbixDetailedDiagrams + "\n" + content;
      }
      
      zabbixPost.content = content;
      await zabbixPost.save();
      console.log("Updated Zabbix Agent post with DETAILED diagrams!");
    }

    // 2. Node Exporter Post
    const nodePost = await Post.findOne({ title: { $regex: /Node Exporter Auto Install/i } });
    if (nodePost) {
      let content = nodePost.content;
      // Remove old diagram block
      content = content.replace(/<h2>Sơ đồ Quy trình Hoạt động của Node Exporter Script<\/h2>[\s\S]*?<\/code><\/pre>/i, "");
      
      if (content.includes("<h1")) {
          content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + nodeExporterDetailedDiagrams);
      } else {
          content = nodeExporterDetailedDiagrams + "\n" + content;
      }
      
      nodePost.content = content;
      await nodePost.save();
      console.log("Updated Node Exporter post with DETAILED diagrams!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
