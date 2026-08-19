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
    
    // Find Zabbix Ceph post
    const zabbixPost = await Post.findOne({ title: { $regex: /Monitor Ceph trên Proxmox bằng Zabbix/i } });
    if (!zabbixPost) {
        console.log("Could not find Zabbix Ceph post.");
        return;
    }
    
    // Find Health Ceph post
    const healthPost = await Post.findOne({ title: { $regex: /Hiểu rõ và Khắc phục các trạng thái Health của Ceph/i } });
    if (!healthPost) {
        console.log("Could not find Ceph Health post.");
        return;
    }

    // Prepare the appended content, converting some H2 tags to keep hierarchy
    let appendedContent = healthPost.content;
    
    // Convert <h1> in the Health post to a <h2> so it fits in the main post
    appendedContent = appendedContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "<h2>PHẦN 2: Hiểu rõ và Khắc phục các trạng thái Health của Ceph (HEALTH_WARN, HEALTH_ERR)</h2>");
    
    // Merge the contents
    zabbixPost.content = zabbixPost.content + "\n<hr/><br/>\n" + appendedContent;
    zabbixPost.title = "Toàn tập Monitor Ceph trên Proxmox bằng Zabbix & Xử lý lỗi Health";
    zabbixPost.excerpt = "Hướng dẫn thiết lập plugin Ceph tích hợp sẵn trên Zabbix Agent 2 để giám sát Proxmox Ceph, kết hợp phân tích chuyên sâu các mã lỗi OSD, PG, HEALTH_WARN, HEALTH_ERR kèm 6 sơ đồ kiến trúc cực kỳ chi tiết.";
    
    await zabbixPost.save();
    console.log("Successfully merged content into Zabbix Ceph post!");
    
    // Delete the separate Health post
    await Post.deleteOne({ _id: healthPost._id });
    console.log("Successfully deleted the duplicate Health post!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
