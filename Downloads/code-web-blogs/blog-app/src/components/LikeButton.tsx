"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useSession } from "next-auth/react";


interface LikeButtonProps {
  postId: string;
  initialLikes: number;
  initialHasLiked: boolean;
}

export default function LikeButton({ postId, initialLikes, initialHasLiked }: LikeButtonProps) {
  const { data: session } = useSession();
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    if (!session) {
      // toast("Vui lòng đăng nhập để thích bài viết", { type: "error" }); // Adjust this based on notification system
      alert("Vui lòng đăng nhập để thả tim bài viết!");
      return;
    }

    setIsLoading(true);
    // Optimistic UI Update
    setHasLiked(!hasLiked);
    setLikes(prev => hasLiked ? prev - 1 : prev + 1);

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Lỗi khi thả tim");
      }
      
      const data = await res.json();
      // Sync with server if needed
      setLikes(data.likesCount);
      setHasLiked(data.hasLiked);
    } catch (error) {
      console.error(error);
      // Revert Optimistic Update
      setHasLiked(hasLiked);
      setLikes(initialLikes);
      alert("Đã xảy ra lỗi, vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-semibold border
        ${hasLiked 
          ? "bg-red-50 text-red-500 border-red-200 dark:bg-red-900/20 dark:border-red-900/30" 
          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
        }
      `}
      title={hasLiked ? "Bỏ thích" : "Thích bài viết"}
    >
      <Heart 
        size={20} 
        className={`transition-all duration-300 ${hasLiked ? "fill-red-500 text-red-500 scale-110" : "text-slate-500 dark:text-slate-400 scale-100"}`} 
      />
      <span>{likes} {likes > 1 ? "Likes" : "Like"}</span>
    </button>
  );
}
