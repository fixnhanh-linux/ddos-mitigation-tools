
const mongoose = require('mongoose');

// Fallback if dotenv didn't load MONGODB_URI correctly in standalone
const fs = require('fs');
let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    const match = envContent.match(/MONGODB_URI=(.*)/);
    if (match) MONGODB_URI = match[1].trim();
  } catch (e) {
    console.error("Cannot read .env.local", e);
  }
}

if (!MONGODB_URI) {
  console.error("No MONGODB_URI found.");
  process.exit(1);
}

const PostSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  
  const posts = await Post.find({});
  let migrated = 0;
  
  for (const p of posts) {
    if (!p.status) {
      p.status = p.published ? "published" : "draft";
      await p.save();
      migrated++;
    }
  }
  
  console.log(`Migrated ${migrated} posts to use 'status'.`);
  process.exit(0);
}

run().catch(console.error);
