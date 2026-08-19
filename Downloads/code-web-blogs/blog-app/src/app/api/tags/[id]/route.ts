import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Tag from "@/models/Tag";
import Post from "@/models/Post";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    await connectDB();
    
    if (body.slug) {
      const existing = await Tag.findOne({ slug: body.slug, _id: { $ne: resolvedParams.id } });
      if (existing) {
        return NextResponse.json({ error: "Slug thẻ đã tồn tại" }, { status: 400 });
      }
    }

    const updated = await Tag.findByIdAndUpdate(resolvedParams.id, body, { new: true });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    
    // Xóa thẻ
    await Tag.findByIdAndDelete(resolvedParams.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
