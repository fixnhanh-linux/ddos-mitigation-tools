const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

// Using a loose schema just to perform the update
const PostSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");
    
    const imageUrl = "https://www.academy4heroes.com/wp-content/uploads/2025/04/systemnyj-administrator-hto-vin-main.png";
    
    // Update all posts
    const result = await Post.updateMany(
      {}, // match all documents
      { $set: { coverImage: imageUrl } }
    );
    
    console.log("Update result:", result);
    console.log(`Successfully updated ${result.modifiedCount} posts with the new cover image.`);
    
  } catch (error) {
    console.error("Error updating posts:", error);
  } finally {
    mongoose.connection.close();
    console.log("Disconnected from MongoDB.");
  }
}

main();
