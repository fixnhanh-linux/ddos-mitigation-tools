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

    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z/i } });
    if (post) {
        let content = post.content;
        
        // Find the configuration block in Section 1.2 and add ListenPort=10052
        const searchConfig = `Server=IP_Zabbix_Proxy_hoac_Zabbix_Server
ServerActive=
Plugins.Ceph.InsecureSkipVerify=true
AllowKey=system.run[*]`;

        const replaceConfig = `Server=IP_Zabbix_Proxy_hoac_Zabbix_Server
ServerActive=
ListenPort=10052
Plugins.Ceph.InsecureSkipVerify=true
AllowKey=system.run[*]`;

        // Update the text explaining the config
        const searchText = `Bạn cần tìm và sửa lại các tham số sau cho đúng với hệ thống mạng của bạn (Đặc biệt lưu ý \`AllowKey\` và \`Plugins.Ceph\`):`;
        const replaceText = `Bạn cần tìm và sửa lại các tham số sau cho đúng với hệ thống mạng của bạn (Lưu ý: chúng ta đổi sang dùng \`ListenPort=10052\` để tránh xung đột với Agent 1 mặc định của Proxmox):`;

        content = content.replace(searchConfig, replaceConfig);
        content = content.replace(searchText, replaceText);

        post.content = content;
        await post.save();
        console.log("Post updated successfully! Section 1.2 now includes ListenPort=10052.");
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
