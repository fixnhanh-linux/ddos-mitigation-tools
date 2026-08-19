const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: String,
  slug: String,
  content: String,
}, { strict: false });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

const content = `
# Hướng dẫn chi tiết kiểm tra kết nối Server bị chậm (Lag)

Tình trạng kết nối đến server bị chậm, chập chờn (lag) là một trong những sự cố phổ biến nhất mà các quản trị viên hệ thống (SysAdmin) hoặc lập trình viên thường xuyên gặp phải. Để xác định chính xác nguyên nhân do mạng, do máy chủ hay do ứng dụng, bạn cần thực hiện theo các bước chẩn đoán dưới đây.

---

## 1. Kiểm tra Ping và Packet Loss

Công cụ đơn giản và đầu tiên cần nghĩ đến là \`ping\`. Lệnh này giúp kiểm tra xem server có đang phản hồi không, độ trễ (latency/ping) là bao nhiêu và có bị mất gói tin (packet loss) hay không.

**Cách thực hiện (Trên Windows/Linux/macOS):**
\`\`\`bash
ping <ip-server-hoac-domain>
\`\`\`

**Phân tích kết quả:**
- **Time (Độ trễ):** Dưới 50ms (trong nước) hoặc dưới 200ms (quốc tế) thường là mức có thể chấp nhận được. Nếu time quá cao hoặc nhảy liên tục (lúc 30ms lúc 500ms) -> mạng đang chập chờn.
- **Packet Loss (Tỉ lệ mất gói):** Nếu có hiện tượng \`Request timed out\` dẫn đến Packet Loss > 0%, chứng tỏ kết nối mạng đang không ổn định.

## 2. Kiểm tra đường đi của gói tin (Traceroute / MTR)

Nếu Ping cho thấy độ trễ cao, bạn cần biết chính xác gói tin bị kẹt ở "nút" (hop) mạng nào trên đường truyền từ máy tính của bạn tới server.

**Sử dụng Traceroute:**
- Trên Windows: \`tracert <ip-server>\`
- Trên Linux/macOS: \`traceroute <ip-server>\`

**Sử dụng MTR (Khuyên dùng):**
MTR kết hợp cả \`ping\` và \`traceroute\`, cập nhật theo thời gian thực giúp bạn dễ dàng nhìn ra nút mạng nào đang gây rớt gói tin.
- Cài đặt và chạy trên Linux: \`mtr <ip-server>\`
- Trên Windows: Bạn có thể tải phần mềm **WinMTR**.

*Lưu ý: Nếu ping bị drop ở các hop đầu tiên, lỗi do mạng nội bộ hoặc nhà mạng của bạn. Nếu drop ở các hop cuối cùng, lỗi do nhà cung cấp máy chủ.*

## 3. Kiểm tra phân giải tên miền (DNS)

Đôi khi server không chậm, nhưng quá trình tra cứu tên miền sang địa chỉ IP bị chậm, làm cho website load lâu ở giai đoạn đầu.

**Cách kiểm tra:**
\`\`\`bash
nslookup <domain-cua-ban>
# Hoặc trên Linux/macOS:
dig <domain-cua-ban>
\`\`\`
Nếu thời gian phản hồi từ máy chủ DNS lâu (Query time cao), bạn có thể cân nhắc chuyển sang sử dụng DNS của Google (\`8.8.8.8\`) hoặc Cloudflare (\`1.1.1.1\`).

## 4. Kiểm tra cổng dịch vụ (Port) và kết nối TCP

Có thể ping rất tốt nhưng ứng dụng vẫn chậm, bạn cần kiểm tra xem cổng dịch vụ (Web 80/443, SSH 22, Database 3306...) có phản hồi nhanh không.

**Sử dụng Telnet hoặc Netcat (nc):**
\`\`\`bash
# Sử dụng Netcat (Linux/macOS)
nc -vz <ip-server> <port>

# Hoặc dùng curl để đo thời gian phản hồi của web server:
curl -o /dev/null -s -w "Thời gian phản hồi: %{time_total} giây\\n" https://domain-cua-ban.com
\`\`\`

**Trên Windows (PowerShell):**
\`\`\`powershell
Test-NetConnection -ComputerName <ip-server> -Port <port>
\`\`\`

## 5. Kiểm tra tài nguyên nội bộ của Server

Nếu mạng hoàn toàn bình thường, nguyên nhân gây chậm chắc chắn nằm ở bản thân Server (quá tải). Bạn hãy SSH vào server và dùng các lệnh sau:

- **Kiểm tra CPU và RAM:** Chạy lệnh \`top\` hoặc \`htop\`. Chú ý thông số \`load average\` (nếu cao hơn số lượng core CPU tức là server đang quá tải) và dung lượng RAM trống/swap.
- **Kiểm tra Disk I/O (Tốc độ đọc ghi ổ cứng):** Lệnh \`iostat -x 1\` hoặc \`iotop\` xem có tiến trình nào đang chiếm dụng hết tốc độ đọc ghi của ổ cứng không.

## 6. Kiểm tra băng thông (Bandwidth) với iPerf3

Nếu bạn cần truyền tải file lớn nhưng tốc độ rất chậm, bạn có thể đo đạc băng thông thực tế giữa máy tính và server bằng \`iperf3\`.

- **Trên Server:** Chạy \`iperf3 -s\` (để làm máy chủ nhận test).
- **Trên máy cá nhân:** Chạy \`iperf3 -c <ip-server>\` để tiến hành đo băng thông thực tế.

---
**Tóm tắt quy trình xử lý:**
1. Mạng có thông không? Trễ bao nhiêu? (Ping)
2. Chậm ở đoạn nào? (MTR/Traceroute)
3. Domain phân giải có nhanh không? (DNS)
4. Port có mở không? (Telnet/curl)
5. Server có bị "treo" CPU/RAM/Disk không? (htop/iostat)

> [!TIP]
> Việc lưu lại kết quả của lệnh MTR và thông số htop sẽ rất hữu ích nếu bạn cần gửi ticket nhờ đội ngũ kỹ thuật của nhà cung cấp Server (Hosting/VPS) hỗ trợ!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    const post = await Post.findOne({ title: "Hướng dẫn chi tiết kiểm tra và khắc phục kết nối Server bị chậm (Lag)" });
    
    if (post) {
      post.content = marked.parse(content);
      await post.save();
      console.log("Post content successfully updated to HTML!");
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
