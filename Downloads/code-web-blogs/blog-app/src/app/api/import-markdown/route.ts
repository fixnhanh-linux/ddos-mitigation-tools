import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Category from "@/models/Category";
import matter from "gray-matter";
import { marked } from "marked";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user || (user.role !== "admin" && user.role !== "super-admin" && user.role !== "author")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename, content } = await req.json();
    if (!content) {
      return NextResponse.json({ error: "Nội dung file trống" }, { status: 400 });
    }

    // Phân tích Frontmatter (YAML metadata ở đầu file)
    const { data: meta, content: markdownBody } = matter(content);

    // Cấu hình marked custom renderer để hỗ trợ highlight dòng lệnh
    const renderer = new marked.Renderer();
    const originalCodeRenderer = renderer.code.bind(renderer);
    
    renderer.code = function(codeInfo) {
      let infostring = codeInfo.lang || '';
      const match = infostring.match(/^(\w+)(?:\s+\{([^}]+)\})?/);
      
      const lang = match ? match[1] : '';
      const highlightLines = match && match[2] ? match[2] : '';
      
      // Xoá phần {1,2} đi để highlight.js không bị lỗi khi nhận diện class name
      codeInfo.lang = lang;
      
      let html = originalCodeRenderer(codeInfo);
      
      // Inject thuộc tính vào pre tag
      if (highlightLines) {
        html = html.replace('<pre>', `<pre data-highlight-lines="${highlightLines}">`);
      }
      
      return html;
    };
    
    marked.use({ renderer });

    // Chuyển đổi Markdown sang HTML
    const htmlContent = marked.parse(markdownBody);

    // Lấy thông tin từ meta hoặc sinh tự động
    const title = meta.title || filename.replace(/\.md$/, "");
    const slug = meta.slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const excerpt = meta.excerpt || markdownBody.substring(0, 150).replace(/[\r\n]+/g, ' ') + '...';
    const tags = meta.tags ? (Array.isArray(meta.tags) ? meta.tags : meta.tags.split(",").map((t: string) => t.trim())) : [];
    const coverImage = meta.coverImage || "";

    await connectDB();

    // Xử lý Category
    let categoryId = null;
    if (meta.category) {
      const catSlug = meta.category.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      let cat = await Category.findOne({ $or: [{ slug: catSlug }, { name: meta.category }] });
      if (!cat) {
        cat = await Category.create({ name: meta.category, slug: catSlug, description: `Tự động tạo cho: ${meta.category}` });
      }
      categoryId = cat._id;
    }

    // Cập nhật hoặc tạo mới
    let post = await Post.findOne({ slug });

    if (post) {
      // Đảm bảo tác giả chỉ được sửa bài của mình (trừ admin)
      if (post.author.toString() !== user.id && user.role === "author") {
        return NextResponse.json({ error: "Bạn không có quyền sửa bài viết này" }, { status: 403 });
      }

      post.title = title;
      post.content = htmlContent as string;
      post.excerpt = excerpt;
      if (categoryId) post.category = categoryId;
      if (tags.length > 0) post.tags = tags;
      if (coverImage) post.coverImage = coverImage;
      
      await post.save();
      return NextResponse.json({ message: "Cập nhật bài viết thành công", slug: post.slug });
    } else {
      post = await Post.create({
        title,
        slug,
        content: htmlContent as string,
        excerpt,
        author: user.id,
        category: categoryId,
        tags,
        coverImage,
        status: "draft", // Mặc định lưu nháp để review lại trên web
      });
      return NextResponse.json({ message: "Nhập bài viết mới thành công (Lưu nháp)", slug: post.slug });
    }
  } catch (error: any) {
    console.error("Import Markdown Error:", error);
    return NextResponse.json({ error: "Lỗi server: " + error.message }, { status: 500 });
  }
}
