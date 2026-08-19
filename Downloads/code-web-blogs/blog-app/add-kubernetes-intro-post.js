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
# Tổng quan về Kubernetes (K8s): Nó là gì và tại sao mọi công ty lớn đều dùng nó?

Ở bài viết trước, chúng ta đã làm quen với Docker. Docker rất tuyệt vời khi bạn chạy 1-2 ứng dụng (Container) trên một máy chủ duy nhất. Nhưng chuyện gì sẽ xảy ra nếu ứng dụng của bạn nổi tiếng (như Shopee, Netflix), và bạn cần chạy **10.000 Container** trải dài trên hàng trăm máy chủ khác nhau? 

Đó chính là lúc **Kubernetes** (hay còn gọi là **K8s**) xuất hiện như một "nhạc trưởng" để điều khiển toàn bộ hệ thống đó.

---

## 1. Kubernetes (K8s) là gì?

Kubernetes là một hệ thống mã nguồn mở được phát triển bởi Google vào năm 2014, dùng để **tự động hóa việc triển khai (deployment), mở rộng (scaling) và quản lý các ứng dụng dưới dạng Container**. 

Từ "Kubernetes" bắt nguồn từ tiếng Hy Lạp, có nghĩa là *Người lái tàu* (hoặc *Nhạc trưởng*). Người ta thường gọi tắt nó là **K8s** (vì giữa chữ K và chữ s có 8 chữ cái).

## 2. K8s giải quyết những bài toán "khủng" nào?

Hãy tưởng tượng bạn đang điều hành một trang thương mại điện tử vào ngày hội Sale 11/11:

- **Tự động mở rộng (Auto Scaling):** Lúc 23:59 đêm, lượng truy cập tăng vọt gấp 100 lần. K8s sẽ nhận diện CPU đang quá tải và *tự động nhân bản* số lượng Container chứa Web Server từ 5 lên 500 cái chỉ trong 2 giây. Hết Sale, nó tự động tắt bớt để tiết kiệm chi phí Server.
- **Tự chữa lành (Self-healing):** Nếu một Container bỗng nhiên bị sập (Crash) hoặc một Server bị cháy ổ cứng, K8s sẽ ngay lập tức tự động khởi chạy một Container mới trên một Server khác đang khỏe mạnh để thay thế. Người dùng sẽ không hề cảm nhận được hệ thống vừa bị lỗi.
- **Triển khai không gián đoạn (Zero-downtime Rollouts):** Khi bạn cập nhật phiên bản tính năng mới, K8s sẽ lần lượt tắt từng Container cũ và bật Container mới lên. Nhờ đó, Website của bạn không bao giờ phải treo biển "Bảo trì".

## 3. Các thuật ngữ cơ bản của Kubernetes

Để không bị bỡ ngỡ khi đọc tài liệu K8s, bạn cần nắm vững các thuật ngữ sau:

- **Cluster (Cụm):** Là toàn bộ hệ thống mạng lưới của bạn, bao gồm các Máy chủ quản lý (Control Plane) và các Máy chủ làm việc (Worker Node).
- **Node:** Là một máy chủ đơn lẻ (Vật lý hoặc VPS) nằm trong một Cluster.
- **Pod:** Đây là đơn vị nhỏ nhất trong K8s. Một Pod có thể chứa một hoặc nhiều Container. K8s không quản lý trực tiếp Container, nó quản lý Pod.
- **Deployment:** Là một bản vẽ chỉ định số lượng Pod cần chạy. Bạn bảo "Tôi muốn luôn luôn có 3 Pod chạy Nginx", K8s Deployment sẽ làm mọi cách để duy trì con số 3 đó.
- **Service:** Vì các Pod bị sập và tạo mới liên tục, địa chỉ IP của chúng sẽ thay đổi. Service là một "cửa ra vào" có IP cố định, giúp người dùng bên ngoài hoặc các Pod khác kết nối vào ứng dụng mà không cần quan tâm IP thật của Pod là gì.

## 4. Bạn có thực sự cần Kubernetes không?

K8s vô cùng mạnh mẽ, nhưng **KHÔNG PHẢI** ai cũng nên dùng nó.

**NÊN DÙNG K8S NẾU:**
- Hệ thống của bạn phục vụ hàng triệu traffic, cần mở rộng (Scale) liên tục.
- Hệ thống xây dựng theo kiến trúc **Microservices** (Chia nhỏ thành hàng trăm dịch vụ như Thanh toán, Giỏ hàng, Thông báo...).
- Công ty có đội ngũ DevOps giàu kinh nghiệm.

**KHÔNG NÊN DÙNG NẾU:**
- Bạn đang làm một Web giới thiệu công ty hoặc Blog cá nhân nhỏ gọn.
- Hệ thống là một khối thống nhất (Monolith) chạy trên 1 VPS duy nhất. (Lúc này, chỉ cần Docker + Docker Compose hoặc Cpanel/DirectAdmin là quá đủ).

## Kết luận

Kubernetes không chỉ là một công cụ, nó là **bộ não** vận hành của toàn bộ cơ sở hạ tầng đám mây (Cloud Native) hiện đại. Dù đường cong học tập (Learning curve) của K8s rất dốc và phức tạp, nhưng việc hiểu rõ cơ chế của "Nhạc trưởng" này chắc chắn sẽ đưa mức lương của một kỹ sư IT lên một tầm cao mới.
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
      title: "Tổng quan về Kubernetes (K8s): Nó là gì và tại sao mọi công ty lớn đều dùng nó?",
      slug: "tong-quan-kubernetes-k8s-la-gi-" + Date.now(),
      content: htmlContent,
      excerpt: "Nếu Docker giúp bạn đóng gói ứng dụng, thì Kubernetes giúp bạn quản lý hàng ngàn Docker container đó một cách tự động. Cùng tìm hiểu xem công nghệ đứng sau Netflix, Google và Spotify thực chất là gì.",
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
