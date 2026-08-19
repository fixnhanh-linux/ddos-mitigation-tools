import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Tag from "@/models/Tag";
import Post from "@/models/Post";

export async function GET() {
  try {
    await connectDB();
    const tags = await Tag.find().lean();
    
    // Đếm số bài viết cho mỗi thẻ
    const tagsWithCount = await Promise.all(
      tags.map(async (tag: any) => {
        // Post model has tags: [String] (array of string slugs or names)
        // Let's assume it stores tag slugs or names. But the screenshot has tags separate.
        // Wait, Post has tags: [{ type: String }].
        // If they store names, we can query by name.
        const count = await Post.countDocuments({ tags: tag.name });
        return { ...tag, count };
      })
    );

    return NextResponse.json(tagsWithCount);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    
    const existing = await Tag.findOne({ slug: body.slug });
    if (existing) {
      return NextResponse.json({ error: "Slug thẻ đã tồn tại" }, { status: 400 });
    }

    const tag = await Tag.create(body);
    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create tag" }, { status: 500 });
  }
}
