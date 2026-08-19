const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const markdownContent = `
# Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z

Giám sát cụm Ceph trên Proxmox bằng Zabbix giúp bạn nắm bắt chính xác trạng thái hoạt động của hệ thống lưu trữ phân tán. Trong bài viết này, tôi sẽ hướng dẫn chi tiết từ A-Z cách cài đặt Agent, cấu hình RESTful API trên Ceph, viết script lấy log, và hoàn thiện thiết lập trên Zabbix Web.

Dưới đây là sơ đồ tổng quan về kiến trúc luồng dữ liệu mà chúng ta sẽ xây dựng:

<pre><code class="language-mermaid">
graph TD
    subgraph Proxmox_Ceph_Cluster
        Node1["Proxmox Node 1 (MGR Active)"]
        Agent["Zabbix Agent 2"]
        Script["docfile.sh va cephstatus.sh"]
        
        Node1 --&gt;|Sinh ra log/status| Script
        Script --&gt;|system.run| Agent
        Node1 --&gt;|RESTful API Port 8003| Agent
    end
    
    subgraph Zabbix_Server
        ZWeb["Zabbix Dashboard"]
        ZServer["Zabbix Server / Proxy"]
    end
    
    Agent --&gt;|Tra du lieu JSON va Text| ZServer
    ZServer --&gt;|Hien thi bieu do va Canh bao| ZWeb
    
    classDef ceph fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef zabbix fill:#3182ce,stroke:#90cdf4,stroke-width:2px,color:#fff;
    
    class Node1,Script,Agent ceph;
    class ZWeb,ZServer zabbix;
</code></pre>

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
Server=IP_Zabbix_Proxy_hoac_Zabbix_Server
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
Trên node đang chạy Active MGR, hãy gõ tuần tự các lệnh sau. **Giải thích chi tiết ý nghĩa từng lệnh:**

\`\`\`bash
# 1. Kích hoạt module restful trên Ceph Manager để nó mở cổng API lắng nghe kết nối
ceph mgr module enable restful

# 2. Tạo một user (key) có tên là "zabbix-monitor" để Zabbix dùng xác thực khi gọi API
ceph restful create-key zabbix-monitor

# 3. Tạo một chứng chỉ SSL tự ký (Self-signed) để mã hóa đường truyền HTTPS khi Zabbix gọi vào port 8003
ceph restful create-self-signed-cert

# 4. Hiển thị danh sách các key đang có. Lệnh này sẽ in ra một mã UUID dài. Dãy số này chính là API Key password!
ceph restful list-keys

# 5. Khởi động lại module restful để áp dụng toàn bộ cấu hình
ceph restful restart
\`\`\`

### Test thử API bằng CURL
Sau khi có API Key (chuỗi UUID lấy từ lệnh số 4), bạn có thể test trực tiếp bằng CURL để xem dữ liệu JSON trả về.
\`\`\`bash
# Cú pháp mẫu: curl -k https://<USER>:<API_KEY>@127.0.0.1:8003/server
curl -k https://zabbix-monitor:02af02fa-9994-47f3-a970-0c8101005c7c@127.0.0.1:8003/server
\`\`\`
*(Nhớ copy lại chuỗi API Key này để lát nữa nhập vào Macros trên giao diện Zabbix Web nhé).*

---

## 3. Cấu hình Script lấy chi tiết Log Cluster Ceph

Chúng ta sẽ tạo kịch bản bash để ghi log trạng thái Ceph ra file text mỗi phút, cho phép Zabbix (qua \`system.run\`) đọc được cực kỳ nhanh chóng.

<pre><code class="language-mermaid">
sequenceDiagram
    participant Cronjob
    participant Script_cephstatus as cephstatus.sh
    participant File_TXT as cephstatus.txt
    participant Agent as Zabbix Agent
    participant Zabbix as Zabbix Server

    Cronjob-&gt;&gt;Script_cephstatus: Chay moi 1 phut
    activate Script_cephstatus
    Script_cephstatus-&gt;&gt;Script_cephstatus: Goi lenh ceph health
    Script_cephstatus-&gt;&gt;File_TXT: Ghi de vao file txt
    deactivate Script_cephstatus
    
    Zabbix-&gt;&gt;Agent: Yeu cau Item system.run
    activate Agent
    Agent-&gt;&gt;File_TXT: docfile.sh doc du lieu file txt
    File_TXT--&gt;&gt;Agent: Tra ve noi dung
    Agent--&gt;&gt;Zabbix: Gui trang thai HEALTH ve Dashboard
    deactivate Agent
</code></pre>

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
cat << 'EOF' > /etc/zabbix/cephstatus.sh
#!/bin/sh
ceph health > /etc/zabbix/cephstatus.txt
date >> /etc/zabbix/cephstatus.txt
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
2. Vào **Configuration -> Hosts**, chọn Proxmox Node.
3. Ở mục **Templates**, gán template: \`Ceph by Zabbix agent 2\`.

### Bước 4.2: Cấu hình Macros (Kết nối API)
Chuyển sang tab **Macros**, chọn *Inherited and host macros* và điền:
- \`{$CEPH.API.URL}\` : Điền \`https://<IP_Node_Proxmox>:8003\`
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

---

## 5. Quà tặng: Script Tự động hóa Cài đặt 100% (Thông minh)

Để tiết kiệm tối đa thời gian, tôi đã nâng cấp Bash Script này để nó trở nên **thông minh hơn**: Nó sẽ tự kiểm tra xem hệ thống đã cài Zabbix Agent 2 chưa, API Key đã tồn tại chưa để tránh việc ghi đè hoặc gây lỗi. Đồng thời, nó tự động ép Zabbix Agent 2 chạy qua cổng \`10052\`.

### Hướng dẫn sử dụng:
Trên máy chủ Proxmox (Node đang chạy Active Manager), bạn hãy tạo một file bash (ví dụ \`setup_ceph_zabbix.sh\`), dán đoạn code dưới đây vào, cấp quyền thực thi (\`chmod +x\`) và chạy nó!

\`\`\`bash
#!/bin/bash
echo "=== Zabbix Ceph Monitor Auto-Setup Script ==="
read -p "Nhập IP Zabbix Server hoặc Zabbix Proxy: " ZABBIX_SERVER_IP

echo "[1/4] Kiểm tra cài đặt Zabbix Agent 2..."
if dpkg -l | grep -q "zabbix-agent2"; then
    echo "-> Zabbix Agent 2 đã được cài đặt, bỏ qua bước tải."
else
    apt update && apt install zabbix-agent2 -y
fi

echo "[2/4] Cấu hình Zabbix Agent 2 (Port 10052)..."
cp /etc/zabbix/zabbix_agent2.conf /etc/zabbix/zabbix_agent2.conf.bak

# Cập nhật Server IP và Port 10052
sed -i "s/^Server=.*/Server=$ZABBIX_SERVER_IP/" /etc/zabbix/zabbix_agent2.conf
sed -i "s/^ServerActive=.*/ServerActive=/" /etc/zabbix/zabbix_agent2.conf
sed -i '/^ListenPort=/d' /etc/zabbix/zabbix_agent2.conf
echo "ListenPort=10052" >> /etc/zabbix/zabbix_agent2.conf

# Cấu hình Ceph Plugin & system.run
grep -q "^Plugins.Ceph.InsecureSkipVerify=true" /etc/zabbix/zabbix_agent2.conf || echo "Plugins.Ceph.InsecureSkipVerify=true" >> /etc/zabbix/zabbix_agent2.conf
grep -q "^AllowKey=system.run\\[\\*\\]" /etc/zabbix/zabbix_agent2.conf || echo "AllowKey=system.run[*]" >> /etc/zabbix/zabbix_agent2.conf

echo "[3/4] Cấu hình Script lấy Log Ceph..."
mkdir -p /etc/zabbix
touch /etc/zabbix/cephstatus.txt

cat << 'EOF' > /etc/zabbix/cephstatus.sh
#!/bin/sh
ceph health > /etc/zabbix/cephstatus.txt
date >> /etc/zabbix/cephstatus.txt
EOF

cat << 'EOF' > /etc/zabbix/docfile.sh
#!/bin/sh
value=\\$(cat /etc/zabbix/cephstatus.txt)
echo "\\$value"
EOF

chmod +x /etc/zabbix/cephstatus.txt /etc/zabbix/cephstatus.sh /etc/zabbix/docfile.sh

# Thêm vào crontab
(crontab -l 2>/dev/null | grep -v "/etc/zabbix/cephstatus.sh"; echo "* * * * * /etc/zabbix/cephstatus.sh") | crontab -

echo "[4/4] Bật RESTful API cho Ceph..."
ceph mgr module enable restful 2>/dev/null

if ceph restful list-keys 2>/dev/null | grep -q "zabbix-monitor"; then
    echo "-> API Key 'zabbix-monitor' đã tồn tại! Bỏ qua việc khởi tạo lại chứng chỉ."
else
    echo "-> Đang khởi tạo User và tạo SSL Cert mới..."
    ceph restful create-key zabbix-monitor 2>/dev/null
    ceph restful create-self-signed-cert 2>/dev/null
    ceph restful restart
fi

# Khởi động dịch vụ
systemctl restart zabbix-agent2
systemctl enable zabbix-agent2

# Kiểm tra Port 10052
sleep 2
echo "========================================="
if ss -lnt | grep -q ":10052 "; then
    echo "[OK] Zabbix Agent 2 đang hoạt động ổn định trên Port 10052."
else
    echo "[LỖI] Zabbix Agent 2 chưa lắng nghe trên Port 10052! Hãy check: systemctl status zabbix-agent2"
fi

echo "========================================="
echo "CAI DAT HOAN TAT!"
echo "API Key cua ban la:"
ceph restful list-keys
echo "========================================="
echo "Hay copy chuoi UUID tren va nhap vao giao dien Zabbix Web."
\`\`\`
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z/i } });
    if (post) {
        post.content = marked.parse(markdownContent);
        
        // Fix HTML entities
        let newContent = post.content;
        newContent = newContent.replace(/&amp;/g, "&");
        newContent = newContent.replace(/&lt;/g, "<");
        newContent = newContent.replace(/&gt;/g, ">");
        
        post.content = newContent;
        await post.save();
        console.log("Post updated successfully! Script is now smarter with skip checks and port 10052.");
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
