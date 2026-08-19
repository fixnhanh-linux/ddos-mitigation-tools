import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const resolvedParams = await params;
    const postId = resolvedParams.id;

    await connectDB();
    
    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Kiểm tra xem user đã like chưa
    const hasLiked = post.likes && post.likes.includes(userId);

    if (hasLiked) {
      // Unlike
      post.likes = post.likes.filter((id: any) => id.toString() !== userId);
    } else {
      // Like
      if (!post.likes) post.likes = [];
      post.likes.push(userId);
    }

    await post.save();

    return NextResponse.json({ 
      success: true, 
      likesCount: post.likes.length,
      hasLiked: !hasLiked // Trạng thái mới
    }, { status: 200 });

  } catch (error: any) {
    console.error("Like Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
