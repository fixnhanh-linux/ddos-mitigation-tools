import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";
import Post from "@/models/Post";

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find().lean();
    
    // Đếm số bài viết cho mỗi chuyên mục
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat: any) => {
        const count = await Post.countDocuments({ category: cat._id });
        return { ...cat, count };
      })
    );

    return NextResponse.json(categoriesWithCount);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    
    // Check slug
    const existing = await Category.findOne({ slug: body.slug });
    if (existing) {
      return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 400 });
    }

    const category = await Category.create(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create category" }, { status: 500 });
  }
}
