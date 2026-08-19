"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { History } from "lucide-react";

export default function RecentHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const historyStr = localStorage.getItem("myblog_history");
      if (historyStr) {
        setHistory(JSON.parse(historyStr));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  if (!mounted || history.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      <div className="flex items-center gap-2 mb-6">
        <History className="text-indigo-600 dark:text-indigo-400" size={20} />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Vừa xem gần đây</h3>
      </div>
      <div className="space-y-4">
        {history.map((post: any) => (
          <Link key={post.slug} href={`/posts/${post.slug}`} className="group flex gap-4 items-center">
            <div className="relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
              {post.coverImage && (post.coverImage.startsWith('http') || post.coverImage.startsWith('/')) ? (
                <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-110 transition-all duration-700 ease-in-out transform-gpu" />
              ) : (
                <img src={post.coverImage || `https://picsum.photos/seed/${post.slug}/150/150`} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 ease-in-out transform-gpu" />
              )}
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">
              {post.title}
            </h4>
          </Link>
        ))}
      </div>
    </div>
  );
}
