import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Comment from "@/models/Comment";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    await connectDB();
    
    // body.status can be 'approved', 'spam', 'pending'
    if (!body.status) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    const updated = await Comment.findByIdAndUpdate(
      resolvedParams.id,
      { status: body.status },
      { new: true }
    );
    
    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    await logAction({
      req,
      userId: (session?.user as any)?.id,
      userName: session?.user?.name || "Admin",
      action: `Thay đổi trạng thái bình luận thành: ${body.status}`,
      type: "edit",
      details: { commentId: updated._id, status: body.status }
    });
    
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    
    const deleted = await Comment.findByIdAndDelete(resolvedParams.id);
    if (!deleted) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    await logAction({
      req,
      userId: (session?.user as any)?.id,
      userName: session?.user?.name || "Admin",
      action: `Xóa bình luận của khách: '${deleted.authorName}'`,
      type: "delete",
      details: { commentId: resolvedParams.id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
