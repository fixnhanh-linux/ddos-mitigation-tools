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

    // Đọc file bị encode UTF-16LE do PowerShell
    const markdownContent = fs.readFileSync("zabbix-agent-guide.md", "utf16le");
    
    const htmlContent = marked.parse(markdownContent);

    // Xóa bài cũ nếu đã tồn tại để tránh lỗi duplicate slug (tùy chọn)
    // await Post.deleteOne({ title: "Hướng dẫn Cài đặt Zabbix Agent Tự động (Multi-OS)" });

    const post = new Post({
      title: "Hướng dẫn Cài đặt Zabbix Agent Tự động (Multi-OS)",
      slug: "huong-dan-cai-dat-zabbix-agent-tu-dong-multi-os-" + Date.now(),
      content: htmlContent,
      excerpt: "Hướng dẫn cách sử dụng script tự động để cài đặt và cấu hình Zabbix Agent (Classic) hoặc Zabbix Agent 2 trên các hệ điều hành Linux phổ biến như Ubuntu, Debian, CentOS, RHEL, Oracle Linux.",
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
