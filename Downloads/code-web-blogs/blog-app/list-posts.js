const mongoose = require("mongoose");
const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const posts = await Post.find({});
    posts.forEach(p => console.log(p.title));
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
}

main();
