import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Bookmark from "@/models/Bookmark";
import Post from "@/models/Post";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Fetch user's bookmarks
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    
    // Ensure Post model is registered
    Post.countDocuments();

    const bookmarks = await Bookmark.find({ user: (session.user as any).id })
      .populate("post", "title slug coverImage excerpt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(bookmarks);
  } catch (error) {
    console.error("[GET Bookmarks] Error:", error);
    return NextResponse.json({ message: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST: Toggle bookmark
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

    const existingBookmark = await Bookmark.findOne({ user: userId, post: postId });

    if (existingBookmark) {
      // Remove bookmark
      await Bookmark.deleteOne({ _id: existingBookmark._id });
      return NextResponse.json({ message: "Đã bỏ lưu bài viết", bookmarked: false });
    } else {
      // Add bookmark
      await Bookmark.create({ user: userId, post: postId });
      return NextResponse.json({ message: "Đã lưu bài viết", bookmarked: true });
    }
  } catch (error) {
    console.error("[POST Bookmarks] Error:", error);
    return NextResponse.json({ message: "Lỗi hệ thống" }, { status: 500 });
  }
}
