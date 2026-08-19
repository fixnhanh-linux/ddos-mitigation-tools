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

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const markdownContent = `
# Hướng dẫn Docker cơ bản cho người mới bắt đầu: Đóng gói và chạy mọi ứng dụng

Bạn đã bao giờ gặp tình cảnh "Code chạy rất mượt trên máy tính của tôi, nhưng khi đưa lên máy chủ (Server) thì lại lỗi tùm lum" chưa? Nguyên nhân thường do sự khác biệt về hệ điều hành, phiên bản phần mềm (Node.js, PHP, Python) giữa các máy.

**Docker** chính là vị cứu tinh của các lập trình viên hiện đại. Nó giúp bạn "đóng gói" mã nguồn cùng toàn bộ môi trường cần thiết thành một khối thống nhất, mang đi đâu chạy cũng giống hệt nhau!

---

## 1. Docker là gì? Các khái niệm cốt lõi

Hãy tưởng tượng bạn chuyển nhà. Thay vì khuân vác từng món đồ, bạn cho tất cả vào một thùng Container tiêu chuẩn. Đơn vị vận chuyển chỉ cần bê cái Container đó lên tàu, lên xe tải một cách dễ dàng. Docker cũng hoạt động y hệt như vậy với phần mềm.

- **Image (Bản thiết kế):** Là một gói tĩnh chứa mã nguồn, thư viện, môi trường (ví dụ: một Image chứa Ubuntu + Node.js 18 + Code của bạn). Image mang tính chất chỉ đọc (Read-only).
- **Container (Thùng chứa):** Là một thực thể (Instance) đang chạy của một Image. Từ 1 Image bạn có thể chạy ra hàng trăm Container khác nhau độc lập hoàn toàn.
- **Dockerfile:** Là một file kịch bản (Script) chứa các dòng lệnh hướng dẫn Docker cách tự động xây dựng nên một Image.
- **Docker Hub:** Là một cái "chợ" (Registry) chứa hàng triệu Image đã được xây dựng sẵn bởi cộng đồng (MySQL, Nginx, WordPress, v.v.).

## 2. So sánh Docker Container và Máy ảo (Virtual Machine - VM)

Trước khi có Docker, người ta thường dùng Máy Ảo (VMware, VirtualBox).
- **Máy Ảo (VM):** Mỗi máy ảo cần chạy một Hệ điều hành (OS) riêng biệt. Rất nặng nề, tốn RAM và khởi động mất vài phút.
- **Docker Container:** Các Container xài chung cái nhân (Kernel) của Hệ điều hành máy chủ. Cực kỳ nhẹ, tốn ít RAM và khởi động chỉ mất **vài mili-giây**!

## 3. Cài đặt Docker nhanh trên Linux (Ubuntu)

Mở Terminal và chạy tuần tự các lệnh sau:
\`\`\`bash
# Cập nhật hệ thống
sudo apt update

# Tải và chạy script cài đặt tự động của Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cấp quyền cho user hiện tại chạy Docker không cần sudo
sudo usermod -aG docker $USER
\`\`\`
*(Sau khi chạy lệnh usermod, hãy đăng xuất và đăng nhập lại).*

## 4. Các lệnh Docker cơ bản nhất định phải thuộc

Dưới đây là "vũ khí" hằng ngày của một DevOps:

- \`docker pull <tên_image>\`: Tải một Image từ Docker Hub về máy. *(Ví dụ: \`docker pull nginx\`)*
- \`docker images\`: Xem danh sách các Image đang có trên máy.
- \`docker run -d -p 8080:80 <tên_image>\`: Tạo và chạy một Container từ Image. 
  - \`-d\`: Chạy ngầm (Detach).
  - \`-p 8080:80\`: Nối cổng 8080 của máy chủ vào cổng 80 của Container.
- \`docker ps\`: Xem danh sách các Container **đang chạy**.
- \`docker ps -a\`: Xem danh sách **toàn bộ** Container (cả cái đã tắt).
- \`docker stop <container_id>\`: Tắt một Container.
- \`docker rm <container_id>\`: Xóa một Container.
- \`docker rmi <image_id>\`: Xóa một Image.

## 5. Thực hành: Chạy một Web Server Nginx trong 1 nốt nhạc

Thử nghiệm sức mạnh của Docker ngay bây giờ. Hãy gõ lệnh sau:
\`\`\`bash
docker run --name web-cua-toi -d -p 8888:80 nginx
\`\`\`

Chỉ mất vài giây để Docker tải Image Nginx về và chạy. Bây giờ, hãy mở trình duyệt lên và gõ: \`http://localhost:8888\` (hoặc IP_Máy_chủ:8888). Bạn sẽ thấy màn hình **"Welcome to nginx!"**. Quá tuyệt vời phải không?

## Kết luận

Docker đã làm thay đổi hoàn toàn cục diện của ngành phát triển phần mềm (Software Development). Nắm vững Docker là bước đệm đầu tiên và bắt buộc nếu bạn muốn tiến xa hơn vào thế giới DevOps, CI/CD và Kubernetes!
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

    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hướng dẫn Docker cơ bản cho người mới bắt đầu: Đóng gói và chạy mọi ứng dụng",
      slug: "huong-dan-docker-co-ban-cho-nguoi-moi-" + Date.now(),
      content: htmlContent,
      excerpt: "Bạn từng đau đầu vì code chạy ngon trên máy mình nhưng lại lỗi khi lên server? Docker sinh ra để giải quyết triệt để vấn đề đó. Khám phá ngay các khái niệm cơ bản về Container, Image và cách viết Dockerfile.",
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
