import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import Pageview from "@/models/Pageview";
import Comment from "@/models/Comment";
import { Users, FileText, Eye, TrendingUp, MessageCircle, Zap } from "lucide-react";
import Link from "next/link";
import DashboardCharts from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

async function getChartData(days: number) {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const raw = await Pageview.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        views: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing days with 0
  const map: Record<string, number> = {};
  raw.forEach((r) => { map[r._id] = r.views; });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ date: label, views: map[key] || 0 });
  }
  return result;
}

export default async function DashboardPage() {
  await connectDB();

  const [totalPosts, publishedPosts, totalUsers, totalViews, totalComments] = await Promise.all([
    Post.countDocuments(),
    Post.countDocuments({ status: "published" }),
    User.countDocuments(),
    Pageview.countDocuments(),
    Comment.countDocuments(),
  ]);

  // Chart data cho 3 mức thời gian
  const [data7, data14, data30] = await Promise.all([
    getChartData(7),
    getChartData(14),
    getChartData(30),
  ]);

  // Top bài đọc nhiều nhất (30 ngày qua)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const topPostsRaw = await Pageview.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo }, path: { $regex: "^/posts/" } } },
    { $group: { _id: "$path", views: { $sum: 1 } } },
    { $sort: { views: -1 } },
    { $limit: 5 },
  ]);

  // Lấy thông tin bài từ slug
  const topPosts = await Promise.all(
    topPostsRaw.map(async (item) => {
      const slug = item._id.replace("/posts/", "");
      const post = await Post.findOne({ slug }).select("title slug coverImage").lean();
      return post ? { _id: (post as any)._id.toString(), title: (post as any).title, slug: (post as any).slug, coverImage: (post as any).coverImage || "", views: item.views } : null;
    })
  );
  const filteredTopPosts = topPosts.filter(Boolean) as { _id: string; title: string; slug: string; coverImage: string; views: number }[];

  // Bài viết gần đây
  const recentPosts = await Post.find().sort({ updatedAt: -1 }).limit(4).populate("author", "name").lean();

  const stats = [
    { name: "Tổng số Bài viết", value: totalPosts, sub: `${publishedPosts} đã xuất bản`, icon: FileText, color: "bg-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
    { name: "Lượt truy cập", value: totalViews.toLocaleString("vi-VN"), sub: "Tổng toàn thời gian", icon: Eye, color: "bg-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
    { name: "Bình luận", value: totalComments, sub: "Từ tất cả bài viết", icon: MessageCircle, color: "bg-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
    { name: "Thành viên", value: totalUsers, sub: "Người dùng đã đăng ký", icon: Users, color: "bg-purple-500", textColor: "text-purple-600", bgColor: "bg-purple-50" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tổng quan</h1>
          <p className="text-slate-500 text-sm mt-1">Xin chào! Đây là những gì đang xảy ra hôm nay.</p>
        </div>
        <Link
          href="/posts/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold text-sm shadow-lg shadow-indigo-500/25"
        >
          <Zap size={16} /> Viết bài mới
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white ${stat.color} shadow-sm`}>
                <stat.icon size={22} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-bold ${stat.textColor} ${stat.bgColor} px-2.5 py-1 rounded-full`}>
                <TrendingUp size={11} /> Live
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800">{stat.value}</h3>
              <p className="text-slate-500 text-sm font-medium mt-1">{stat.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts (full width) */}
      <DashboardCharts
        data7={data7}
        data14={data14}
        data30={data30}
        topPosts={filteredTopPosts}
      />

      {/* Recent posts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-slate-800">Bài viết cập nhật gần đây</h3>
          <Link href="/posts" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition">
            Xem tất cả →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {recentPosts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Chưa có bài viết nào.</p>
          ) : (
            recentPosts.map((post: any) => (
              <div key={post._id.toString()} className="flex items-center gap-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-500 flex-shrink-0 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{post.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="text-indigo-600 font-medium">{post.author?.name || "Admin"}</span> • {new Date(post.updatedAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  post.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {post.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
