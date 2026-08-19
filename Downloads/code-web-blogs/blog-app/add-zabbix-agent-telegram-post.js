const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String }
}, { timestamps: true });

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Category = mongoose.models.Category || mongoose.model("Category", CategorySchema);
const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const markdownContent = `
# Hướng dẫn cài đặt Zabbix Agent và thiết lập cảnh báo Telegram cực chuẩn

Ở bài viết trước, chúng ta đã cài đặt thành công **Zabbix Server** - "Bộ não" của hệ thống giám sát. Tuy nhiên, một bộ não không thể hoạt động nếu thiếu đi các giác quan. 

**Zabbix Agent** chính là các giác quan đó. Nó là một phần mềm siêu nhẹ được cài đặt lên các máy chủ con (VPS/Server) mà bạn muốn giám sát, làm nhiệm vụ thu thập CPU, RAM, Disk... và gửi về cho Server. Bài viết này sẽ hướng dẫn bạn cài đặt Agent và cấu hình một thứ cực kỳ quan trọng: **Gửi cảnh báo (Alert) qua Telegram**.

---

## 1. Cài đặt Zabbix Agent lên Máy chủ (Client)

Giả sử bạn đang có một Máy chủ Web chạy Ubuntu/Debian cần được giám sát. Hãy truy cập SSH vào máy chủ đó.

### Bước 1: Thêm Repository và Cài đặt Agent
Cũng giống như cài Server, bạn cần thêm Repo của Zabbix vào Máy chủ con:
\`\`\`bash
wget https://repo.zabbix.com/zabbix/6.4/ubuntu/pool/main/z/zabbix-release/zabbix-release_6.4-1+ubuntu22.04_all.deb
dpkg -i zabbix-release_6.4-1+ubuntu22.04_all.deb
apt update
apt install zabbix-agent
\`\`\`

### Bước 2: Cấu hình Agent kết nối về Server
Bạn cần khai báo cho Agent biết "Bộ não" đang nằm ở địa chỉ IP nào.
Mở file cấu hình:
\`\`\`bash
nano /etc/zabbix/zabbix_agentd.conf
\`\`\`
Tìm và sửa 3 dòng sau:
\`\`\`ini
Server=IP_CUA_ZABBIX_SERVER
ServerActive=IP_CUA_ZABBIX_SERVER
Hostname=Ten_May_Chu_Nay (VD: Web-Server-01)
\`\`\`
Lưu file và khởi động lại Agent:
\`\`\`bash
systemctl restart zabbix-agent
systemctl enable zabbix-agent
\`\`\`

### Bước 3: Thêm Máy chủ vào Zabbix Web
Mở giao diện Web của Zabbix Server, chuyển đến menu **Configuration > Hosts** và nhấn **Create Host**.
- **Host name:** \`Web-Server-01\` (Phải giống hệt trong file cấu hình ở Bước 2).
- **Templates:** Chọn \`Linux by Zabbix agent\`.
- **Groups:** Chọn \`Linux servers\`.
- **Interfaces:** Nhấn *Add -> Agent*, nhập địa chỉ IP của Máy chủ con vào ô **IP address**.
Nhấn **Add** để hoàn tất. Chờ khoảng 2 phút, nút **ZBX** ở cột Availability sáng màu xanh lá là bạn đã kết nối thành công!

## 2. Thiết lập Bot Telegram để nhận cảnh báo

Nhìn chằm chằm vào màn hình Zabbix cả ngày là một cực hình. Hãy để Telegram báo tin cho bạn khi có máy chủ bị sập mạng hay đầy ổ cứng.

### Bước 1: Tạo Bot Telegram
- Mở ứng dụng Telegram, tìm kiếm \`@BotFather\`.
- Gõ lệnh \`/newbot\`, đặt tên và username cho bot.
- BotFather sẽ trả về cho bạn một mã **HTTP API Token** (Ví dụ: \`123456789:ABCdefGHI...\`). Hãy lưu mã này lại.

### Bước 2: Lấy Chat ID của bạn
- Tìm kiếm \`@userinfobot\` hoặc \`@get_id_bot\` trên Telegram và bấm Start.
- Nó sẽ trả về cho bạn một dãy số (Ví dụ: \`987654321\`). Đây chính là **Chat ID** của bạn.

### Bước 3: Cấu hình trên Zabbix Web
Zabbix phiên bản mới đã tích hợp sẵn tính năng bắn tin qua Telegram (Webhook), bạn không cần phải viết code Python mệt mỏi như trước đây nữa.

1. Vào **Administration > Media types**.
2. Tìm **Telegram** trong danh sách và nhấp vào nó.
3. Ở phần **Parameters**, tìm dòng **Token** và thay giá trị bằng mã \`HTTP API Token\` bạn lấy từ BotFather. Đảm bảo Checkbox \`Enabled\` đã được tích xanh. Bấm **Update**.

### Bước 4: Gắn Telegram vào Tài khoản Admin
1. Vào **Administration > Users**, nhấp vào tài khoản **Admin**.
2. Chuyển sang Tab **Media**, nhấn **Add**.
3. **Type:** Chọn Telegram.
4. **Send to:** Nhập **Chat ID** của bạn vào đây.
5. Cấp quyền nhận cảnh báo từ Information đến Disaster. Nhấn **Add** rồi **Update**.

### Bước 5: Tạo Action (Cò súng)
Bạn phải bảo Zabbix rằng: *"Khi có lỗi xảy ra, hãy dùng Telegram gửi tin cho Admin"*.
1. Vào **Configuration > Actions > Trigger actions**.
2. Nhấn **Create action**, đặt tên là \`Send to Telegram\`.
3. Chuyển sang tab **Operations**, ở mục *Operations* nhấn **Add**.
4. **Send to users:** Bấm Add và chọn Admin.
5. **Send only to:** Chọn Telegram. Nhấn **Add**, rồi **Add** lần nữa để lưu Action.

## Kết luận
Bây giờ, hãy thử truy cập vào máy chủ con và chạy lệnh \`systemctl stop zabbix-agent\` (Giả lập lỗi sập máy chủ). Chỉ sau khoảng 3-5 phút, điện thoại của bạn sẽ *Ting Ting* và nhận được tin nhắn từ Bot Telegram báo cáo lỗi chi tiết. Từ nay, bạn có thể đi chơi cuối tuần mà vẫn nắm trọn hệ thống trong lòng bàn tay!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // 1. Get User
    let user = await User.findOne({});
    let authorId = user ? user._id : null;

    // 2. Find Category
    let category = await Category.findOne({ slug: "giam-sat" });
    let catId = category ? category._id : null;

    // 3. Create new post
    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn cài đặt Zabbix Agent và thiết lập cảnh báo Telegram cực chuẩn",
      slug: "cai-dat-zabbix-agent-canh-bao-telegram-" + Date.now(),
      content: htmlContent,
      excerpt: "Zabbix Server của bạn sẽ vô dụng nếu không có các Agent đi thu thập dữ liệu. Khám phá cách cài đặt Zabbix Agent lên các máy chủ con và kết nối Bot Telegram để nhận cảnh báo ngay khi Server có biến.",
      author: authorId,
      category: catId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("New post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
