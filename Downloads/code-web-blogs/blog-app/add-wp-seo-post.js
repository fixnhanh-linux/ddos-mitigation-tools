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
# Hướng dẫn tối ưu SEO On-page cho bài viết WordPress để lên TOP Google

Viết một bài blog hấp dẫn là rất tốt, nhưng nếu Google không thể "hiểu" được bài viết của bạn nói về chủ đề gì, thì sẽ rất khó để bạn có thể lên top và tiếp cận độc giả. Đó là lúc **SEO On-page** phát huy sức mạnh.

Dưới đây là các tiêu chuẩn cốt lõi bạn cần nắm vững khi đăng bài lên WordPress để thân thiện với các bộ máy tìm kiếm.

---

## 1. Tối ưu Tiêu đề (Title) và Đường dẫn tĩnh (URL/Slug)

Đây là 2 yếu tố đầu tiên mà cả người dùng lẫn Google nhìn vào.

- **Tiêu đề (H1):** Phải chứa từ khóa chính (Keyword), tốt nhất là nằm ở đầu câu. Tiêu đề nên có độ dài từ 50-60 ký tự để không bị cắt xén trên trang kết quả tìm kiếm (SERP).
- **Đường dẫn tĩnh (URL):** URL cần phải ngắn gọn, dễ đọc và chứa từ khóa chính (Không dấu, nối nhau bằng dấu gạch ngang \`-\`).
  - *Ví dụ xấu:* \`domain.com/?p=123\` hoặc \`domain.com/toi-uu-seo-on-page-tren-website-wordpress-de-len-top\`
  - *Ví dụ tốt:* \`domain.com/toi-uu-seo-on-page-wordpress\`
  > Bạn có thể cấu hình tự động hiển thị URL đẹp tại **Settings > Permalinks** và chọn **Post name**.

## 2. Tối ưu Thẻ Heading (H2, H3, H4)

Đừng viết một bài văn dài thò lò không có ngắt nghỉ. Hãy chia nhỏ bài viết thành các đoạn văn ngắn, phân cách bằng các thẻ Heading.

- **Thẻ H1:** Chỉ dùng duy nhất **1 lần** cho tiêu đề bài viết. (WordPress thường tự động gán Tiêu đề vào thẻ H1).
- **Thẻ H2:** Dùng cho các ý chính trong bài. Nên chèn từ khóa chính hoặc từ khóa LSI (từ khóa liên quan) vào một số thẻ H2.
- **Thẻ H3, H4:** Dùng cho các ý phụ nằm trong H2.

## 3. Tối ưu Hình ảnh (Image SEO)

Google không thể "nhìn" thấy hình ảnh như con người, nó chỉ "đọc" được ảnh thông qua văn bản thay thế (Alt text).

- **Tên file ảnh:** Đổi tên file trước khi upload chứa từ khóa, không dấu. (Vd: \`toi-uu-seo-hinh-anh.jpg\`).
- **Thẻ Alt (Văn bản thay thế):** Bắt buộc phải có thẻ Alt mô tả nội dung bức ảnh, nên chứa từ khóa một cách tự nhiên.
- **Kích thước & Dung lượng:** Nén ảnh dưới 100KB và ưu tiên dùng định dạng **WebP** để tăng tốc độ tải trang (Yếu tố cực kỳ quan trọng cho SEO hiện nay).

## 4. Tối ưu Mật độ từ khóa và Thẻ Meta Description

- **Mật độ từ khóa (Keyword Density):** Từ khóa chính nên xuất hiện tự nhiên trong bài viết, tần suất khoảng 1% - 2% (trong 100 từ thì lặp lại khoảng 1-2 lần). Bắt buộc phải có ở Đoạn mở bài (trong 100 từ đầu tiên) và Đoạn kết luận.
- **Thẻ Meta Description:** Đây là đoạn mô tả ngắn hiển thị bên dưới tiêu đề trên Google. Hãy viết một đoạn mô tả khoảng 150-155 ký tự, hấp dẫn, kích thích người dùng click (CTR) và phải chứa từ khóa chính.

## 5. Xây dựng Liên kết (Internal & External Links)

- **Liên kết nội bộ (Internal Link):** Gắn link dẫn đến các bài viết khác có liên quan trên CÙNG website của bạn. Điều này giúp giữ chân người dùng ở lại web lâu hơn (giảm Bounce Rate) và giúp Google Bot dễ dàng thu thập dữ liệu (crawl) các trang khác.
- **Liên kết ngoài (External Link):** Chèn 1-2 link trỏ đến các website uy tín (như Wikipedia, trang tin chính phủ...) để tăng độ tin cậy cho bài viết của bạn.

> [!TIP]
> **Sử dụng Plugin hỗ trợ:** Để kiểm soát các tiêu chí trên dễ dàng hơn, bạn nên cài đặt một trong hai plugin SEO hàng đầu là **Yoast SEO** hoặc **Rank Math SEO**. Chúng sẽ cung cấp bảng chấm điểm xanh/đỏ giúp bạn dễ dàng theo dõi bài viết đã chuẩn SEO hay chưa!
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
      title: "Hướng dẫn tối ưu SEO On-page cho bài viết WordPress để lên TOP Google",
      slug: "toi-uu-seo-on-page-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Viết nội dung hay chưa đủ, bạn cần phải tối ưu SEO On-page để Google có thể dễ dàng đọc hiểu và xếp hạng bài viết của bạn. Khám phá ngay các kỹ thuật SEO thực chiến từ cơ bản đến nâng cao.",
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
