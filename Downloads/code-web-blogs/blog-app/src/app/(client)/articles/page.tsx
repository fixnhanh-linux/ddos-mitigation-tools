import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

import Setting from "@/models/Setting";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  await connectDB();
  const st = await Setting.findOne({ key: 'site_title' }).lean();
  const siteTitle = (st?.value as string) || "Tên Website";
  
  return {
    title: `Tất cả bài viết | ${siteTitle}`,
    description: "Khám phá hàng ngàn bài viết chất lượng từ chuyên gia.",
  };
}

export default async function AllPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const limit = 12;

  await connectDB();

  const query = {
    $or: [{ status: "published" }, { status: "scheduled" }, { published: true }],
    publishedAt: { $not: { $gt: new Date() } }
  };

  const totalPosts = await Post.countDocuments(query);
  const totalPages = Math.ceil(totalPosts / limit);

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('category')
    .lean();

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-12 border-b border-slate-100 dark:border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Tất cả bài viết</h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">Khám phá toàn bộ {totalPosts} bài viết trên hệ thống</p>
        </div>
        <Link href="/" className="hidden md:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 transition px-5 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
          <ArrowLeft size={20} /> Trang chá»§
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">
            Chưa có bài viết nào được xuất bản.
          </div>
        ) : (
          posts.map((post: any) => (
            <Link key={post._id.toString()} href={`/posts/${post.slug}`} className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl dark:hover:shadow-indigo-900/20 transition-all duration-300 hover:-translate-y-1">
              <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-700 overflow-hidden relative">
                {post.coverImage && (post.coverImage.startsWith('http') || post.coverImage.startsWith('/')) ? (
                  <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                ) : (
                  <img src={post.coverImage || `https://picsum.photos/seed/${post._id}/800/500`} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                    {post.category?.name || "Chưa phân loại"}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">
                  {post.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 line-clamp-3 text-sm leading-relaxed mb-4 flex-1">
                  {post.excerpt || post.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...'}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="mt-16 flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <Link
              key={i}
              href={`/articles?page=${i + 1}`}
              className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors ${page === i + 1
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700"
                }`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
