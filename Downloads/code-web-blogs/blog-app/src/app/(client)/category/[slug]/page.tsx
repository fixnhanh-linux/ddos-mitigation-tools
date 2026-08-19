import { notFound } from "next/navigation";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";
import Post from "@/models/Post";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  await connectDB();
  const category = await Category.findOne({ slug: resolvedParams.slug }).lean();

  if (!category) {
    return { title: "Không tìm thấy chuyên mục" };
  }

  return {
    title: `${category.name} | Tên Website`,
    description: category.description || `Đọc các bài viết mới nhất về chuyên mục ${category.name} trên Tên Website.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  await connectDB();

  const category = await Category.findOne({ slug: resolvedParams.slug }).lean();

  if (!category) {
    notFound();
  }

  const query = {
    category: category._id,
    $or: [{ status: "published" }, { published: true }],
    publishedAt: { $not: { $gt: new Date() } }
  };

  const posts = await Post.find(query).sort({ createdAt: -1 }).lean();

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="text-center mb-16 border-b border-slate-100 dark:border-slate-800 pb-12">
        <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">{category.name}</h1>
        {category.description && (
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{category.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-12">
            Chưa có bài viết nào trong danh mục này.
          </div>
        ) : (
          posts.map((post: any) => (
            <Link key={post._id.toString()} href={`/posts/${post.slug}`} className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl dark:hover:shadow-indigo-900/20 transition-all duration-300 hover:-translate-y-1">
              <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-700 overflow-hidden relative">
                {post.coverImage ? (
                  <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                ) : (
                  <img src={`https://picsum.photos/seed/${post._id}/800/500`} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">{post.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 line-clamp-3 text-sm leading-relaxed mb-4 flex-1">{post.excerpt || post.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...'}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
