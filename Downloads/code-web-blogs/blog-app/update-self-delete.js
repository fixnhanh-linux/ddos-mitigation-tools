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
        let content = post.content;
        
        // Find the line "echo "Hay copy chuoi UUID tren va nhap vao giao dien Zabbix Web."" and append the self-delete command right after it.
        const searchString = 'echo "Hay copy chuoi UUID tren va nhap vao giao dien Zabbix Web."';
        const replacement = 'echo "Hay copy chuoi UUID tren va nhap vao giao dien Zabbix Web."\n\n# Tự động xóa chính script này sau khi chạy xong để dọn dẹp hệ thống\nrm -- "$0"';
        
        content = content.replace(searchString, replacement);
        
        // Also update the description paragraph to mention the self-delete feature.
        const descSearch = 'Đồng thời, nó tự động ép Zabbix Agent 2 chạy qua cổng `10052`.';
        const descReplace = 'Đồng thời, nó tự động ép Zabbix Agent 2 chạy qua cổng `10052` và **có khả năng tự tiêu hủy (self-delete)** sau khi hoàn tất để không để lại rác trên server.';
        content = content.replace(descSearch, descReplace);

        post.content = content;
        await post.save();
        console.log("Post updated successfully! Script now self-deletes.");
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
