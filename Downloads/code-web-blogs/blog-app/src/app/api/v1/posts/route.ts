import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";

// Bật CORS cho phép Mobile App gọi (Cross-Origin Resource Sharing)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    await connectDB();
    
    // Lấy bài viết xuất bản, chỉ trả về các trường cần thiết, tránh lộ thông tin Admin
    const posts = await Post.find({ published: true })
      .select('title slug excerpt createdAt')
      .populate({ path: 'author', select: 'name' }) // Chỉ lấy tên tác giả, giấu email
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments({ published: true });

    return NextResponse.json({
      success: true,
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }, { headers: corsHeaders, status: 200 });

  } catch (error) {
    return NextResponse.json({ success: false, error: "Lỗi máy chủ" }, { headers: corsHeaders, status: 500 });
  }
}
