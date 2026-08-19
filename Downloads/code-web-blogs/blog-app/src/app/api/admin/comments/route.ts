import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Comment from "@/models/Comment";
import Post from "@/models/Post"; // needed for populate

import User from "@/models/User";

export async function GET() {
  try {
    await connectDB();
    
    // Fetch all comments, sort by newest, populate post title
    const comments = await Comment.find()
      .populate({ path: 'post', select: 'title' })
      .sort({ createdAt: -1 })
      .lean();

    // Lấy danh sách email từ bình luận
    const emails = comments.map(c => c.authorEmail);
    // Tìm các user có email trong danh sách
    const users = await User.find({ email: { $in: emails } }).select('email avatar').lean();
    
    // Tạo map mapping email -> avatar
    const avatarMap = users.reduce((acc: any, user: any) => {
      acc[user.email] = user.avatar;
      return acc;
    }, {});

    // Gắn avatar vào bình luận
    const commentsWithAvatar = comments.map(c => ({
      ...c,
      authorAvatar: avatarMap[c.authorEmail] || null
    }));

    return NextResponse.json(commentsWithAvatar);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments for admin" }, { status: 500 });
  }
}
