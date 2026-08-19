import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    
    await connectDB();
    const { ids, category, tags } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Không có bài viết nào được chọn" }, { status: 400 });
    }

    const updateData: any = {};
    if (category) {
      if (category === "none") {
         updateData.$unset = { category: 1 };
      } else {
         updateData.$set = { ...updateData.$set, category };
      }
    }
    
    if (tags && Array.isArray(tags)) {
      if (!updateData.$set) updateData.$set = {};
      updateData.$set.tags = tags;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu để cập nhật" }, { status: 400 });
    }

    const query: any = { _id: { $in: ids } };
    
    // Nếu là tác giả, chỉ cho phép cập nhật bài viết của mình
    if (user.role === "author") {
        query.author = user.id;
    }

    const result = await Post.updateMany(query, updateData);

    return NextResponse.json({ success: true, count: result.modifiedCount });
  } catch (error: any) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Lỗi Server Nội bộ" }, { status: 500 });
  }
}
