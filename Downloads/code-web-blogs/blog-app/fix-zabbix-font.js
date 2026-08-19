const mongoose = require("mongoose");
const fs = require("fs");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Đọc file chuẩn UTF-8
    const markdownContent = fs.readFileSync("zabbix-agent-guide-fixed.md", "utf8");
    const htmlContent = marked.parse(markdownContent);

    // Update bài viết bị lỗi font
    const post = await Post.findOne({ title: "Hướng dẫn Cài đặt Zabbix Agent Tự động (Multi-OS)" });
    if (post) {
      post.content = htmlContent;
      await post.save();
      console.log("Updated post successfully, font is fixed!");
    } else {
      console.log("Post not found!");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
