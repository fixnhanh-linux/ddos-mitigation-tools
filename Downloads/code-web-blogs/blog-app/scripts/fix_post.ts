import mongoose from "mongoose";
import { marked } from "marked";
import Post from "../src/models/Post";

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const post = await Post.findOne({ slug: "giam-sat-postgresql-prometheus-grafana" });
    if (post) {
      // Convert Markdown to HTML because the frontend expects HTML from TinyMCE
      const htmlContent = await marked.parse(post.content);
      post.content = htmlContent;
      await post.save();
      console.log("Successfully converted post content from Markdown to HTML");
    } else {
      console.log("Post not found");
    }
  } catch (error) {
      console.error(error);
  } finally {
      process.exit(0);
  }
}
run();
