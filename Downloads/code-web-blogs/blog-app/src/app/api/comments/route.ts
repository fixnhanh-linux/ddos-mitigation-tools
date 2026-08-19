import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Comment from "@/models/Comment";
import User from "@/models/User";
import Setting from "@/models/Setting";
import { sendEmailNotification } from "@/lib/mailer";

// Lấy danh sách bình luận (chỉ lấy những bình luận đã duyệt)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "Thiếu ID bài viết" }, { status: 400 });
    }

    await connectDB();
    const comments = await Comment.find({ post: postId, status: 'approved' })
      .sort({ createdAt: 1 }) // Sắp xếp cũ nhất lên trước (chuẩn comment thread)
      .lean();

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}

// Gửi bình luận mới
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { postId, authorName, authorEmail, content, parentId } = body;

    if (!postId || !authorName || !authorEmail || !content) {
      return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin" }, { status: 400 });
    }

    await connectDB();
    
    const newComment = await Comment.create({
      post: postId,
      authorName,
      authorEmail,
      content,
      parentId: parentId || null,
      status: 'pending' // Chờ duyệt
    });

    // Gamification: Cộng 2 điểm cho User (dựa theo email)
    await User.findOneAndUpdate({ email: authorEmail }, { $inc: { points: 2 } });

    const st = await Setting.findOne({ key: 'site_title' }).lean();
    const siteTitle = (st?.value as string) || "Tên Website";

    // Tuỳ chọn: Gửi email cho admin (nếu muốn)
    sendEmailNotification(
      "admin@tenwebsite.com", // Thay bằng email admin của bạn
      `[${siteTitle}] Có bình luận mới từ ${authorName}`,
      `<p><strong>${authorName}</strong> vừa bình luận bài viết <strong>${postId}</strong>:</p><p>${content}</p>`,
      siteTitle
    ).catch(console.error);

    return NextResponse.json({ message: "Bình luận đã được gửi và đang chờ duyệt!", comment: newComment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
