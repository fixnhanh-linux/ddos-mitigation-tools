import Link from "next/link";
import Image from "next/image";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import { ArrowRight, Mail } from "lucide-react";
import FadeIn from "@/components/FadeIn";
import Sidebar from "@/components/Sidebar";
import type { Metadata } from "next";

export const revalidate = 60;

import Setting from "@/models/Setting";

export async function generateMetadata(): Promise<Metadata> {
  await connectDB();
  const settings = await Setting.find({ group: 'general' }).lean();
  const siteTitle = settings.find((s: any) => s.key === 'site_title')?.value || "Tên Website";
  const siteDesc = settings.find((s: any) => s.key === 'site_description')?.value || "Trải nghiệm đọc báo điện tử, tạp chí số thế hệ mới với thiết kế tối giản và tốc độ siêu nhanh.";

  return {
    title: `${siteTitle} - Nền tảng Tạp chí Số Hiện đại`,
    description: siteDesc,
  };
}

import { getDictionary } from "@/lib/getDictionary";

export default async function HomePage() {
  const t = await getDictionary();
  await connectDB();
  const query = {
    $or: [{ status: "published" }, { status: "scheduled" }, { published: true }],
    publishedAt: { $not: { $gt: new Date() } }
  };
  const posts = JSON.parse(JSON.stringify(await Post.find(query).sort({ createdAt: -1 }).lean()));

  const settingsList = await Setting.find({ group: 'general' }).lean();
  const getSetting = (key: string, defaultValue: any) => settingsList.find((s: any) => s.key === key)?.value ?? defaultValue;

  const heroTitle = getSetting('hero_title', "");
  const heroDesc = getSetting('hero_desc', "");
  const newsletterTitle = getSetting('newsletter_title', "Đừng bỏ lỡ tin tức mới");
  const newsletterDesc = getSetting('newsletter_desc', "Đăng ký nhận bản tin hàng tuần để cập nhật những bài viết, xu hướng công nghệ mới nhất trực tiếp vào hộp thư của bạn.");
  const newsletterPlaceholder = getSetting('newsletter_placeholder', "Địa chỉ email của bạn");
  const newsletterBtn = getSetting('newsletter_btn', "Đăng ký");

  const featuredPost = posts.length > 0 ? posts[0] : null;
  const recentPosts = posts.length > 1 ? posts.slice(1) : [];

  return (
    <div className="space-y-20">
      {/* Hero Section / Featured Post */}
      <section>
        {featuredPost ? (
          <Link href={`/posts/${featuredPost.slug}`} className="group block relative rounded-3xl overflow-hidden shadow-xl aspect-[21/9] bg-slate-900">
            <img
              src={featuredPost.coverImage || `https://picsum.photos/seed/${featuredPost._id}/1600/900`}
              alt={featuredPost.title}
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-50 transition-all duration-700 ease-in-out transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-8 md:p-16 max-w-4xl">
              <span className="inline-block bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
                Nổi bật
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 group-hover:text-indigo-300 transition">
                {featuredPost.title}
              </h2>
              <p className="text-slate-300 text-lg line-clamp-2 mb-6 hidden md:block">
                {featuredPost.excerpt || featuredPost.content.substring(0, 200).replace(/<[^>]+>/g, '') + '...'}
              </p>
              <div className="flex items-center text-sm font-medium text-slate-400">
                <span className="text-white">Admin</span>
                <span className="mx-3">•</span>
                <span>{new Date(featuredPost.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">{heroTitle}</h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{heroDesc}</p>
          </div>
        )}
      </section>

      {/* Recent Posts Grid */}
      {recentPosts.length > 0 && (
        <section className="mb-20 animate-fade-in">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{t.latest_posts}</h3>
            <Link href="/articles" className="hidden md:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-800 dark:hover:text-indigo-300 transition">
              {t.view_all} <ArrowRight size={16} />
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row gap-12">
            {/* Main Content (2/3) */}
            <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8 h-fit">
              {recentPosts.map((post: any, index: number) => (
                <FadeIn key={post._id.toString()} delay={index * 150}>
                  <Link href={`/posts/${post.slug}`} className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-xl dark:hover:shadow-indigo-900/20 transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-700 overflow-hidden relative">
                      {post.coverImage && (post.coverImage.startsWith('http') || post.coverImage.startsWith('/')) ? (
                        <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                      ) : (
                        <img src={post.coverImage || `https://picsum.photos/seed/${post._id}/800/500`} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                      )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">Công nghệ</span>
                        <span className="text-xs text-slate-400 font-medium">{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">
                        {post.title}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-3 text-sm leading-relaxed mb-4 flex-1">
                        {post.excerpt || post.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...'}
                      </p>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>

            {/* Sidebar (1/3) */}
            <div className="lg:w-1/3">
              <Sidebar />
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Section */}
      <section className="bg-indigo-600 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <Mail className="mx-auto w-12 h-12 mb-6 text-indigo-200" />
          <h3 className="text-3xl md:text-4xl font-black mb-4">{newsletterTitle}</h3>
          <p className="text-indigo-100 text-lg mb-8">{newsletterDesc}</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" placeholder={newsletterPlaceholder} className="flex-1 px-5 py-3 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-400/50" required />
            <button type="button" className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg">
              {newsletterBtn}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
