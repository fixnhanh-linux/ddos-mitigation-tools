import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Comment from "@/models/Comment";
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

    // Fetch user's comments and populate post data
    const comments = await Comment.find({ user: (session.user as any).id })
      .populate("post", "title slug")
      .sort({ createdAt: -1 })
      .lean();

    // Filter out comments where the post was deleted (post is null)
    const validComments = comments.filter((c: any) => c.post != null);

    return NextResponse.json(validComments);
  } catch (error) {
    console.error("[GET Comments] Error:", error);
    return NextResponse.json({ message: "Lỗi hệ thống" }, { status: 500 });
  }
}
