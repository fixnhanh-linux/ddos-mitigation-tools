"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function TrackHistory({ post, postId }: { post: any, postId?: string }) {
  const { status } = useSession();

  useEffect(() => {
    // 1. Local Storage fallback cho người dùng chưa đăng nhập hoặc chung
    try {
      const historyStr = localStorage.getItem("myblog_history");
      let history = historyStr ? JSON.parse(historyStr) : [];
      
      // Remove if already exists to push it to the top
      history = history.filter((p: any) => p.slug !== post.slug);
      
      // Add to front
      history.unshift({
        slug: post.slug,
        title: post.title,
        coverImage: post.coverImage,
        createdAt: new Date().toISOString()
      });
      
      // Keep only last 5
      if (history.length > 5) {
        history = history.slice(0, 5);
      }
      
      localStorage.setItem("myblog_history", JSON.stringify(history));
    } catch (error) {
      console.error("Lỗi khi lưu lịch sử đọc local:", error);
    }

    // 2. Gọi API nếu đã đăng nhập
    if (status === "authenticated" && postId) {
      fetch("/api/user/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      }).catch(err => console.error("Lỗi lưu lịch sử server:", err));
    }

  }, [post, postId, status]);

  return null;
}
