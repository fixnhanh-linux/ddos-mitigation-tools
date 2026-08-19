const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const htmlContent = `
<p>Dưới đây là bài hướng dẫn chi tiết về cách quét và diệt virus, malware, cũng như rootkit trên hệ điều hành Linux. Mặc dù Linux được đánh giá là an toàn hơn Windows, nhưng các máy chủ Linux (đặc biệt là web server) vẫn thường là mục tiêu của các phần mềm độc hại.</p>

<hr>

<h2>1. Quét Virus với ClamAV</h2>
<p><strong>ClamAV</strong> là phần mềm diệt virus mã nguồn mở phổ biến nhất trên Linux, đặc biệt hữu ích khi dùng để quét các tệp tải lên máy chủ web hoặc hệ thống mail.</p>

<h3>Cài đặt ClamAV</h3>
<ul>
<li><strong>Trên Ubuntu/Debian:</strong>
<pre><code class="language-bash">sudo apt update
sudo apt install clamav clamav-daemon</code></pre></li>
<li><strong>Trên CentOS/RHEL/AlmaLinux:</strong>
<pre><code class="language-bash">sudo yum install epel-release
sudo yum install clamav clamav-update</code></pre></li>
</ul>

<h3>Cập nhật cơ sở dữ liệu virus</h3>
<p>Trước khi quét, bạn cần cập nhật mẫu virus mới nhất:</p>
<pre><code class="language-bash">sudo systemctl stop clamav-freshclam  # Dừng service tự động cập nhật nếu đang chạy
sudo freshclam                        # Chạy cập nhật thủ công
sudo systemctl start clamav-freshclam # Bật lại service</code></pre>

<h3>Cách sử dụng ClamAV (Lệnh <code>clamscan</code>)</h3>
<ul>
<li><strong>Quét một thư mục cụ thể (VD: /var/www/html):</strong>
<pre><code class="language-bash">clamscan -r /var/www/html</code></pre></li>
<li><strong>Quét và chỉ in ra các tệp bị nhiễm (ẩn các tệp an toàn):</strong>
<pre><code class="language-bash">clamscan -r -i /var/www/html</code></pre></li>
<li><strong>Quét và TỰ ĐỘNG XÓA các tệp bị nhiễm virus (Cảnh báo: Hãy cẩn thận khi dùng lệnh này):</strong>
<pre><code class="language-bash">clamscan -r --remove /home/user/Downloads</code></pre></li>
<li><strong>Quét và di chuyển các tệp bị nhiễm vào một thư mục cách ly:</strong>
<pre><code class="language-bash">mkdir -p /root/quarantine
clamscan -r --move=/root/quarantine /var/www</code></pre></li>
</ul>

<hr>

<h2>2. Quét Malware với Linux Malware Detect (LMD - Maldet)</h2>
<p><strong>LMD</strong> cực kỳ hiệu quả trong việc phát hiện các loại malware nhắm vào web server (như web shell, PHP shell, mã độc spam). Nó thường được dùng kết hợp chung với engine của ClamAV để tăng tốc độ.</p>

<h3>Cài đặt LMD</h3>
<pre><code class="language-bash">cd /tmp
wget http://www.rfxn.com/downloads/maldetect-current.tar.gz
tar -xzvf maldetect-current.tar.gz
cd maldetect-*
sudo ./install.sh</code></pre>

<h3>Cập nhật LMD</h3>
<pre><code class="language-bash">sudo maldet -u  # Cập nhật phiên bản LMD
sudo maldet -d  # Cập nhật cơ sở dữ liệu mẫu malware</code></pre>

<h3>Cách sử dụng Maldet</h3>
<ul>
<li><strong>Quét một thư mục (VD: Quét toàn bộ source code của website):</strong>
<pre><code class="language-bash">sudo maldet -a /var/www/html</code></pre></li>
<li><strong>Xem báo cáo kết quả quét:</strong>
<pre><code class="language-bash">sudo maldet --report SCAN_ID</code></pre></li>
<li><strong>Đưa các file nhiễm mã độc vào khu vực cách ly (Quarantine):</strong>
<pre><code class="language-bash">sudo maldet -q SCAN_ID</code></pre></li>
</ul>

<hr>

<h2>3. Quét Rootkit với Rkhunter và Chkrootkit</h2>
<p><strong>Rootkit</strong> là loại phần mềm độc hại ngụy trang thành các tiến trình hệ thống để qua mặt quản trị viên.</p>

<h3>Cài đặt</h3>
<ul>
<li><strong>Trên Ubuntu/Debian:</strong>
<pre><code class="language-bash">sudo apt install rkhunter chkrootkit</code></pre></li>
<li><strong>Trên CentOS/RHEL:</strong>
<pre><code class="language-bash">sudo yum install rkhunter chkrootkit</code></pre></li>
</ul>

<h3>Sử dụng Chkrootkit</h3>
<p>Chỉ cần chạy lệnh sau, công cụ sẽ quét các dấu hiệu của rootkit:</p>
<pre><code class="language-bash">sudo chkrootkit</code></pre>

<h3>Sử dụng Rkhunter (Rootkit Hunter)</h3>
<p>Trước khi quét lần đầu, hãy cập nhật thuộc tính file hệ thống:</p>
<pre><code class="language-bash">sudo rkhunter --update
sudo rkhunter --propupd</code></pre>
<p>Thực hiện quét toàn hệ thống:</p>
<pre><code class="language-bash">sudo rkhunter -c --sk</code></pre>
<p>Bạn có thể xem lại log chi tiết tại: <code>/var/log/rkhunter.log</code>.</p>

<hr>

<h2>4. Kiểm tra thủ công các dấu hiệu bất thường</h2>
<p>Ngoài việc dùng tool, bạn nên kiểm tra hệ thống thủ công nếu nghi ngờ có mã độc:</p>

<ol>
<li><strong>Kiểm tra các tiến trình đang ngốn CPU/RAM bất thường:</strong>
<pre><code class="language-bash">top -c
htop</code></pre></li>
<li><strong>Kiểm tra các kết nối mạng khả nghi:</strong>
<pre><code class="language-bash">netstat -tulpn</code></pre></li>
<li><strong>Kiểm tra lịch trình tự động Crontab của tất cả các user:</strong>
<pre><code class="language-bash">for user in $(cat /etc/passwd | cut -f1 -d:); do echo $user; crontab -u $user -l; done</code></pre></li>
<li><strong>Kiểm tra các user lạ có quyền root:</strong>
<pre><code class="language-bash">grep -v -E "^#" /etc/passwd | awk -F: '$3 == 0 { print $1}'</code></pre></li>
</ol>
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    // Find the post and update it
    const result = await Post.updateMany(
      { title: "Hướng dẫn toàn diện: Scan Virus, Malware và Rootkit trên Linux" },
      { $set: { content: htmlContent } }
    );
    
    console.log("Update result:", result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
