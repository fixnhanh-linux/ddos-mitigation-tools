import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";
import Post from "@/models/Post";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    await connectDB();
    
    // Check slug uniqueness
    if (body.slug) {
      const existing = await Category.findOne({ slug: body.slug, _id: { $ne: resolvedParams.id } });
      if (existing) {
        return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 400 });
      }
    }

    const updated = await Category.findByIdAndUpdate(resolvedParams.id, body, { new: true });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    
    // Check if category has posts
    const postCount = await Post.countDocuments({ category: resolvedParams.id });
    if (postCount > 0) {
      return NextResponse.json({ error: "Không thể xóa chuyên mục đang có bài viết" }, { status: 400 });
    }

    await Category.findByIdAndDelete(resolvedParams.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
