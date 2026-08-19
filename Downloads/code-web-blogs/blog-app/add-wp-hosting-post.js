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
# Hướng dẫn chọn mua Hosting / VPS phù hợp nhất cho Website WordPress từ A-Z

Một ngôi nhà đẹp cần một nền móng vững chắc, và một website WordPress mạnh mẽ cũng cần một máy chủ (Hosting/VPS) ổn định. Đứng giữa hàng trăm nhà cung cấp trên thị trường với vô vàn thông số kỹ thuật (RAM, CPU, Bandwidth, Inodes...), làm sao để chọn được bến đỗ tốt nhất?

Dưới đây là cẩm nang từ A-Z giúp bạn chọn mua Hosting / VPS chuẩn xác nhất.

---

## 1. Nên chọn Shared Hosting hay VPS?

Đây là câu hỏi kinh điển nhất của người mới làm web.

- **Shared Hosting:** Là dịch vụ chia sẻ tài nguyên. Hàng trăm website sẽ cùng nằm trên một máy chủ vật lý và xài chung CPU, RAM. 
  - *Ưu điểm:* Rẻ, dễ sử dụng (có sẵn cPanel/DirectAdmin), không cần biết kỹ thuật.
  - *Nhược điểm:* Tốc độ bị ảnh hưởng bởi các website "hàng xóm", độ bảo mật thấp hơn.
  - *Phù hợp cho:* Web mới tạo, blog cá nhân, web công ty ít lượt truy cập (< 1000 traffic/ngày).

- **VPS (Máy chủ riêng ảo):** Bạn được chia một phần tài nguyên độc lập. Không ai xâm phạm được CPU và RAM của bạn.
  - *Ưu điểm:* Cực kỳ nhanh, ổn định, bảo mật cao, toàn quyền cấu hình.
  - *Nhược điểm:* Đòi hỏi kiến thức quản trị mạng (SysAdmin) để cài đặt và tối ưu (dùng script hoặc CyberPanel, aaPanel).
  - *Phù hợp cho:* Web bán hàng (WooCommerce), báo điện tử, web có traffic vừa và lớn.

## 2. Các thông số kỹ thuật cần đặc biệt chú ý

Dù mua Hosting hay VPS, bạn cũng cần chú ý đến các thông số sau:

1. **Web Server (Máy chủ web):**
   Với WordPress, **LiteSpeed** là số 1 vì nó hỗ trợ plugin LiteSpeed Cache cực kỳ mạnh mẽ. Đứng thứ hai là **Nginx**. Hãy cố gắng tránh Apache nếu bạn muốn website load siêu tốc.
2. **Loại ổ cứng:**
   Bắt buộc phải là ổ **SSD** hoặc cao cấp hơn là **NVMe**. Tuyệt đối không thuê hosting dùng ổ HDD truyền thống, tốc độ đọc ghi (I/O) sẽ rất thảm họa.
3. **Dung lượng (Storage):**
   Một website WordPress cơ bản (theme + vài plugin + bài viết) chỉ tốn khoảng 500MB. Tuy nhiên nếu bạn up nhiều ảnh, hãy chọn gói từ **2GB - 5GB** trở lên.
4. **Băng thông (Bandwidth):**
   Đây là tổng dung lượng dữ liệu truyền tải trong 1 tháng. Hiện nay đa số nhà cung cấp đều để **Unlimited (Không giới hạn)**, nhưng nếu có giới hạn, mức 50GB/tháng là đủ cho web vừa.
5. **Giới hạn Inodes (Chỉ có ở Shared Hosting):**
   Inodes là tổng số lượng file và folder trên hosting. Một hosting dù có dung lượng "Không giới hạn" nhưng Inodes chỉ cho 100,000 thì bạn cũng không thể up thêm file nếu đạt mốc đó. Khuyên dùng gói có từ **250,000 Inodes** trở lên.

## 3. Nên mua máy chủ ở Việt Nam hay Nước ngoài?

Vị trí đặt máy chủ (Datacenter) ảnh hưởng trực tiếp đến tốc độ tải trang. Nguyên tắc là: **Khách hàng của bạn ở đâu, hãy đặt máy chủ ở đó.**

- **Khách hàng ở Việt Nam:** Nên thuê Hosting tại Việt Nam (như Vietnix, Azdigi, TinoHost, v.v.). Tốc độ truy cập trong nước sẽ cực kỳ nhanh và không bị ảnh hưởng khi "đứt cáp quang biển".
- **Khách hàng quốc tế (Châu Âu, Mỹ):** Nên mua VPS ở nước ngoài như DigitalOcean, Vultr, Linode, Hetzner, AWS.
- **Khách hàng ở cả VN và Quốc tế:** Có thể mua server ở Singapore hoặc Tokyo (Nhật Bản), kết hợp thêm CDN của Cloudflare để cân bằng tốc độ.

## 4. Các yếu tố dịch vụ đi kèm không thể bỏ qua

Trước khi xuống tiền, hãy kiểm tra xem nhà cung cấp có hỗ trợ những tính năng này không:
- **Tự động sao lưu (Auto Backup):** Ít nhất là backup mỗi ngày 1 lần. Rất quan trọng khi web bị lỗi hoặc dính mã độc.
- **Miễn phí SSL:** Đảm bảo có tích hợp Let's Encrypt hoặc AutoSSL miễn phí 100%.
- **Hỗ trợ khách hàng (Support 24/7):** Website có thể sập vào lúc 2 giờ sáng. Một đội ngũ kỹ thuật phản hồi Ticket trong vòng 15 phút là một điểm cộng tuyệt đối.

## 5. Kết luận
Đừng tiếc tiền đầu tư cho Hosting/VPS vì nó là huyết mạch của website. Nếu bạn có một chút kiến thức IT, **Cloud VPS kết hợp cấu hình Nginx/LiteSpeed** luôn là lựa chọn hoàn hảo nhất mang lại hiệu năng cao với mức giá vô cùng rẻ. Chúc bạn tìm được "bến đỗ" ưng ý cho website của mình!
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
      title: "Hướng dẫn chọn mua Hosting / VPS phù hợp nhất cho Website WordPress từ A-Z",
      slug: "huong-dan-chon-mua-hosting-vps-wordpress-" + Date.now(),
      content: htmlContent,
      excerpt: "Đứng giữa hàng trăm nhà cung cấp Hosting và VPS với vô vàn thông số kỹ thuật, làm sao để chọn được một máy chủ mạnh mẽ, ổn định mà lại tối ưu chi phí cho website WordPress? Cùng tìm hiểu ngay.",
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
