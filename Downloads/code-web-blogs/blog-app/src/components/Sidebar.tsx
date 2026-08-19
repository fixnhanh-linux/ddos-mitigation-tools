import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Setting from "@/models/Setting";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, ImageIcon } from "lucide-react";
import PremiumBanner from "@/components/PremiumBanner";
import RecentHistory from "@/components/RecentHistory";
import LeaderboardWidget from "@/components/LeaderboardWidget";
import DonationWidget from "@/components/DonationWidget";
import UnifiedSubscribeForm from "@/components/UnifiedSubscribeForm";
import TagsWidget from "@/components/TagsWidget";

import { getDictionary } from "@/lib/getDictionary";

export default async function Sidebar() {
  await connectDB();
  const t = await getDictionary();
  
  // Lấy 3 bài viết mới nhất (hoặc nổi bật)
  const trendingPosts = await Post.find({ published: true })
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();

  // Kiểm tra cài đặt bật/tắt Paywall (Premium)
  const paywallSetting = await Setting.findOne({ key: "enable_paywall" }).lean();
  const isPaywallEnabled = paywallSetting ? paywallSetting.value : false;

  return (
    <aside 
      className="space-y-8 w-full sticky" 
      style={{ top: "min(2rem, calc(100vh - 100% - 2rem))" }}
    >
      {/* Donation Mini Widget */}
      <DonationWidget variant="mini" />

      {/* Widget 1: Trending Posts */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={20} />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.featured_posts}</h3>
        </div>
        <div className="space-y-6">
          {trendingPosts.map((post: any, index: number) => (
            <Link key={post._id.toString()} href={`/posts/${post.slug}`} className="group flex gap-4 items-start">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                {post.coverImage && (post.coverImage.startsWith('http') || post.coverImage.startsWith('/')) ? (
                  <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-110 transition-all duration-700 ease-in-out transform-gpu" />
                ) : (
                  <img src={post.coverImage || `https://picsum.photos/seed/${post._id}/200/200`} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 ease-in-out transform-gpu" />
                )}
                <div className="absolute top-0 left-0 bg-indigo-600 text-white w-6 h-6 flex items-center justify-center text-xs font-bold rounded-br-lg z-10">
                  {index + 1}
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition mb-1 leading-snug">
                  {post.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(post.createdAt).toLocaleDateString("vi-VN")}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="p-7 bg-white dark:bg-[#171a2b] rounded-[32px] shadow-sm border border-slate-100 dark:border-transparent">
          <p className="text-[15px] text-slate-600 dark:text-slate-400 mb-6 font-medium leading-relaxed">Nhập email để nhận những bài viết công nghệ mới nhất hàng tuần.</p>
          <UnifiedSubscribeForm />
      </div>

      {/* Widget 1.2: Bảng phong thần */}
      <LeaderboardWidget />

      {/* Widget 1.3: Tag Cloud */}
      <TagsWidget />

      {/* Widget 1.5: Vừa xem gần đây (Client-side) */}
      <RecentHistory />

      {/* Widget 2: Banner Quảng cáo / Subscribe */}
      {isPaywallEnabled && <PremiumBanner />}
    </aside>
  );
}
