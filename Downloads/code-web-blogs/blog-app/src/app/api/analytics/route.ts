import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Pageview from "@/models/Pageview";
import Post from "@/models/Post";

// Nhận request từ Client để lưu Pageview và tăng lượt xem bài viết nếu là IP duy nhất
export async function POST(req: Request) {
  try {
    const { path, referer } = await req.json();
    
    // Bỏ qua các route admin hoặc API (không track admin)
    if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/dashboard")) {
      return NextResponse.json({ success: true });
    }

    await connectDB();
    
    const userAgent = req.headers.get("user-agent") || "";
    // Bỏ qua Bot/Crawler cơ bản
    if (userAgent.toLowerCase().includes("bot") || userAgent.toLowerCase().includes("crawler")) {
      return NextResponse.json({ success: true });
    }

    // Lấy địa chỉ IP của Client
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1";

    // Kiểm tra xem IP này đã xem path này chưa
    const isUnique = await Pageview.findOne({ path, ipAddress: ip });

    // Nếu chưa xem và đây là trang chi tiết bài viết, tiến hành tăng lượt xem bài viết
    if (!isUnique && path.startsWith("/posts/")) {
      let slug = path.replace(/^\/posts\/?/, "").split("?")[0].split("#")[0];
      if (slug.endsWith("/")) {
        slug = slug.slice(0, -1);
      }
      
      if (slug) {
        await Post.updateOne(
          { slug },
          { $inc: { views: 1 } }
        );
      }
    }

    // Lưu Pageview kèm IP
    await Pageview.create({
      path,
      referer,
      userAgent,
      ipAddress: ip
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to track pageview" }, { status: 500 });
  }
}

// Trả về dữ liệu thống kê cho Admin Dashboard
export async function GET() {
  try {
    await connectDB();
    
    // Tổng số view
    const totalViews = await Pageview.countDocuments();
    
    // Số view 30 ngày qua (groupby ngày)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewsByDate = await Pageview.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { "_id": 1 } }
    ]);

    return NextResponse.json({ totalViews, viewsByDate }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
