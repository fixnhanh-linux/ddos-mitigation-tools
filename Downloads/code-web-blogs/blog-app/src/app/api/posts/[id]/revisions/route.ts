import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import PostRevision from "@/models/PostRevision";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch revisions for this specific post
    const revisions = await PostRevision.find({ postId: id })
      .sort({ createdAt: -1 })
      .populate("author", "name email");

    return NextResponse.json(revisions);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch revisions" }, { status: 500 });
  }
}
