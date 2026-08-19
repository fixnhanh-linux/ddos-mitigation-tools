import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import History from "@/models/History";
import Post from "@/models/Post";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    Post.countDocuments(); // Register Post model

    const history = await History.find({ user: (session.user as any).id })
      .populate("post", "title slug coverImage excerpt createdAt")
      .sort({ viewedAt: -1 })
      .limit(20) // Only get latest 20 items
      .lean();

    return NextResponse.json(history);
  } catch (error) {
    console.error("[GET History] Error:", error);
    return NextResponse.json({ message: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ message: "Thiếu ID bài viết" }, { status: 400 });
    }

    await connectDB();
    const userId = (session.user as any).id;

    // Upsert logic: if exists, update viewedAt to now; if not, create
    await History.findOneAndUpdate(
      { user: userId, post: postId },
      { $set: { viewedAt: new Date() } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ message: "Đã cập nhật lịch sử đọc" });
  } catch (error) {
    console.error("[POST History] Error:", error);
    return NextResponse.json({ message: "Lỗi hệ thống" }, { status: 500 });
  }
}
