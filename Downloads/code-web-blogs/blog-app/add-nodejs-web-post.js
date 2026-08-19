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
# Hướng dẫn xây dựng ứng dụng Web cơ bản với Node.js, Express và MongoDB

Nếu bạn đã quen với Javascript ở phía Frontend (trình duyệt) và muốn lấn sân sang làm Backend, thì **Node.js** chính là sự lựa chọn tuyệt vời nhất. Node.js cho phép bạn chạy mã Javascript trực tiếp trên máy chủ.

Trong bài viết này, chúng ta sẽ cùng nhau xây dựng một ứng dụng web cơ bản (RESTful API) sử dụng **Express.js** (Framework phổ biến nhất của Node.js) và cơ sở dữ liệu **MongoDB**.

---

## 1. Chuẩn bị môi trường

Trước khi bắt đầu, bạn cần cài đặt 2 phần mềm sau vào máy tính:
1. [Node.js](https://nodejs.org/): Tải và cài đặt phiên bản LTS (Long Term Support).
2. [MongoDB](https://www.mongodb.com/try/download/community): Nếu không muốn cài đặt trên máy, bạn có thể dùng MongoDB Atlas (Cloud) miễn phí.

Mở Terminal (hoặc Command Prompt) và kiểm tra xem Node.js đã được cài đặt chưa:
\`\`\`bash
node -v
npm -v
\`\`\`

## 2. Khởi tạo dự án (Init Project)

Tạo một thư mục mới cho dự án của bạn và di chuyển vào đó:
\`\`\`bash
mkdir my-nodejs-app
cd my-nodejs-app
\`\`\`

Khởi tạo file \`package.json\` (chứa thông tin dự án và các thư viện phụ thuộc):
\`\`\`bash
npm init -y
\`\`\`

## 3. Cài đặt các thư viện cần thiết

Chúng ta cần cài đặt 3 thư viện chính:
- **express:** Framework để tạo Server và Routing.
- **mongoose:** Thư viện giúp Node.js kết nối và giao tiếp với MongoDB dễ dàng.
- **nodemon (Cài đặt dạng dev):** Giúp tự động khởi động lại server mỗi khi bạn sửa code.

Chạy lệnh sau:
\`\`\`bash
npm install express mongoose
npm install --save-dev nodemon
\`\`\`

Mở file \`package.json\`, thêm dòng script sau vào phần \`"scripts"\`:
\`\`\`json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
\`\`\`

## 4. Viết code cho Server (index.js)

Tạo một file có tên là \`index.js\` ở thư mục gốc và dán đoạn code sau vào:

\`\`\`javascript
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// Middleware giúp đọc dữ liệu JSON từ Client gửi lên
app.use(express.json());

// Kết nối với MongoDB (Thay đổi chuỗi kết nối nếu bạn dùng MongoDB Atlas)
mongoose.connect('mongodb://localhost:27017/my_database')
  .then(() => console.log('✅ Đã kết nối thành công với MongoDB'))
  .catch((err) => console.error('❌ Lỗi kết nối MongoDB:', err));

// Tạo một Schema và Model cho User
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number
});
const User = mongoose.model('User', UserSchema);

// --- TẠO CÁC API ROUTE (CRUD) ---

// 1. [GET] Lấy danh sách tất cả User
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// 2. [POST] Thêm một User mới
app.post('/api/users', async (req, res) => {
  const newUser = new User(req.body);
  await newUser.save();
  res.status(201).json({ message: "Đã thêm User thành công!", user: newUser });
});

// Khởi động Server
app.listen(PORT, () => {
  console.log(\`🚀 Server đang chạy tại http://localhost:\${PORT}\`);
});
\`\`\`

## 5. Chạy thử ứng dụng

Bây giờ, hãy mở Terminal và chạy lệnh:
\`\`\`bash
npm run dev
\`\`\`
Bạn sẽ thấy thông báo:
> 🚀 Server đang chạy tại http://localhost:3000  
> ✅ Đã kết nối thành công với MongoDB

**Kiểm tra API:**
Bạn có thể dùng phần mềm [Postman](https://www.postman.com/) hoặc tiện ích mở rộng Thunder Client trên VS Code để test:
1. Gửi request **POST** đến \`http://localhost:3000/api/users\` với body JSON:
\`\`\`json
{
  "name": "Nguyễn Văn A",
  "email": "nva@gmail.com",
  "age": 25
}
\`\`\`
2. Gửi request **GET** đến \`http://localhost:3000/api/users\` để xem kết quả.

## Kết luận
Xin chúc mừng! Chỉ với vài chục dòng code đơn giản, bạn đã tự tay xây dựng được một Web Server hoàn chỉnh có khả năng nhận dữ liệu, kết nối và lưu trữ vào Database. Từ nền tảng này, bạn có thể ghép nối với ReactJS, VueJS hoặc Next.js để làm nên những website chuyên nghiệp!
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
      title: "Hướng dẫn xây dựng ứng dụng Web cơ bản với Node.js, Express và MongoDB",
      slug: "huong-dan-build-web-nodejs-express-mongodb-" + Date.now(),
      content: htmlContent,
      excerpt: "Node.js đang là một trong những công nghệ backend phổ biến nhất thế giới. Cùng tìm hiểu cách khởi tạo một dự án Web hoàn chỉnh với Express framework và kết nối cơ sở dữ liệu MongoDB chỉ trong 10 phút.",
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
