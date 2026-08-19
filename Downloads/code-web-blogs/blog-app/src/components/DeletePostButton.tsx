"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePostButton({ postId }: { postId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc chắn muốn xoá bài viết này không? Hành động này không thể hoàn tác.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Xoá thất bại!");
      }
    } catch (e) {
      alert("Lỗi kết nối.");
    }
    setIsDeleting(false);
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 disabled:opacity-50"
      title="Xoá bài viết"
    >
      <Trash2 size={18} />
    </button>
  );
}
