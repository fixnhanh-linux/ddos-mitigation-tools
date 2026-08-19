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
# Next.js là gì? Vì sao nó đang dần thay thế ReactJS truyền thống?

Nếu bạn là một lập trình viên Frontend, chắc hẳn bạn đã quá quen thuộc với **ReactJS** - thư viện JavaScript phổ biến nhất thế giới do Facebook tạo ra. Trong nhiều năm, \`create-react-app\` (CRA) là tiêu chuẩn vàng để xây dựng các ứng dụng web (Single Page Application - SPA).

Tuy nhiên, ReactJS truyền thống lại mắc phải hai điểm yếu "chí mạng": **Tốc độ tải trang lần đầu (Initial Load)** và **Khả năng SEO (Tối ưu hóa công cụ tìm kiếm)**. Và đó chính là lý do **Next.js** ra đời!

---

## 1. Vấn đề của ReactJS truyền thống (Client-Side Rendering)

Khi bạn xây dựng một trang web bằng React thuần túy, phương thức render mặc định là **Client-Side Rendering (CSR)**. 

Hãy hình dung quá trình này:
1. Trình duyệt của người dùng gửi yêu cầu đến Server.
2. Server trả về một file HTML gần như **trống rỗng** (chỉ có thẻ \`<div id="root"></div>\`) kèm theo một file JavaScript cực kỳ nặng.
3. Trình duyệt phải tải toàn bộ cục JavaScript đó về, sau đó mới bắt đầu "vẽ" ra giao diện trên máy tính/điện thoại của người dùng.

**Hậu quả:**
- Người dùng dùng mạng yếu (3G) sẽ phải nhìn màn hình trắng xóa trong nhiều giây.
- **Bot của Google (Googlebot)** khi vào web của bạn cũng chỉ thấy một trang HTML trắng tinh. Google sẽ "lười" chạy file JS để đọc nội dung, dẫn đến việc trang web của bạn bị rớt hạng SEO thê thảm.

## 2. Next.js giải quyết vấn đề như thế nào?

Next.js là một Framework được xây dựng *dựa trên* React. Nó mang đến sức mạnh của **Server-Side Rendering (SSR)** và **Static Site Generation (SSG)**.

Thay vì bắt trình duyệt của người dùng phải làm việc vất vả, Next.js đẩy phần việc "vẽ" giao diện lên Server.

1. **Với SSR (Server-Side Rendering):** Khi có người truy cập, Server của Next.js sẽ tức tốc render sẵn React Code thành một trang HTML hoàn chỉnh có đầy đủ nội dung, sau đó mới gửi về cho trình duyệt. Lúc này, người dùng (và cả Googlebot) sẽ thấy ngay lập tức toàn bộ nội dung mà không cần phải chờ đợi tải file JS nặng nề nào.
2. **Với SSG (Static Site Generation):** Lợi hại hơn nữa, Next.js có thể "chụp ảnh" sẵn tất cả các trang web thành các file HTML tĩnh ngay từ lúc bạn Build Code (Deploy). Tốc độ tải trang lúc này nhanh như tên lửa vì Server chỉ việc quăng file HTML ra mà không cần tính toán gì thêm. Phù hợp tuyệt đối cho Blog, Landing Page.

## 3. Những tính năng "Ăn tiền" khác của Next.js

Ngoài việc cứu rỗi SEO, Next.js còn cung cấp những công cụ mà mọi Developer đều ao ước:

- **File-based Routing:** Tạm biệt \`react-router-dom\` phức tạp. Trong Next.js, bạn chỉ cần tạo file \`about.js\` trong thư mục \`pages\` (hoặc \`app\`), bùm! Bạn tự động có ngay đường dẫn \`/about\` trên website.
- **Image Optimization:** Thẻ \`<Image>\` của Next.js tự động nén ảnh, chuyển sang định dạng WebP, và Lazy-load ảnh mà không cần cài thêm thư viện nào.
- **Tích hợp API Routes:** Bạn có thể viết code Backend (kết nối Database, xử lý Logic) ngay bên trong dự án Next.js mà không cần phải chạy thêm một Server Express.js riêng biệt nào nữa (Full-stack Framework).

## 4. Bao giờ thì KHÔNG NÊN dùng Next.js?

Dù tuyệt vời là vậy, nhưng bạn vẫn nên dùng React thuần túy nếu:
- Bạn làm phần mềm quản lý nội bộ (Dashboard, Admin Panel) chỉ yêu cầu nhân viên đăng nhập mới xài được. Những web này không cần SEO, và việc bắt Server xử lý SSR sẽ gây lãng phí tài nguyên.
- Bạn cần tích hợp dự án React vào một hệ thống Backend có sẵn (Java, PHP, Ruby) mà không muốn chạy thêm Node.js server.

## Kết luận

Chính cha đẻ của React là đội ngũ React Team gần đây cũng đã khuyên các lập trình viên ngừng sử dụng \`create-react-app\` và chuyển sang sử dụng Framework như Next.js hoặc Remix. Next.js không phải là đối thủ của React, nó chính là **tương lai của React**!
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
      title: "Next.js là gì? Vì sao nó đang dần thay thế ReactJS truyền thống?",
      slug: "nextjs-la-gi-so-sanh-reactjs-" + Date.now(),
      content: htmlContent,
      excerpt: "Bạn là một Frontend Developer và luôn trung thành với ReactJS? Hãy tìm hiểu lý do tại sao Next.js lại ra đời và cách nó giải quyết triệt để vấn đề SEO và tốc độ tải trang mà React mắc phải.",
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
