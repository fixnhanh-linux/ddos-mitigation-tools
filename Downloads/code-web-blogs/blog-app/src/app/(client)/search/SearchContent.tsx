"use client";

import { useState, useEffect } from "react";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Post {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  createdAt: string;
  category?: { name: string; slug: string };
}

export default function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get("q") || "");
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setPosts([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams?.get("q") || "";
    setQuery(q);
    if (q) doSearch(q);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white">Tìm kiếm bài viết</h1>
        <p className="text-slate-500 dark:text-slate-400">Gõ từ khóa để tìm bài viết phù hợp</p>
      </div>

      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
        <SearchIcon size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Tìm theo tiêu đề, chủ đề, nội dung..."
          className="w-full pl-14 pr-40 py-4 text-base rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-500/30">
          Tìm kiếm
        </button>
      </form>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-pulse">
              <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-700" />
              <div className="p-5 space-y-3">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : searched ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-slate-500 dark:text-slate-400">
              Tìm thấy <span className="font-bold text-indigo-600 dark:text-indigo-400">{total}</span> bài viết cho &ldquo;<span className="font-semibold text-slate-700 dark:text-slate-300">{searchParams?.get("q")}</span>&rdquo;
            </p>
            <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              <ArrowLeft size={14} /> Trang chủ
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <Link key={post._id} href={`/posts/${post.slug}`}
                  className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl dark:hover:shadow-indigo-900/20 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <img src={post.coverImage || `https://picsum.photos/seed/${post._id}/800/500`} alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    {post.category && (
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">{post.category.name}</span>
                    )}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug line-clamp-2 flex-1">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-auto">{new Date(post.createdAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
              <SearchIcon size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Không tìm thấy kết quả</p>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Thử tìm với từ khóa khác nhé!</p>
              <Link href="/" className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition px-6 py-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                <ArrowLeft size={16} /> Về trang chủ
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <SearchIcon size={48} className="mx-auto mb-4 opacity-30" />
          <p>Nhập từ khóa và nhấn Enter để tìm kiếm</p>
        </div>
      )}
    </div>
  );
}
