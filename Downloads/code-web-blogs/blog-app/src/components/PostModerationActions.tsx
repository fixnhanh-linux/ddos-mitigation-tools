"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function PostModerationActions({ postId, status }: { postId: string, status: string }) {
  const router = useRouter();

  if (status !== "pending") return null;

  const handleUpdate = async (newStatus: string) => {
    let reason = "";
    if (newStatus === "rejected") {
      reason = prompt("Lý do từ chối bài viết:") || "Không đạt yêu cầu";
    }

    try {
      const res = await fetch(`/api/posts/${postId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, rejectionReason: reason })
      });

      if (res.ok) {
        toast.success(newStatus === "published" ? "Đã duyệt bài!" : "Đã từ chối bài!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (e) {
      toast.error("Lỗi mạng");
    }
  };

  return (
    <div className="flex gap-2 justify-end mt-2">
      <button 
        onClick={() => handleUpdate("published")}
        className="flex items-center gap-1 text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-medium"
        title="Duyệt bài"
      >
        <CheckCircle size={14} /> Duyệt
      </button>
      <button 
        onClick={() => handleUpdate("rejected")}
        className="flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 px-2 py-1 rounded text-xs font-medium"
        title="Từ chối"
      >
        <XCircle size={14} /> Từ chối
      </button>
    </div>
  );
}
