const mongoose = require("mongoose");


const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

const CategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
});
const Category = mongoose.models.Category || mongoose.model("Category", CategorySchema);

const PostSchema = new mongoose.Schema({
  title: String,
  slug: String,
  content: String,
  excerpt: String,
  coverImage: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  published: Boolean,
  tags: [String],
  views: Number,
}, { timestamps: true });
const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    // Clear existing
    await Post.deleteMany({});
    await Category.deleteMany({});
    console.log("Cleared old posts and categories");

    // Create Categories
    const catTech = await Category.create({ name: "Công nghệ", slug: "cong-nghe" });
    const catLife = await Category.create({ name: "Đời sống", slug: "doi-song" });
    const catDesign = await Category.create({ name: "Thiết kế", slug: "thiet-ke" });

    // Create Posts
    const posts = [
      {
        title: "Tương lai của Trí tuệ Nhân tạo trong năm 2026",
        slug: "tuong-lai-cua-tri-tue-nhan-tao-2026",
        excerpt: "AI đang thay đổi cách chúng ta làm việc và sáng tạo. Hãy cùng tìm hiểu những xu hướng mới nhất trong năm 2026.",
        content: "<p>Trí tuệ nhân tạo (AI) đang phát triển với tốc độ chóng mặt. Những mô hình ngôn ngữ lớn như GPT-5 hay Claude 4 đã đạt đến khả năng suy luận đáng kinh ngạc...</p><p>Hơn bao giờ hết, AI giờ đây có thể tự động hoá hầu hết các tác vụ lập trình cơ bản, mở ra kỷ nguyên phát triển phần mềm dựa trên mô hình Agentic (đại lý thông minh).</p><h2>Tại sao lại là năm 2026?</h2><p>Đó là thời điểm mà năng lực tính toán và thuật toán đạt đến một điểm giao thoa hoàn hảo.</p>",
        coverImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1600&auto=format&fit=crop",
        category: catTech._id,
        published: true,
        views: 1205,
      },
      {
        title: "Bí quyết thiết kế UI/UX tối giản mà hiệu quả",
        slug: "bi-quyet-thiet-ke-ui-ux-toi-gian",
        excerpt: "Minimalism không chỉ là loại bỏ chi tiết thừa, mà là tập trung vào giá trị cốt lõi mang lại cho người dùng.",
        content: "<p>Thiết kế tối giản đã trở thành một tiêu chuẩn không thể thiếu trong ngành công nghiệp phần mềm...</p><h2>Quy tắc 60-30-10</h2><p>Đây là quy tắc phối màu kinh điển giúp giao diện của bạn trở nên hài hoà mà không cần suy nghĩ nhiều.</p>",
        coverImage: "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1600&auto=format&fit=crop",
        category: catDesign._id,
        published: true,
        views: 890,
      },
      {
        title: "Cân bằng giữa Công việc và Cuộc sống thời đại số",
        slug: "can-bang-cong-viec-cuoc-song",
        excerpt: "Làm thế nào để không bị cuốn vào vòng xoáy của những thông báo email và tin nhắn không hồi kết?",
        content: "<p>Sự tiện lợi của smartphone mang lại một hệ luỵ: chúng ta luôn ở trong trạng thái 'online'...</p>",
        coverImage: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=1600&auto=format&fit=crop",
        category: catLife._id,
        published: true,
        views: 450,
      },
      {
        title: "Tại sao Next.js 15 lại thay đổi cách chúng ta viết React?",
        slug: "tai-sao-nextjs-15-thay-doi-react",
        excerpt: "Khám phá sức mạnh của React Compiler, Turbopack và App Router trong phiên bản Next.js mới nhất.",
        content: "<p>Next.js 15 đánh dấu một bước ngoặt lớn với việc tích hợp sâu React 19...</p>",
        coverImage: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1600&auto=format&fit=crop",
        category: catTech._id,
        published: true,
        views: 2100,
      },
      {
        title: "Những quán cà phê yên tĩnh nhất để code cuối tuần",
        slug: "quan-ca-phe-yen-tinh-code",
        excerpt: "Tổng hợp danh sách các không gian làm việc lý tưởng với wifi mạnh và cà phê ngon dành riêng cho dân IT.",
        content: "<p>Không gian làm việc đóng vai trò rất lớn trong hiệu suất viết code của bạn...</p>",
        coverImage: "https://images.unsplash.com/photo-1525610553991-2bede1a236e2?q=80&w=1600&auto=format&fit=crop",
        category: catLife._id,
        published: true,
        views: 650,
      },
    ];

    await Post.insertMany(posts);
    console.log("Mock data inserted successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
