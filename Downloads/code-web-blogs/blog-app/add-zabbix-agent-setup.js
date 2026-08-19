const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const markdownContent = `
# Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z

Giám sát cụm Ceph trên Proxmox bằng Zabbix giúp bạn nắm bắt chính xác trạng thái hoạt động của hệ thống lưu trữ phân cập. Trong bài viết này, tôi sẽ hướng dẫn chi tiết từ A-Z cách cài đặt Agent, cấu hình RESTful API trên Ceph, viết script lấy log, và hoàn thiện thiết lập trên Zabbix Web.

---

## 1. Cài đặt và Cấu hình Zabbix Agent 2 (Quan Trọng)

Trước khi cấu hình các thứ khác, bạn phải cài đặt \`zabbix-agent2\` lên Proxmox Node và chỉnh sửa cấu hình kết nối chuẩn xác để Agent giao tiếp được với Ceph và Zabbix Server.

### 1.1 Cài đặt Zabbix Agent 2
Truy cập SSH vào Proxmox Node và cài đặt:
\`\`\`bash
apt install zabbix-agent2
\`\`\`

### 1.2 Cấu hình zabbix_agent2.conf
Mở file cấu hình của Agent:
\`\`\`bash
nano /etc/zabbix/zabbix_agent2.conf
\`\`\`

Bạn cần tìm và sửa lại các tham số sau cho đúng với hệ thống mạng của bạn (Đặc biệt lưu ý \`AllowKey\` và \`Plugins.Ceph\`):
\`\`\`ini
Server=IP zabbix proxy hoặc IP zabbix server 10.8.10.201
ServerActive=
Plugins.Ceph.InsecureSkipVerify=true
AllowKey=system.run[*]
\`\`\`
*(Sau khi sửa xong, lưu file và khởi động lại agent bằng lệnh \`systemctl restart zabbix-agent2\`)*.

---

## 2. Cấu hình trên Host Proxmox (Bật RESTful API)

Để Zabbix có thể kéo dữ liệu (JSON) về số lượng OSD, Pool... chúng ta cần dùng module \`restful\` của Ceph Manager (MGR).

### Các bước kiểm tra và thực hiện:
1. **Tìm Node đang làm Active Manager:** Dùng lệnh \`ceph -s\` để check xem host nào đang là head node mgr. Sau đó truy cập SSH vào host đó.
2. **Kiểm tra Module Restful:** Kiểm tra xem module này đã được bật hay chưa.
3. **Kiểm tra Port 8003:** Nếu module đã bật, gõ lệnh \`ss -lnt\` để xem port 8003 đã mở (listen) chưa.
4. **Xử lý nếu Port chưa mở:** Nếu chưa mở, thực hiện restart lại module restful. Nếu module báo online mà port vẫn chưa mở, hãy SSH sang các host (node) khác trong cụm Ceph kiểm tra xem port 8003 đang mở ở đâu để tiến hành cấu hình tiếp ở đó.

### Cấu hình bằng Dòng lệnh (CLI)
Trên node đang chạy Active MGR, hãy gõ tuần tự các lệnh sau:

\`\`\`bash
ceph mgr module enable restful
ceph restful create-key zabbix-monitor
ceph restful create-self-signed-cert
ceph restful list-keys

ceph restful restart
\`\`\`

### Test thử API bằng CURL
Sau khi có API Key (chuỗi UUID), bạn có thể test trực tiếp bằng CURL để xem dữ liệu JSON trả về.
\`\`\`bash
# curl -k https://&lt;USER&gt;:&lt;API_KEY&gt;@127.0.0.1:8003/server
curl -k https://zabbix-monitor:02af02fa-9994-47f3-a970-0c8101005c7c@127.0.0.1:8003/server
\`\`\`

---

## 3. Cấu hình Script lấy chi tiết Log Cluster Ceph

Chúng ta sẽ tạo kịch bản bash để ghi log trạng thái Ceph ra file text mỗi phút, cho phép Zabbix (qua \`system.run\`) đọc được cực kỳ nhanh chóng.

Đầu tiên, di chuyển vào thư mục của Zabbix và tạo các file cần thiết:
\`\`\`bash
cd /etc/zabbix/
touch cephstatus.txt docfile.sh cephstatus.sh

chmod +x cephstatus.txt
chmod +x docfile.sh
chmod +x cephstatus.sh
\`\`\`

#### Viết nội dung cho cephstatus.sh (Ghi Log)
\`\`\`bash
cat &lt;&lt; EOF &gt; /etc/zabbix/cephstatus.sh
#!/bin/sh
ceph health &gt; /etc/zabbix/cephstatus.txt
date &gt;&gt; /etc/zabbix/cephstatus.txt
EOF
\`\`\`

#### Viết nội dung cho docfile.sh (Đọc Log cho Zabbix)
\`\`\`bash
nano /etc/zabbix/docfile.sh
\`\`\`
Dán đoạn mã sau vào:
\`\`\`bash
#!/bin/sh
value=\$(cat /etc/zabbix/cephstatus.txt)
echo "\$value"
\`\`\`

#### Chạy thử và Đặt lịch (Cronjob)
Chạy thử xem script có hoạt động không:
\`\`\`bash
./cephstatus.sh
./docfile.sh
\`\`\`
Tiếp theo, hãy đưa script vào lịch trình Cronjob:
\`\`\`bash
crontab -e
\`\`\`
Thêm dòng sau:
\`\`\`bash
* * * * * /etc/zabbix/cephstatus.sh
\`\`\`

---

## 4. Setup trên Giao diện Zabbix Web (Frontend)

Đây là bước cuối cùng để hợp nhất toàn bộ dữ liệu lên màn hình giám sát.

### Bước 4.1: Import và Gán Template
1. Truy cập vào Zabbix Web.
2. Vào **Configuration -&gt; Hosts**, chọn Proxmox Node.
3. Ở mục **Templates**, gán template: \`Ceph by Zabbix agent 2\`.

### Bước 4.2: Cấu hình Macros (Kết nối API)
Chuyển sang tab **Macros**, chọn *Inherited and host macros* và điền:
- \`{$CEPH.API.URL}\` : Điền \`https://&lt;IP_Node_Proxmox&gt;:8003\`
- \`{$CEPH.USER}\` : Điền \`zabbix-monitor\`
- \`{$CEPH.API.KEY}\` : Dán chuỗi API key bạn lấy được ở Phần 2.

### Bước 4.3: Khởi tạo Item Custom để đọc Script Ceph Status
Bây giờ chúng ta sẽ thêm Item để nhận dữ liệu từ \`docfile.sh\`.

1. Bấm vào **Items** của Host, chọn **Create Item**.
2. Cấu hình Item:
   - **Name:** \`Ceph-Status\`
   - **Type:** \`Zabbix agent\`
   - **Key:** \`system.run[/etc/zabbix/docfile.sh]\`
   - **Type of information:** \`Text\`
   - **Update interval:** \`1m\`
3. Bấm **Add**.

Vậy là quy trình Monitor Ceph trên Proxmox đã hoàn thiện 100% từ A-Z đúng chuẩn quy trình hệ thống!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z/i } });
    if (post) {
        post.content = marked.parse(markdownContent);
        await post.save();
        console.log("Post updated successfully with Zabbix Agent 2 setup details!");
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
