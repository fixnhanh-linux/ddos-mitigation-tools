const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const additionalContent = `

---

## 5. Quà tặng: Script Tự động hóa Cài đặt 100%

Nếu bạn có nhiều cụm Proxmox/Ceph hoặc đơn giản là muốn tiết kiệm thời gian, không muốn phải copy-paste từng lệnh ở trên, tôi đã chuẩn bị sẵn một Bash Script tự động hóa mọi thứ. 

Script này sẽ yêu cầu bạn nhập IP Zabbix Server, sau đó nó sẽ **tự động cài đặt Agent 2, tự động sửa file cấu hình, tự động tạo các script ghi log, đặt lịch crontab và kích hoạt Ceph RESTful API**.

### Hướng dẫn sử dụng:
Trên máy chủ Proxmox (Node đang chạy Active Manager), bạn hãy tạo một file bash (ví dụ \`setup_ceph_zabbix.sh\`), dán đoạn code dưới đây vào, cấp quyền thực thi (\`chmod +x\`) và chạy nó!

\`\`\`bash
#!/bin/bash
echo "=== Zabbix Ceph Monitor Auto-Setup Script ==="
read -p "Nhập IP Zabbix Server hoặc Zabbix Proxy: " ZABBIX_SERVER_IP

echo "[1/4] Cài đặt Zabbix Agent 2..."
apt update && apt install zabbix-agent2 -y

echo "[2/4] Cấu hình Zabbix Agent 2..."
# Sao lưu cấu hình cũ
cp /etc/zabbix/zabbix_agent2.conf /etc/zabbix/zabbix_agent2.conf.bak

# Cập nhật cấu hình
sed -i "s/^Server=.*/Server=$ZABBIX_SERVER_IP/" /etc/zabbix/zabbix_agent2.conf
sed -i "s/^ServerActive=.*/ServerActive=/" /etc/zabbix/zabbix_agent2.conf

# Kiểm tra và thêm cấu hình Ceph & system.run nếu chưa có
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
ceph restful create-key zabbix-monitor 2>/dev/null
ceph restful create-self-signed-cert 2>/dev/null
ceph restful restart

systemctl restart zabbix-agent2
systemctl enable zabbix-agent2

echo "========================================="
echo "CAI DAT HOAN TAT!"
echo "API Key cua ban la:"
ceph restful list-keys
echo "========================================="
echo "Hay copy chuoi UUID (cua zabbix-monitor) tren va nhap vao Macros tren giao dien Zabbix Web nhe!"
\`\`\`

Sau khi chạy xong script này, việc duy nhất bạn cần làm là lên giao diện Zabbix Web, gán Template và điền thông số Macros như hướng dẫn ở phần 4! Thật tuyệt vời phải không nào?
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const post = await Post.findOne({ title: { $regex: /Hướng dẫn Monitor Ceph trên Proxmox bằng Zabbix Full A-Z/i } });
    if (post) {
        post.content = post.content + additionalContent;
        await post.save();
        console.log("Post updated successfully! Added bash script.");
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
