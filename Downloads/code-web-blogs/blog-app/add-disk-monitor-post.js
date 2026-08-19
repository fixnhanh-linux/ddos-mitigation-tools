const mongoose = require("mongoose");
const fs = require("fs");
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

const diagramHTML = `
<h2>Sơ đồ Kiến trúc Giám sát Sức khỏe Ổ cứng</h2>
<pre><code class="language-mermaid">
graph TD
    subgraph "Monitored Server (Linux)"
        Disk[("Ổ cứng&lt;br&gt;(HDD / SSD / NVMe)")]
        Smartctl["smartctl&lt;br&gt;(smartmontools)"]
        Agent["Zabbix Agent Classic&lt;br&gt;(SMART Plugin / UserParameter)"]
        
        Disk --&gt;|Đọc dữ liệu SMART| Smartctl
        Smartctl --&gt;|Gọi bằng Sudo| Agent
    end

    subgraph "Zabbix Monitoring System"
        ZabbixServer["Zabbix Server&lt;br&gt;(Template: SMART by Zabbix agent)"]
        Dashboard["Dashboard &amp; Alerts&lt;br&gt;(Nhiệt độ, Bad Sector, Tuổi thọ)"]
        
        Agent --&gt;|Gửi Metrics định kỳ| ZabbixServer
        ZabbixServer --&gt;|Phân tích &amp; LLD| Dashboard
    end
    
    classDef disk fill:#4a5568,stroke:#cbd5e0,stroke-width:2px,color:#fff;
    classDef tool fill:#3182ce,stroke:#bee3f8,stroke-width:2px,color:#fff;
    classDef agent fill:#e53e3e,stroke:#fed7d7,stroke-width:2px,color:#fff;
    classDef zabbix fill:#dd6b20,stroke:#feebc8,stroke-width:2px,color:#fff;
    classDef dash fill:#38a169,stroke:#c6f6d5,stroke-width:2px,color:#fff;
    
    class Disk disk;
    class Smartctl tool;
    class Agent agent;
    class ZabbixServer zabbix;
    class Dashboard dash;
</code></pre>
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
      console.log("No user found. Creating dummy user...");
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    let markdownContent = fs.readFileSync("disk-monitor-guide.md", "utf8");
    
    // Add diagram to the markdown itself before compiling to HTML, or after?
    // Doing it before might be easier
    if (markdownContent.includes("# Hướng dẫn Giám sát")) {
        markdownContent = markdownContent.replace(/(# Hướng dẫn.*?)(?=\n\n)/i, "$1\n" + diagramHTML);
    }
    
    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn Giám sát Sức khỏe Ổ cứng Tự động qua Zabbix (SMART Monitoring)",
      slug: "huong-dan-giam-sat-suc-khoe-o-cung-tu-dong-qua-zabbix-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn cách sử dụng script tự động để cài đặt và cấu hình giám sát sức khỏe ổ cứng (HDD/SSD/NVMe) qua Zabbix Agent Classic sử dụng công nghệ S.M.A.R.T.",
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
