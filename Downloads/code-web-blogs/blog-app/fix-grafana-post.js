const mongoose = require("mongoose");
const { marked } = require("marked");

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
    
    // Tìm bài viết có tiêu đề Hướng dẫn cài đặt Grafana Alloy
    const post = await Post.findOne({ title: { $regex: /Hướng dẫn cài đặt Grafana Alloy/i } });
    
    if (post) {
      console.log("Found post:", post.title);
      // Giả sử nội dung hiện tại là markdown
      const htmlContent = marked.parse(post.content);
      post.content = htmlContent;
      await post.save();
      console.log("Post updated successfully!");
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
