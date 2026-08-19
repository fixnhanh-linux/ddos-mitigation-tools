import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, title, slug, content, excerpt, category, tags, coverImage } = body;

    // 1. Xác thực API Key
    const validKey = process.env.SYNC_API_KEY || "my-secret-sync-key"; // Đặt SYNC_API_KEY trong .env
    if (apiKey !== validKey) {
      return NextResponse.json({ error: "Unauthorized: Sai API Key" }, { status: 401 });
    }

    await connectDB();

    // 2. Tìm người dùng Admin để gán làm tác giả
    const adminUser = await User.findOne({ role: { $in: ["super-admin", "admin"] } });
    if (!adminUser) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản Admin nào trong hệ thống" }, { status: 500 });
    }

    // 3. Tìm hoặc tạo Category
    let categoryId = null;
    if (category) {
      // Chuyển category thành dạng slug nếu truyền vào tên
      const catSlug = category.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      let cat = await Category.findOne({ $or: [{ slug: catSlug }, { name: category }] });
      if (!cat) {
        // Tự động tạo danh mục nếu chưa có
        cat = await Category.create({ name: category, slug: catSlug, description: `Tự động tạo cho: ${category}` });
      }
      categoryId = cat._id;
    }

    // 4. Xử lý Tags
    let tagArray: string[] = [];
    if (Array.isArray(tags)) {
      tagArray = tags;
    } else if (typeof tags === 'string') {
      tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    // 5. Cập nhật hoặc Tạo bài viết mới
    let post = await Post.findOne({ slug });

    if (post) {
      // Cập nhật
      post.title = title || post.title;
      post.content = content || post.content;
      if (excerpt) post.excerpt = excerpt;
      if (categoryId) post.category = categoryId;
      if (tagArray.length > 0) post.tags = tagArray;
      if (coverImage) post.coverImage = coverImage;
      
      // Đảm bảo cập nhật trạng thái Published
      post.status = "published";
      post.published = true;
      if (!post.publishedAt) post.publishedAt = new Date();
      
      await post.save();
      return NextResponse.json({ message: "Cập nhật bài viết thành công", postSlug: post.slug });
    } else {
      // Tạo mới
      if (!title || !slug || !content) {
        return NextResponse.json({ error: "Thiếu các trường bắt buộc (title, slug, content) cho bài viết mới" }, { status: 400 });
      }

      post = await Post.create({
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 150).replace(/<[^>]+>/g, '') + '...',
        author: adminUser._id,
        category: categoryId,
        tags: tagArray,
        coverImage: coverImage || "",
        status: "published",
        published: true,
        publishedAt: new Date()
      });
      return NextResponse.json({ message: "Tạo bài viết mới thành công", postSlug: post.slug });
    }
  } catch (error: any) {
    console.error("Remote Sync Error:", error);
    return NextResponse.json({ error: "Lỗi server: " + error.message }, { status: 500 });
  }
}
