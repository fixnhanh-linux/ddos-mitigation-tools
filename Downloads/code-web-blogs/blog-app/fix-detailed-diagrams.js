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
    subgraph Monitored_Linux_Servers
        Ubuntu[Ubuntu / Debian]
        CentOS[CentOS / RHEL]
        Oracle[Oracle Linux]
        
        Agent2["Zabbix Agent 2&lt;br&gt;(Golang, Tích hợp sẵn Plugin)"]
        AgentClassic["Zabbix Agent Classic&lt;br&gt;(C, Nhẹ, Truyền thống)"]
        
        Ubuntu -.-&gt; Agent2
        CentOS -.-&gt; AgentClassic
        Oracle -.-&gt; Agent2
    end

    subgraph Zabbix_Infrastructure
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
    participant OS as OS (apt/yum)
    participant Config as /etc/zabbix/
    participant ZService as systemd

    Admin-&gt;&gt;Script: Chay curl va bash
    activate Script
    
    Script-&gt;&gt;Script: 1. Hoi nguoi dung IP Server
    Script-&gt;&gt;OS: 2. Phat hien OS
    activate OS
    OS--&gt;&gt;Script: Cài Repo Zabbix tuong ung
    deactivate OS
    
    Script-&gt;&gt;Config: 3. Ghi de thong so Server
    Script-&gt;&gt;ZService: 4. systemctl enable zabbix-agent
    
    activate ZService
    ZService--&gt;&gt;Script: Trang thai Active
    deactivate ZService
    
    Script--&gt;&gt;Admin: Thong bao hoan tat
    deactivate Script
</code></pre>

<h2>3. So sánh Luồng Active vs Passive Checks</h2>
<pre><code class="language-mermaid">
graph LR
    subgraph Passive_Check
        P_Server[Zabbix Server] --&gt;|1. Gui yeu cau lay CPU| P_Agent[Zabbix Agent]
        P_Agent --&gt;|2. Tra ket qua| P_Server
    end
    
    subgraph Active_Check
        A_Server[Zabbix Server] --&gt;|1. Gui danh sach nhiem vu| A_Agent[Zabbix Agent]
        A_Agent --&gt;|2. Tu gui data len Server| A_Server
    end
    
    classDef passive fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    classDef active fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    
    class P_Server,P_Agent passive;
    class A_Server,A_Agent active;
</code></pre>
<hr/>
`;

const nodeExporterDetailedDiagrams = `
<h2>1. Kiến trúc Giám sát với Prometheus và Node Exporter</h2>
<pre><code class="language-mermaid">
graph TD
    subgraph Target_Servers
        Server1["Web Server&lt;br&gt;(Node Exporter)"]
        Server2["DB Server&lt;br&gt;(Node Exporter)"]
        
        Server1 --&gt;|OS Metrics| OS1[OS Metrics]
        Server2 --&gt;|OS Metrics| OS2[OS Metrics]
    end

    subgraph Monitoring_Core
        Prometheus[("Prometheus Server&lt;br&gt;Time-Series DB")]
        Grafana["Grafana Dashboards"]
        AlertManager["Alertmanager"]
    end
    
    Prometheus --&gt;|HTTP GET /metrics| Server1
    Prometheus --&gt;|HTTP GET /metrics| Server2
    
    Grafana --&gt;|PromQL Queries| Prometheus
    Prometheus --&gt;|Gui Rules vi pham| AlertManager
    AlertManager --&gt;|Gui thong bao| Telegram[Telegram / Email]
    
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

    Admin-&gt;&gt;Script: Chay Script Cai dat
    activate Script
    
    Script-&gt;&gt;Target: 1. Tao user va tai Node Exporter
    Script-&gt;&gt;Target: 2. Cai dat file systemd service
    activate Target
    Target--&gt;&gt;Script: Node Exporter dang chay
    deactivate Target
    
    Script-&gt;&gt;Admin: Hoi thong tin SSH cua Prometheus
    Admin--&gt;&gt;Script: Cung cap thong tin
    
    Script-&gt;&gt;Prom: 3. SSH vao Prometheus
    activate Prom
    Prom-&gt;&gt;Prom: 4. Inject IP vao prometheus.yml
    Prom-&gt;&gt;Prom: 5. systemctl reload prometheus
    Prom--&gt;&gt;Script: Cau hinh thanh cong
    deactivate Prom
    
    Script-&gt;&gt;Script: 6. Xoa file script
    Script--&gt;&gt;Admin: Hoan tat quy trinh
    deactivate Script
</code></pre>

<h2>3. Vòng đời Xử lý Dữ liệu của Node Exporter</h2>
<pre><code class="language-mermaid">
graph LR
    Kernel["Linux Kernel"] --&gt;|Doc tho| Exporter[Node Exporter]
    Exporter --&gt;|Chuyen sang Text| HTTP["HTTP Server :9100"]
    HTTP --&gt;|Pulls| Prometheus[(Prometheus TSDB)]
    Prometheus --&gt;|Luu tru| Disk[(Local Disk)]
    
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
      // Remove all previously added detailed diagrams
      content = content.replace(/<h2>1\. Sơ đồ Kiến trúc Giám sát Đa máy chủ[\s\S]*?<hr\/>/i, "");
      
      if (content.includes("<h1")) {
          content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + zabbixDetailedDiagrams);
      } else {
          content = zabbixDetailedDiagrams + "\n" + content;
      }
      
      zabbixPost.content = content;
      await zabbixPost.save();
      console.log("Fixed Zabbix Agent post diagrams!");
    }

    // 2. Node Exporter Post
    const nodePost = await Post.findOne({ title: { $regex: /Node Exporter Auto Install/i } });
    if (nodePost) {
      let content = nodePost.content;
      // Remove all previously added detailed diagrams
      content = content.replace(/<h2>1\. Kiến trúc Giám sát với Prometheus &amp; Node Exporter[\s\S]*?<hr\/>/i, "");
      
      if (content.includes("<h1")) {
          content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + nodeExporterDetailedDiagrams);
      } else {
          content = nodeExporterDetailedDiagrams + "\n" + content;
      }
      
      nodePost.content = content;
      await nodePost.save();
      console.log("Fixed Node Exporter post diagrams!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
