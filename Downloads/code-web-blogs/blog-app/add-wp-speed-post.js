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
# Hướng dẫn tối ưu hóa tốc độ tải trang (Speed Optimization) cho Website WordPress

Tốc độ tải trang chậm không chỉ làm mất trải nghiệm người dùng mà còn ảnh hưởng trực tiếp đến thứ hạng SEO trên Google. Hầu hết người dùng sẽ rời bỏ website của bạn nếu trang web mất hơn 3 giây để tải. 

Dưới đây là các kỹ thuật thực chiến giúp tăng tốc website WordPress của bạn một cách rõ rệt.

---

## 1. Lựa chọn Hosting / VPS chất lượng cao
Nền tảng máy chủ đóng vai trò then chốt. Dù bạn tối ưu code tốt đến đâu nhưng máy chủ chậm thì mọi nỗ lực đều vô ích.
- **Tránh dùng Shared Hosting giá rẻ:** Nếu web có lượng truy cập lớn, hãy ưu tiên dùng Cloud VPS.
- **Sử dụng ổ cứng NVMe / SSD:** Tốc độ đọc ghi nhanh gấp nhiều lần ổ HDD cũ.
- **Web Server:** Ưu tiên sử dụng Litespeed hoặc Nginx kết hợp với PHP-FPM thay vì Apache truyền thống.

## 2. Sử dụng Plugin Caching (Tạo bộ nhớ đệm)
Caching giúp website lưu lại sẵn bản HTML của trang, thay vì mỗi lần có người truy cập thì hệ thống lại bắt PHP và Database xử lý lại từ đầu.
- **LiteSpeed Cache (Khuyên dùng nếu dùng Litespeed Web Server):** Plugin cache miễn phí và mạnh mẽ nhất hiện nay.
- **WP Rocket:** Plugin trả phí vô cùng hiệu quả, cấu hình cực kỳ đơn giản.
- **W3 Total Cache / WP Super Cache:** Các lựa chọn miễn phí nếu bạn sử dụng Nginx/Apache.

## 3. Tối ưu hóa Hình ảnh
Hình ảnh thường chiếm đến 70-80% dung lượng của một trang web. Giảm dung lượng ảnh là cách nhanh nhất để cải thiện tốc độ.
- **Sử dụng định dạng WebP:** Chuẩn hình ảnh mới của Google có dung lượng nhẹ hơn JPEG/PNG rất nhiều. Có thể dùng plugin như *Converter for Media* hoặc tính năng tích hợp sẵn của *LiteSpeed Cache*.
- **Lazy Load (Tải trễ):** Chỉ tải hình ảnh khi người dùng cuộn chuột đến.
- **Nén ảnh trước khi tải lên:** Sử dụng các công cụ như TinyPNG hoặc Squoosh để nén ảnh trước khi upload vào Media Library.

## 4. Tối ưu hóa Database (Cơ sở dữ liệu)
Sau một thời gian sử dụng, database sẽ bị phình to bởi rác: các bản nháp tự động (auto-drafts), bình luận spam, transient options...
- Sử dụng plugin **WP-Optimize** hoặc tính năng Database của **WP Rocket** để dọn dẹp hàng tuần.
- **Xóa bớt Plugin không sử dụng:** Mỗi plugin đều sinh ra rất nhiều bảng (table) rác, đồng thời chèn thêm file CSS/JS vào làm chậm frontend.

## 5. Sử dụng Mạng phân phối nội dung (CDN)
CDN (Content Delivery Network) giúp lưu trữ các file tĩnh (ảnh, css, js) của web ở nhiều máy chủ trên toàn cầu.
- Khi người dùng ở Mỹ truy cập, họ sẽ tải dữ liệu từ máy chủ CDN tại Mỹ thay vì máy chủ gốc ở Việt Nam, giúp giảm thiểu độ trễ vật lý.
- **Cloudflare:** Dịch vụ CDN miễn phí và phổ biến nhất, tích hợp sẵn tường lửa (WAF) chống DDoS.

## 6. Giảm thiểu CSS / JavaScript / HTML (Minification)
Minify là quá trình xóa các khoảng trắng, dấu xuống dòng và comment trong code để giảm dung lượng file. 
Bạn có thể dễ dàng bật tính năng **Minify CSS/JS** trong bất kỳ plugin Caching nào (như WP Rocket, LiteSpeed Cache, Autoptimize).

> [!TIP]
> Trước khi tiến hành tối ưu, hãy sử dụng **Google PageSpeed Insights** hoặc **GTmetrix** để chấm điểm và kiểm tra tốc độ hiện tại. Sau khi áp dụng các bước trên, hãy đo lại để thấy sự khác biệt!
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
      title: "Hướng dẫn tối ưu hóa tốc độ tải trang (Speed Optimization) cho Website WordPress",
      slug: "toi-uu-hoa-toc-do-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Tốc độ tải trang chậm không chỉ làm mất trải nghiệm người dùng mà còn ảnh hưởng trực tiếp đến thứ hạng SEO trên Google. Cùng khám phá 6 kỹ thuật cốt lõi giúp tăng tốc website WordPress.",
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
