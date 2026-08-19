const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Find the Mega Ceph post
    const megaPost = await Post.findOne({ title: { $regex: /Toàn tập Monitor Ceph trên Proxmox bằng Zabbix/i } });
    if (!megaPost) {
        console.log("Could not find the Mega Ceph post.");
        return;
    }
    
    // Find the Ceph Status post
    const statusPost = await Post.findOne({ title: { $regex: /Giải mã toàn tập lệnh 'Ceph Status'/i } });
    if (!statusPost) {
        console.log("Could not find the Ceph Status post.");
        return;
    }

    // Prepare the appended content, converting <h1> in the Status post to a <h2>
    let appendedContent = statusPost.content;
    appendedContent = appendedContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "<h2>PHẦN 3: Giải mã lệnh 'Ceph Status' (ceph -s) & Script Cảnh báo Telegram tự động</h2>");
    
    // Merge the contents
    megaPost.content = megaPost.content + "\n<hr/><br/>\n" + appendedContent;
    megaPost.title = "Cẩm nang Toàn tập Ceph Proxmox: Monitor Zabbix, Xử lý lỗi & Script Cảnh báo Telegram";
    megaPost.excerpt = "Tài liệu kỹ thuật chuyên sâu (3 in 1): Hướng dẫn thiết lập giám sát Ceph bằng Zabbix Agent 2, phân tích khắc phục triệt để mã lỗi HEALTH_WARN/ERR, giải mã ceph status và kịch bản cảnh báo Telegram tự động. Bao gồm 10 sơ đồ kiến trúc.";
    
    await megaPost.save();
    console.log("Successfully merged Ceph Status into the Mega Ceph post!");
    
    // Delete the separate Status post
    await Post.deleteOne({ _id: statusPost._id });
    console.log("Successfully deleted the duplicate Ceph Status post!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
