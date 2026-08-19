const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const zabbixDiagramHTML = `
<h2>Sơ đồ Kiến trúc Giám sát với Zabbix Agent</h2>
<pre><code class="language-mermaid">
graph LR
    subgraph "Monitored Linux Servers"
        Ubuntu[Ubuntu / Debian]
        CentOS[CentOS / RHEL]
        Oracle[Oracle Linux]
        
        Agent2["Zabbix Agent 2&lt;br&gt;(Go, Đa luồng, Tối ưu)"]
        AgentClassic["Zabbix Agent&lt;br&gt;(Truyền thống, Rất nhẹ)"]
        
        Ubuntu -.-&gt; Agent2
        Ubuntu -.-&gt; AgentClassic
        CentOS -.-&gt; Agent2
        CentOS -.-&gt; AgentClassic
        Oracle -.-&gt; Agent2
        Oracle -.-&gt; AgentClassic
    end

    subgraph "Zabbix Infrastructure"
        ZabbixServer[(Zabbix Server)]
        ZabbixProxy["Zabbix Proxy&lt;br&gt;(Tùy chọn)"]
    end

    Agent2 --&gt;|Active / Passive&lt;br&gt;Port 10050| ZabbixServer
    AgentClassic --&gt;|Active / Passive&lt;br&gt;Port 10050| ZabbixServer
    
    Agent2 -.-&gt;|Thu thập qua Proxy| ZabbixProxy
    ZabbixProxy -.-&gt; ZabbixServer
    
    classDef os fill:#4a5568,stroke:#cbd5e0,stroke-width:2px,color:#fff;
    classDef agent fill:#e53e3e,stroke:#fed7d7,stroke-width:2px,color:#fff;
    classDef zabbix fill:#dd6b20,stroke:#feebc8,stroke-width:2px,color:#fff;
    
    class Ubuntu,CentOS,Oracle os;
    class Agent2,AgentClassic agent;
    class ZabbixServer,ZabbixProxy zabbix;
</code></pre>
`;

const nodeExporterDiagramHTML = `
<h2>Sơ đồ Quy trình Hoạt động của Node Exporter Script</h2>
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin as System Admin
    participant Script as Bash Script
    participant Server as Target Server
    participant Prom as Prometheus Server

    Admin-&gt;&gt;Script: 1. Chạy lệnh cài đặt Script
    
    activate Script
    Script-&gt;&gt;Server: 2. Tải &amp; Cài đặt Node Exporter (Port 9100)
    activate Server
    Server--&gt;&gt;Script: Node Exporter đang chạy (systemd)
    deactivate Server
    
    Script-&gt;&gt;Prom: 3. Tự động SSH vào Prometheus Server
    activate Prom
    Prom-&gt;&gt;Prom: 4. Thêm IP Target vào prometheus.yml
    Prom-&gt;&gt;Prom: 5. Reload cấu hình (systemctl reload prometheus)
    Prom--&gt;&gt;Script: Cấu hình hoàn tất
    deactivate Prom
    
    Script-&gt;&gt;Script: 6. Dọn dẹp: Tự động xóa file script
    Script--&gt;&gt;Admin: Thông báo Cài đặt Thành công!
    deactivate Script
</code></pre>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Update Zabbix Post
    const zabbixPost = await Post.findOne({ title: { $regex: /Hướng dẫn Cài đặt Zabbix Agent Tự động/i } });
    if (zabbixPost) {
      if (!zabbixPost.content.includes("Sơ đồ Kiến trúc Giám sát với Zabbix Agent")) {
        if (zabbixPost.content.includes("<h1")) {
          zabbixPost.content = zabbixPost.content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + zabbixDiagramHTML);
        } else {
          zabbixPost.content = zabbixDiagramHTML + "\n" + zabbixPost.content;
        }
        await zabbixPost.save();
        console.log("Added diagram to Zabbix Agent post!");
      } else {
        console.log("Zabbix Agent post already has diagram.");
      }
    }

    // Update Node Exporter Post
    const nodeExporterPost = await Post.findOne({ title: { $regex: /Node Exporter Auto Install/i } });
    if (nodeExporterPost) {
      if (!nodeExporterPost.content.includes("Sơ đồ Quy trình Hoạt động của Node Exporter Script")) {
        if (nodeExporterPost.content.includes("<h1")) {
          nodeExporterPost.content = nodeExporterPost.content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + nodeExporterDiagramHTML);
        } else {
          nodeExporterPost.content = nodeExporterDiagramHTML + "\n" + nodeExporterPost.content;
        }
        await nodeExporterPost.save();
        console.log("Added diagram to Node Exporter post!");
      } else {
         console.log("Node Exporter post already has diagram.");
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
