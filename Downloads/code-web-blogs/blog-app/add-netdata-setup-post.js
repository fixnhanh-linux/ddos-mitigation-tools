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
# Hướng dẫn cài đặt Netdata trên Ubuntu/CentOS: Giám sát máy chủ thời gian thực (Real-time) chỉ với 1 lệnh

Khi nhắc đến giám sát máy chủ, chúng ta thường nghĩ ngay đến Zabbix hay Prometheus. Tuy nhiên, việc cài đặt và cấu hình Dashboard cho chúng tốn khá nhiều thời gian. 

Nếu bạn đang tìm kiếm một công cụ:
- **Hiển thị thông số tính bằng giây (Real-time 1s).**
- **Giao diện Dashboard đẹp mê ly có sẵn ngay lập tức.**
- **Cài đặt chỉ với duy nhất 1 dòng lệnh trên mọi HĐH (Ubuntu, CentOS, Debian).**

Thì xin chúc mừng, **Netdata** chính là chân ái của bạn!

---

## 1. Netdata là gì? Vì sao nó đặc biệt?

Netdata là một Agent giám sát siêu nhẹ được thiết kế để chạy trực tiếp trên các hệ điều hành Linux (Ubuntu, CentOS). 

Sự khác biệt lớn nhất của Netdata so với các công cụ khác nằm ở mức độ **chi tiết đến rùng mình**: Nó tự động phát hiện hàng trăm dịch vụ đang chạy trên máy chủ (Nginx, MySQL, Docker, Redis...) và tự động vẽ ra hàng ngàn biểu đồ theo dõi với độ trễ chỉ 1 giây! 

Bạn không cần phải viết bất cứ một dòng cấu hình YAML hay SQL nào để tạo Dashboard cả.

## 2. Cài đặt Netdata trên Ubuntu / CentOS

Dù bạn đang xài **Ubuntu 20.04/22.04** hay **CentOS 7/8/9**, lệnh cài đặt Netdata đều giống hệt nhau. Bạn chỉ cần mở Terminal (SSH) lên và gõ:

\`\`\`bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
\`\`\`

**Quá trình cài đặt diễn ra như sau:**
1. Script sẽ tự động kiểm tra xem bạn đang xài HĐH nào (Ubuntu hay CentOS).
2. Tự động cài các gói phụ thuộc (Dependencies) cần thiết bằng \`apt\` hoặc \`yum\`.
3. Tự động biên dịch và khởi chạy dịch vụ Netdata.
4. Xuyên suốt quá trình, nó có thể hiện thông báo hỏi bạn có đồng ý cài đặt không, hãy bấm phím \`Y\` (Yes) và \`Enter\`.

Chỉ tốn khoảng 1-2 phút, Netdata sẽ được cài đặt xong.

## 3. Quản lý dịch vụ Netdata

Sau khi cài đặt, Netdata sẽ tự động chạy ngầm. Bạn có thể kiểm tra trạng thái bằng lệnh:
\`\`\`bash
systemctl status netdata
\`\`\`

Để cấu hình cho Netdata luôn tự khởi động cùng máy chủ khi bị reboot:
\`\`\`bash
systemctl enable netdata
\`\`\`

## 4. Tận hưởng siêu Dashboard

Mặc định, Netdata mở cổng **19999**. Bạn hãy mở trình duyệt web lên và truy cập vào:
\`\`\`text
http://IP_MAY_CHU_CUA_BAN:19999
\`\`\`

*Lưu ý: Nếu bạn dùng CentOS hoặc VPS của AWS/Google Cloud, hãy nhớ mở port 19999 trên Firewall (Tường lửa) nhé!*
Ví dụ mở port trên CentOS (Firewalld):
\`\`\`bash
firewall-cmd --zone=public --add-port=19999/tcp --permanent
firewall-cmd --reload
\`\`\`
Hoặc trên Ubuntu (UFW):
\`\`\`bash
ufw allow 19999/tcp
\`\`\`

Ngay khi truy cập, bạn sẽ bị choáng ngợp bởi một trang Dashboard khổng lồ. Mọi thông số từ CPU, RAM, Disk I/O, Network Bandwidth, Firewall packets, cho đến nhiệt độ của CPU đều nhảy múa liên tục từng giây một.

## 5. Cấu hình bảo mật (Tránh bị dòm ngó)

Nhược điểm chí mạng của Netdata là mặc định nó **không có mật khẩu**. Bất cứ ai biết IP của bạn và gõ thêm \`:19999\` đều xem được tình trạng máy chủ.

Để bảo mật, chúng ta sẽ giới hạn chỉ cho phép truy cập từ **localhost** và dùng Nginx làm màng lọc bảo vệ (Reverse Proxy).

**Bước 1:** Mở file cấu hình của Netdata:
\`\`\`bash
nano /etc/netdata/netdata.conf
\`\`\`
Tìm mục \`[web]\` và thêm dòng \`bind to = 127.0.0.1\`:
\`\`\`ini
[web]
    bind to = 127.0.0.1
\`\`\`
Lưu lại và khởi động lại Netdata: \`systemctl restart netdata\`

**Bước 2:** Cài đặt \`htpasswd\` để tạo mật khẩu đăng nhập:
\`\`\`bash
# Trên Ubuntu:
apt install apache2-utils
# Trên CentOS:
yum install httpd-tools

# Tạo tài khoản "admin" và mật khẩu
htpasswd -c /etc/nginx/.htpasswd admin
\`\`\`

**Bước 3:** Cấu hình Nginx proxy:
\`\`\`nginx
server {
    listen 80;
    server_name netdata.domain.com;

    location / {
        proxy_pass http://127.0.0.1:19999;
        
        # Bật xác thực mật khẩu
        auth_basic "Protected Netdata";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
\`\`\`
Khởi động lại Nginx (\`systemctl reload nginx\`). Giờ đây khi truy cập vào \`netdata.domain.com\`, trình duyệt sẽ hiển thị khung bắt buộc nhập tài khoản và mật khẩu!

## Kết luận

Với Netdata, bạn không cần phải là một Master DevOps để có được hệ thống giám sát cực xịn. Việc cài đặt chung một Script cho cả Ubuntu và CentOS khiến nó trở thành công cụ "cứu cánh" hoàn hảo để chẩn đoán nguyên nhân gây giật lag server một cách nhanh chóng nhất!
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
      title: "Hướng dẫn cài đặt Netdata trên Ubuntu/CentOS: Giám sát máy chủ thời gian thực (Real-time) chỉ với 1 lệnh",
      slug: "cai-dat-netdata-ubuntu-centos-giam-sat-" + Date.now(),
      content: htmlContent,
      excerpt: "Bỏ qua các bước cấu hình YAML hay SQL phức tạp. Cùng tìm hiểu cách cài đặt Netdata - Công cụ giám sát máy chủ Real-time siêu chi tiết trên Linux (Ubuntu/CentOS) chỉ với duy nhất 1 dòng lệnh.",
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
