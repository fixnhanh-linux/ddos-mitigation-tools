import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session?.user as any)?.role;
    if (userRole === "author" || userRole === "user") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status, rejectionReason } = await req.json();

    if (!["published", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    post.status = status;
    if (status === "rejected") {
      post.rejectionReason = rejectionReason;
    } else {
      post.rejectionReason = "";
      if (!post.publishedAt) {
         post.publishedAt = new Date();
      }
    }

    await post.save();

    return NextResponse.json({ message: "Post updated", post }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
