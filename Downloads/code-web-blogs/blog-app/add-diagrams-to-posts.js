const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const grafanaDiagramHTML = `
<h2>Sơ đồ Kiến trúc Giám sát PostgreSQL với Grafana Alloy</h2>
<pre><code class="language-mermaid">
graph LR
    subgraph "Database Environment"
        DB[(PostgreSQL)]
        Alloy["Grafana Alloy&lt;br&gt;(PostgreSQL Exporter)"]
        DB --&gt;|Local Metrics| Alloy
    end

    subgraph "Observability Stack"
        Prometheus[("Prometheus / &lt;br&gt;Grafana Cloud")]
        Grafana[Grafana Dashboard]
        Alloy --&gt;|Remote Write| Prometheus
        Prometheus --&gt;|Query| Grafana
    end

    User((Admin)) --&gt;|View Dashboards| Grafana
    
    classDef db fill:#336791,stroke:#fff,stroke-width:2px,color:#fff;
    classDef alloy fill:#F47A20,stroke:#fff,stroke-width:2px,color:#fff;
    classDef prom fill:#E6522C,stroke:#fff,stroke-width:2px,color:#fff;
    classDef grafana fill:#F46800,stroke:#fff,stroke-width:2px,color:#fff;
    
    class DB db;
    class Alloy alloy;
    class Prometheus prom;
    class Grafana grafana;
</code></pre>
`;

const cicdDiagramHTML = `
<h2>Sơ đồ quy trình CI/CD với GitHub Actions</h2>
<pre><code class="language-mermaid">
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Repo
    participant Actions as GitHub Actions (CI/CD)
    participant VPS as VPS Server (Production)

    Dev-&gt;&gt;GH: 1. \`git push origin main\`
    GH-&gt;&gt;Actions: 2. Trigger "Deploy to VPS" Workflow
    
    activate Actions
    Actions-&gt;&gt;Actions: Checkout code
    Actions-&gt;&gt;VPS: 3. Kết nối qua SSH (dùng Secrets)
    
    activate VPS
    VPS-&gt;&gt;VPS: \`cd /var/www/my-website\`
    VPS-&gt;&gt;VPS: \`git pull origin main\`
    VPS-&gt;&gt;VPS: \`npm install & npm run build\`
    VPS-&gt;&gt;VPS: \`pm2 restart all\`
    VPS--&gt;&gt;Actions: Phản hồi thành công
    deactivate VPS
    
    Actions--&gt;&gt;GH: Đánh dấu Workflow "Tick xanh"
    deactivate Actions
    
    Note over Dev,VPS: Website đã được cập nhật phiên bản mới nhất!
</code></pre>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Update Grafana Post
    const grafanaPost = await Post.findOne({ title: { $regex: /Hướng dẫn cài đặt Grafana Alloy/i } });
    if (grafanaPost) {
      // Remove old diagram block from wherever it is
      grafanaPost.content = grafanaPost.content.replace(/<h2>Sơ đồ Kiến trúc Giám sát PostgreSQL với Grafana Alloy<\/h2>[\s\S]*?<\/code><\/pre>/, "");
      // Prepend diagram right after the main H1 heading, or at the very beginning if no H1
      if (grafanaPost.content.includes("<h1")) {
        grafanaPost.content = grafanaPost.content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + grafanaDiagramHTML);
      } else {
        grafanaPost.content = grafanaDiagramHTML + "\n" + grafanaPost.content;
      }
      await grafanaPost.save();
      console.log("Moved Grafana diagram to TOP and fixed syntax!");
    }

    // Update CI/CD Post
    const cicdPost = await Post.findOne({ title: { $regex: /GitHub Actions/i } });
    if (cicdPost) {
      // Remove old diagram block
      cicdPost.content = cicdPost.content.replace(/<h2>Sơ đồ quy trình CI\/CD với GitHub Actions<\/h2>[\s\S]*?<\/code><\/pre>/, "");
      // Prepend diagram right after the main H1 heading
      if (cicdPost.content.includes("<h1")) {
        cicdPost.content = cicdPost.content.replace(/(<h1[^>]*>.*?<\/h1>)/i, "$1\n" + cicdDiagramHTML);
      } else {
        cicdPost.content = cicdDiagramHTML + "\n" + cicdPost.content;
      }
      await cicdPost.save();
      console.log("Moved CI/CD diagram to TOP and fixed syntax!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
