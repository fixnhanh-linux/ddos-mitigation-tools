const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z/i } });
    if (post) {
        let newContent = post.content;
        
        // Fix the HTML entities in code blocks
        newContent = newContent.replace(/&lt;/g, "<");
        newContent = newContent.replace(/&gt;/g, ">");
        
        // Make sure we didn't break the Mermaid diagrams if they needed anything special (they shouldn't need HTML entities)
        
        post.content = newContent;
        await post.save();
        console.log("Post updated successfully! Replaced HTML entities.");
    } else {
        console.log("Post not found.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
