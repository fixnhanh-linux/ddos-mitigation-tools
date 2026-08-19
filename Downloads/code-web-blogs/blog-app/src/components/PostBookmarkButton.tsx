"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Bookmark } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function PostBookmarkButton({ postId, initialIsBookmarked = false }: { postId: string, initialIsBookmarked?: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isLoading, setIsLoading] = useState(false);

  // Mặc định chúng ta có thể check lại từ API nếu muốn, nhưng để nhanh thì fetch lần đầu
  useEffect(() => {
    if (status === "authenticated" && postId) {
      fetch("/api/user/bookmarks")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const found = data.some((b: any) => b.post?._id === postId || b.post === postId);
            setIsBookmarked(found);
          }
        })
        .catch(() => {});
    }
  }, [status, postId]);

  const toggleBookmark = async () => {
    if (status === "unauthenticated") {
      toast.error("Vui lòng đăng nhập để lưu bài viết!");
      router.push("/auth/signin");
      return;
    }
    
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsBookmarked(data.bookmarked);
        toast.success(data.message);
      } else {
        toast.error(data.message || "Lỗi khi lưu bài viết");
      }
    } catch (error) {
      toast.error("Lỗi kết nối");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={toggleBookmark}
      disabled={isLoading}
      title={isBookmarked ? "Bỏ lưu bài viết" : "Lưu bài viết"}
      className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
        isBookmarked 
          ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400" 
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
      }`}
    >
      <Bookmark size={20} className={isBookmarked ? "fill-current" : ""} />
    </button>
  );
}
