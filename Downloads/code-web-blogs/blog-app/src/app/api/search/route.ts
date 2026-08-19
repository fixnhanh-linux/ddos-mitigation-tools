import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 12;

  if (!q.trim()) {
    return NextResponse.json({ posts: [], total: 0 });
  }

  try {
    await connectDB();
    const filter = {
      $or: [{ status: "published" }, { published: true }],
      $and: [
        {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { excerpt: { $regex: q, $options: "i" } },
            { tags: { $regex: q, $options: "i" } },
            { content: { $regex: q, $options: "i" } },
          ]
        }
      ]
    };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("category", "name slug")
        .select("title slug excerpt coverImage createdAt category tags")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    return NextResponse.json({ posts, total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
