import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import PostRevision from "@/models/PostRevision";

export async function POST(req: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    // RBAC: If author, can only delete own posts
    const query: any = { _id: { $in: ids } };
    if (userRole === "author") {
      query.author = userId;
    }

    // First find which posts we are actually allowed to delete (for deleting revisions later)
    const postsToDelete = await Post.find(query).select("_id");
    const validIds = postsToDelete.map(p => p._id);

    if (validIds.length === 0) {
      return NextResponse.json({ error: "No posts to delete or unauthorized" }, { status: 403 });
    }

    // Delete the posts
    await Post.deleteMany({ _id: { $in: validIds } });
    
    // Delete their revisions
    await PostRevision.deleteMany({ postId: { $in: validIds } });

    return NextResponse.json({ success: true, deletedCount: validIds.length });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Failed to delete posts" }, { status: 500 });
  }
}
