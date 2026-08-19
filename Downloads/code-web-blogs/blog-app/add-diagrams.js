const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const ddosDiagram = `
<hr>
<h2>Sơ đồ các lớp phòng chống DDoS (DDoS Mitigation Architecture)</h2>
<p>Sơ đồ này mô tả cách luồng traffic (truy cập mạng) từ kẻ tấn công bị chặn lại qua 4 lớp phòng thủ trước khi đến được Web Application (Mã nguồn web) của bạn.</p>
<pre><code class="language-mermaid">
graph TD
    A[Hacker / Botnet] --&gt;|Traffic rác 100Gbps| B(Lớp 4: Cloudflare CDN)
    C[Người dùng thật] --&gt;|Traffic sạch| B
    
    B --&gt;|Lọc chặn Botnet, chỉ cho qua Traffic sạch| D(Lớp 3: Firewall - UFW/Iptables)
    
    D --&gt;|Khóa IP nếu gửi quá nhiều kết nối Fail2Ban| E(Lớp 1: Linux Kernel - sysctl)
    
    E --&gt;|Chống SYN Flood, tối ưu bộ đệm TCP| F(Lớp 2: Web Server - Nginx Rate Limit)
    
    F --&gt;|Giới hạn mỗi IP 5 request/giây| G((Web / App / DB của bạn))
    
    style B fill:#f9a826,stroke:#f39c12,stroke-width:2px,color:#fff
    style D fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    style E fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff
    style F fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff
    style G fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff
</code></pre>
`;

const ntopngDiagram = `
<hr>
<h2>Sơ đồ Mô hình Giám sát của ntopng</h2>
<p>Sơ đồ này giải thích cách ntopng thu thập luồng dữ liệu (traffic) từ Card mạng, phân tích nó và hiển thị lên giao diện Web cho Quản trị viên (Admin).</p>
<pre><code class="language-mermaid">
graph LR
    A((Internet)) &lt;--&gt; B[Card mạng - eth0/ens33]
    B &lt;--&gt; C((Mạng nội bộ - LAN))
    
    B -.->|Copy bản sao Packet / Promiscuous Mode| D{ntopng Core}
    
    D --&gt;|Phân tích Layer 7| E[Phát hiện Ứng dụng: YouTube, Facebook...]
    D --&gt;|Phân tích Endpoint| F[Định danh Hosts, Geolocations, OS]
    D --&gt;|Cảnh báo An ninh| G[Phát hiện Scan IP, Brute-force SSH]
    
    E --&gt; H[Giao diện Web ntopng port 3000]
    F --&gt; H
    G --&gt; H
    
    H --&gt;|Giám sát| I[System Admin]
    
    style D fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff
    style H fill:#1abc9c,stroke:#16a085,stroke-width:2px,color:#fff
</code></pre>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Update DDoS Post
    const ddosPost = await Post.findOne({ title: "Hướng dẫn toàn tập cách phòng chống DDoS cho máy chủ Linux từ A-Z" });
    if (ddosPost && !ddosPost.content.includes("Sơ đồ các lớp phòng chống DDoS")) {
      ddosPost.content = ddosDiagram + ddosPost.content; // Put diagram at the top or bottom? Put it at the top for better visibility.
      await ddosPost.save();
      console.log("Updated DDoS Post.");
    }
    
    // Update Ntopng Post
    const ntopPost = await Post.findOne({ title: "Hướng dẫn giám sát lưu lượng mạng bằng ntopng trên Linux từ A-Z" });
    if (ntopPost && !ntopPost.content.includes("Sơ đồ Mô hình Giám sát của ntopng")) {
      ntopPost.content = ntopngDiagram + ntopPost.content;
      await ntopPost.save();
      console.log("Updated Ntopng Post.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
