const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db';
const PostSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const imageUrl = 'https://www.academy4heroes.com/wp-content/uploads/2025/04/systemnyj-administrator-hto-vin-main.png';
    const posts = await Post.find({ coverImage: imageUrl });
    console.log(`Found ${posts.length} posts with the target cover image.`);

    let updated = 0;
    for (let p of posts) {
      // Find the first image in the content
      const match = p.content && p.content.match(/<img[^>]+src=["']([^"']+)["']/i);
      
      if (match && match[1]) {
        // If content has an image, use it as cover image
        await Post.updateOne({ _id: p._id }, { $set: { coverImage: match[1] } });
      } else {
        // Otherwise, unset the cover image
        await Post.updateOne({ _id: p._id }, { $unset: { coverImage: "" } });
      }
      updated++;
    }

    console.log(`Successfully restored ${updated} posts.`);
  } catch (error) {
    console.error('Error updating posts:', error);
  } finally {
    mongoose.connection.close();
    console.log('Disconnected from MongoDB.');
  }
}

main();
