const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const detailedDiagramsHTML = `
<h2>1. Kiến trúc Tổng thể Giám sát Ổ cứng (SMART)</h2>
<pre><code class="language-mermaid">
graph TD
    subgraph "Monitored Server (Linux)"
        Disk[("Ổ cứng vật lý&lt;br&gt;(HDD / SSD / NVMe)")]
        Smartctl["smartctl&lt;br&gt;(smartmontools)"]
        Agent["Zabbix Agent Classic&lt;br&gt;(SMART Plugin / UserParameter)"]
        Sudoers["/etc/sudoers.d/&lt;br&gt;zabbix_smartctl"]
        
        Disk --&gt;|Đọc thông số nội tại| Smartctl
        Smartctl --&gt;|Trả về JSON / Text| Agent
        Agent -.-&gt;|Cấp quyền No-Password| Sudoers
        Sudoers -.-&gt;|Ủy quyền chạy| Smartctl
    end

    subgraph "Zabbix Infrastructure"
        ZabbixServer["Zabbix Server&lt;br&gt;(Nhận và xử lý Data)"]
        Dashboard["Dashboard Trực quan&lt;br&gt;+ Cảnh báo (Alerts)"]
        
        Agent --&gt;|Gửi Metrics định kỳ&lt;br&gt;Port 10050/10051| ZabbixServer
        ZabbixServer --&gt;|Trigger &amp; LLD| Dashboard
    end
    
    classDef disk fill:#4a5568,stroke:#cbd5e0,stroke-width:2px,color:#fff;
    classDef tool fill:#3182ce,stroke:#bee3f8,stroke-width:2px,color:#fff;
    classDef agent fill:#e53e3e,stroke:#fed7d7,stroke-width:2px,color:#fff;
    classDef config fill:#718096,stroke:#e2e8f0,stroke-width:2px,color:#fff;
    classDef zabbix fill:#dd6b20,stroke:#feebc8,stroke-width:2px,color:#fff;
    
    class Disk disk;
    class Smartctl tool;
    class Agent agent;
    class Sudoers config;
    class ZabbixServer,Dashboard zabbix;
</code></pre>

<h2>2. Sơ đồ chi tiết Quy trình Hoạt động của Script Tự động</h2>
<pre><code class="language-mermaid">
sequenceDiagram
    participant Admin as System Admin
    participant Script as setup-disk-monitor.sh
    participant OS as Linux OS (APT/YUM)
    participant Zabbix as Zabbix Agent (Local)

    Admin-&gt;&gt;Script: Chạy lệnh cài đặt tự động
    activate Script
    
    Script-&gt;&gt;OS: Bước 1: Phát hiện OS &amp; Cài smartmontools
    activate OS
    OS--&gt;&gt;Script: Trả về trạng thái cài đặt thành công
    deactivate OS
    
    Script-&gt;&gt;Zabbix: Bước 2: Kiểm tra trạng thái Agent
    Zabbix--&gt;&gt;Script: Trả về Active (Running)
    
    Script-&gt;&gt;OS: Bước 3: Ghi file /etc/sudoers.d/zabbix_smartctl
    Script-&gt;&gt;Zabbix: Bước 4: Tạo file smart_userparameter.conf
    
    Script-&gt;&gt;Zabbix: Bước 5: systemctl restart zabbix-agent
    activate Zabbix
    Zabbix--&gt;&gt;Script: Khởi động lại thành công
    deactivate Zabbix
    
    Script-&gt;&gt;Script: Test quét thử ổ cứng (smartctl --scan)
    Script--&gt;&gt;Admin: Hiển thị danh sách ổ cứng &amp; Hoàn tất!
    deactivate Script
</code></pre>

<h2>3. Sơ đồ Cơ chế Low-Level Discovery (LLD) trên Zabbix</h2>
<pre><code class="language-mermaid">
graph LR
    ZServer[(Zabbix Server)] --&gt;|1. Gửi lệnh Discovery| ZAgent[Zabbix Agent]
    ZAgent --&gt;|2. Chạy script khám phá| Smartctl[smartctl --scan]
    Smartctl --&gt;|3. Trả danh sách ổ cứng| ZAgent
    ZAgent --&gt;|4. Gửi JSON list: /dev/sda, /dev/nvme0n1| ZServer
    
    ZServer --&gt;|5. Sinh ra Items &amp; Triggers tự động| Items[Các Metrics Ổ cứng]
    Items --&gt; M1[Temperature]
    Items --&gt; M2[Health Status]
    Items --&gt; M3[Power On Hours]
    Items --&gt; M4[SSD Wear Level]
    
    classDef zbx fill:#dd6b20,stroke:#fff,stroke-width:2px,color:#fff;
    classDef agent fill:#e53e3e,stroke:#fff,stroke-width:2px,color:#fff;
    classDef os fill:#3182ce,stroke:#fff,stroke-width:2px,color:#fff;
    classDef metric fill:#38a169,stroke:#fff,stroke-width:2px,color:#fff;
    
    class ZServer zbx;
    class ZAgent agent;
    class Smartctl os;
    class Items,M1,M2,M3,M4 metric;
</code></pre>
<hr/>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Giám sát Sức khỏe Ổ cứng Tự động qua Zabbix/i } });
    if (post) {
      // Xóa phần sơ đồ cũ nếu có (bằng cách cắt nội dung từ "## 1. Tổng quan Giải pháp")
      let content = post.content;
      
      // Xóa khối Sơ đồ Kiến trúc đầu tiên
      content = content.replace(/<h2>Sơ đồ Kiến trúc Giám sát Sức khỏe Ổ cứng<\/h2>[\s\S]*?<\/code><\/pre>/i, "");
      
      // Chèn các sơ đồ chi tiết mới
      if (content.includes("<h1")) {
          content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + detailedDiagramsHTML);
      } else {
          content = detailedDiagramsHTML + "\n" + content;
      }
      
      post.content = content;
      await post.save();
      console.log("Added DETAILED diagrams successfully!");
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
