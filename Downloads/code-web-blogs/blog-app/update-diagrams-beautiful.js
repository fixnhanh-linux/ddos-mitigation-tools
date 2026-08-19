const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const newDdosDiagram = `
graph TD
    classDef attacker fill:#ef4444,stroke:#991b1b,stroke-width:3px,color:#fff,rx:10,ry:10;
    classDef user fill:#10b981,stroke:#065f46,stroke-width:3px,color:#fff,rx:10,ry:10;
    classDef cloudflare fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef firewall fill:#3b82f6,stroke:#1e3a8a,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef kernel fill:#6366f1,stroke:#3730a3,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef nginx fill:#14b8a6,stroke:#115e59,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef target fill:#8b5cf6,stroke:#4c1d95,stroke-width:3px,color:#fff,rx:15,ry:15;

    A[😈 Botnet / Hacker]:::attacker --&gt;|🔥 Traffic rác 100Gbps| B(☁️ Lớp 4: Cloudflare CDN):::cloudflare
    C[👤 Người dùng thật]:::user --&gt;|✅ Traffic sạch| B
    
    B --&gt;|Lọc chặn Botnet&lt;br&gt;Chỉ cho qua Traffic sạch| D(🧱 Lớp 3: Firewall UFW / Iptables):::firewall
    
    D --&gt;|Khóa IP bằng Fail2Ban&lt;br&gt;nếu spam kết nối| E(🐧 Lớp 1: Linux Kernel sysctl):::kernel
    
    E --&gt;|Chống SYN Flood&lt;br&gt;Tối ưu bộ đệm TCP| F(⚙️ Lớp 2: Nginx Rate Limit):::nginx
    
    F --&gt;|Giới hạn mỗi IP&lt;br&gt;5 request/giây| G((🛡️ Máy chủ Web của bạn)):::target
`;

const newNtopngDiagram = `
graph LR
    classDef internet fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff,rx:10,ry:10;
    classDef lan fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff,rx:10,ry:10;
    classDef nic fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef core fill:#f59e0b,stroke:#b45309,stroke-width:3px,color:#fff,rx:50,ry:50;
    classDef process fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff,rx:5,ry:5;
    classDef ui fill:#ec4899,stroke:#be185d,stroke-width:2px,color:#fff,rx:10,ry:10;
    classDef admin fill:#14b8a6,stroke:#0f766e,stroke-width:2px,color:#fff,rx:20,ry:20;

    subgraph Mạng
      A((🌐 Internet)):::internet &lt;--&gt; B[🔌 Card mạng eth0]:::nic
      C((🏠 Mạng nội bộ)):::lan &lt;--&gt; B
    end

    B -.->|Promiscuous Mode| D{⚡ ntopng Core}:::core
    
    subgraph Phân tích
      D --&gt;|Layer 7| E[📱 Ứng dụng&lt;br&gt;YouTube, FB]:::process
      D --&gt;|Endpoint| F[📍 Định danh&lt;br&gt;Hosts, OS]:::process
      D --&gt;|An ninh| G[🚨 Bất thường&lt;br&gt;Scan, Brute-force]:::process
    end
    
    E --&gt; H[💻 Web UI&lt;br&gt;Port 3000]:::ui
    F --&gt; H
    G --&gt; H
    
    H --&gt;|Giám sát 24/7| I[👨‍💻 System Admin]:::admin
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const ddosPost = await Post.findOne({ title: "Hướng dẫn toàn tập cách phòng chống DDoS cho máy chủ Linux từ A-Z" });
    if (ddosPost) {
      ddosPost.content = ddosPost.content.replace(/<code class="language-mermaid">([\s\S]*?)<\/code>/, '<code class="language-mermaid">\n\n' + newDdosDiagram + '\n\n</code>');
      await ddosPost.save();
      console.log("Updated DDoS Post diagram.");
    }
    
    const ntopPost = await Post.findOne({ title: "Hướng dẫn giám sát lưu lượng mạng bằng ntopng trên Linux từ A-Z" });
    if (ntopPost) {
      ntopPost.content = ntopPost.content.replace(/<code class="language-mermaid">([\s\S]*?)<\/code>/, '<code class="language-mermaid">\n\n' + newNtopngDiagram + '\n\n</code>');
      await ntopPost.save();
      console.log("Updated Ntopng Post diagram.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
