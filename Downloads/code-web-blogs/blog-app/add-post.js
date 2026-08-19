const mongoose = require("mongoose");

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

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const content = `
Dưới đây là bài hướng dẫn chi tiết về cách quét và diệt virus, malware, cũng như rootkit trên hệ điều hành Linux. Mặc dù Linux được đánh giá là an toàn hơn Windows, nhưng các máy chủ Linux (đặc biệt là web server) vẫn thường là mục tiêu của các phần mềm độc hại.

---

## 1. Quét Virus với ClamAV
**ClamAV** là phần mềm diệt virus mã nguồn mở phổ biến nhất trên Linux, đặc biệt hữu ích khi dùng để quét các tệp tải lên máy chủ web hoặc hệ thống mail.

### Cài đặt ClamAV
- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt update
  sudo apt install clamav clamav-daemon
  \`\`\`
- **Trên CentOS/RHEL/AlmaLinux:**
  \`\`\`bash
  sudo yum install epel-release
  sudo yum install clamav clamav-update
  \`\`\`

### Cập nhật cơ sở dữ liệu virus
Trước khi quét, bạn cần cập nhật mẫu virus mới nhất:
\`\`\`bash
sudo systemctl stop clamav-freshclam  # Dừng service tự động cập nhật nếu đang chạy
sudo freshclam                        # Chạy cập nhật thủ công
sudo systemctl start clamav-freshclam # Bật lại service
\`\`\`

### Cách sử dụng ClamAV (Lệnh \`clamscan\`)
- **Quét một thư mục cụ thể (VD: /var/www/html):**
  \`\`\`bash
  clamscan -r /var/www/html
  \`\`\`
- **Quét và chỉ in ra các tệp bị nhiễm (ẩn các tệp an toàn):**
  \`\`\`bash
  clamscan -r -i /var/www/html
  \`\`\`
- **Quét và TỰ ĐỘNG XÓA các tệp bị nhiễm virus (Cảnh báo: Hãy cẩn thận khi dùng lệnh này):**
  \`\`\`bash
  clamscan -r --remove /home/user/Downloads
  \`\`\`
- **Quét và di chuyển các tệp bị nhiễm vào một thư mục cách ly:**
  \`\`\`bash
  mkdir -p /root/quarantine
  clamscan -r --move=/root/quarantine /var/www
  \`\`\`

---

## 2. Quét Malware với Linux Malware Detect (LMD - Maldet)
**LMD** cực kỳ hiệu quả trong việc phát hiện các loại malware nhắm vào web server (như web shell, PHP shell, mã độc spam). Nó thường được dùng kết hợp chung với engine của ClamAV để tăng tốc độ.

### Cài đặt LMD
\`\`\`bash
cd /tmp
wget http://www.rfxn.com/downloads/maldetect-current.tar.gz
tar -xzvf maldetect-current.tar.gz
cd maldetect-*
sudo ./install.sh
\`\`\`

### Cập nhật LMD
\`\`\`bash
sudo maldet -u  # Cập nhật phiên bản LMD
sudo maldet -d  # Cập nhật cơ sở dữ liệu mẫu malware
\`\`\`

### Cách sử dụng Maldet
- **Quét một thư mục (VD: Quét toàn bộ source code của website):**
  \`\`\`bash
  sudo maldet -a /var/www/html
  \`\`\`
- **Xem báo cáo kết quả quét:**
  \`\`\`bash
  sudo maldet --report SCAN_ID
  \`\`\`
- **Đưa các file nhiễm mã độc vào khu vực cách ly (Quarantine):**
  \`\`\`bash
  sudo maldet -q SCAN_ID
  \`\`\`

---

## 3. Quét Rootkit với Rkhunter và Chkrootkit
**Rootkit** là loại phần mềm độc hại ngụy trang thành các tiến trình hệ thống để qua mặt quản trị viên.

### Cài đặt
- **Trên Ubuntu/Debian:**
  \`\`\`bash
  sudo apt install rkhunter chkrootkit
  \`\`\`
- **Trên CentOS/RHEL:**
  \`\`\`bash
  sudo yum install rkhunter chkrootkit
  \`\`\`

### Sử dụng Chkrootkit
Chỉ cần chạy lệnh sau, công cụ sẽ quét các dấu hiệu của rootkit:
\`\`\`bash
sudo chkrootkit
\`\`\`

### Sử dụng Rkhunter (Rootkit Hunter)
Trước khi quét lần đầu, hãy cập nhật thuộc tính file hệ thống:
\`\`\`bash
sudo rkhunter --update
sudo rkhunter --propupd
\`\`\`
Thực hiện quét toàn hệ thống:
\`\`\`bash
sudo rkhunter -c --sk
\`\`\`
Bạn có thể xem lại log chi tiết tại: \`/var/log/rkhunter.log\`.

---

## 4. Kiểm tra thủ công các dấu hiệu bất thường
Ngoài việc dùng tool, bạn nên kiểm tra hệ thống thủ công nếu nghi ngờ có mã độc:

1. **Kiểm tra các tiến trình đang ngốn CPU/RAM bất thường:**
   \`\`\`bash
   top -c
   htop
   \`\`\`
2. **Kiểm tra các kết nối mạng khả nghi:**
   \`\`\`bash
   netstat -tulpn
   \`\`\`
3. **Kiểm tra lịch trình tự động Crontab của tất cả các user:**
   \`\`\`bash
   for user in $(cat /etc/passwd | cut -f1 -d:); do echo $user; crontab -u $user -l; done
   \`\`\`
4. **Kiểm tra các user lạ có quyền root:**
   \`\`\`bash
   grep -v -E "^#" /etc/passwd | awk -F: '$3 == 0 { print $1}'
   \`\`\`
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    let user = await User.findOne({});
    let authorId;
    if (user) {
      authorId = user._id;
    } else {
      console.log("No user found. Creating dummy user...");
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    const post = new Post({
      title: "Hướng dẫn toàn diện: Scan Virus, Malware và Rootkit trên Linux",
      slug: "huong-dan-toan-dien-scan-virus-malware-va-rootkit-tren-linux-" + Date.now(),
      content: content,
      excerpt: "Hướng dẫn chi tiết về cách quét và diệt virus, malware, cũng như rootkit trên hệ điều hành Linux sử dụng ClamAV, LMD, Rkhunter...",
      author: authorId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("Post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
