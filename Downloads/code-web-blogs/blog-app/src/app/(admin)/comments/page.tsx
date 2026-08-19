"use client";

import React, { useState, useEffect } from "react";
import { Check, Trash2, AlertOctagon, MessageCircle, Loader2, Reply, Send, X } from "lucide-react";
import toast from "react-hot-toast";

export default function CommentsPage() {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Trạng thái phản hồi
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      // In a real app, you might want a special endpoint to fetch ALL comments for admin
      // The current GET /api/comments might only fetch 'approved' comments for a specific post.
      // So let's fetch them directly using a server action, or we can create an admin endpoint.
      // Wait, since we are fetching from client, we need a dedicated admin API for comments.
      // Actually, since this is a quick update, let's create a server action inside this file,
      // or we can fetch from a new endpoint.
      const res = await fetch("/api/admin/comments");
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      toast.error("Lỗi khi tải bình luận");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Lỗi khi cập nhật");
      toast.success("Cập nhật trạng thái thành công");
      
      // Update local state
      setComments(comments.map(c => c._id === id ? { ...c, status } : c));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa vĩnh viễn bình luận này?")) return;
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Lỗi khi xóa");
      toast.success("Đã xóa bình luận");
      
      // Update local state
      setComments(comments.filter(c => c._id !== id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReplySubmit = async (comment: any) => {
    if (!replyContent.trim()) return toast.error("Vui lòng nhập nội dung phản hồi");
    setIsSubmittingReply(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: comment.post._id,
          authorName: "Admin", // Hoặc lấy từ session nếu có NextAuth
          authorEmail: "admin@tenwebsite.com",
          content: replyContent,
          parentId: comment._id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Đã gửi phản hồi");
      
      // Auto approve admin replies by setting it directly
      if (data.comment) {
         // Auto approve the admin reply by calling the PUT API
         await fetch(`/api/comments/${data.comment._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved" })
         });
      }

      setReplyingTo(null);
      setReplyContent("");
      fetchComments(); // Reload to show the new comment
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi phản hồi");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Bình luận</h1>
          <p className="text-slate-500 mt-1">Duyệt và kiểm soát tương tác của độc giả.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-semibold w-1/4">Người bình luận</th>
                <th className="px-6 py-4 font-semibold w-2/4">Nội dung & Bài viết</th>
                <th className="px-6 py-4 font-semibold w-1/4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="animate-spin mx-auto h-8 w-8 text-indigo-600 mb-3" />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <MessageCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    Chưa có bình luận nào cần duyệt.
                  </td>
                </tr>
              ) : (
                comments.map((comment: any) => (
                  <React.Fragment key={comment._id.toString()}>
                    <tr className={`transition ${comment.status === 'pending' ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-3">
                        {comment.authorAvatar ? (
                          <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img src={comment.authorAvatar} alt={comment.authorName} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-lg overflow-hidden">
                            {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{comment.authorName}</div>
                          <div className="text-xs text-slate-500">{comment.authorEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2">
                        "{comment.content}"
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Đã phản hồi trong: </span>
                        <span className="font-medium text-indigo-600 truncate max-w-xs">{comment.post?.title || "Bài viết đã bị xoá"}</span>
                        <span>•</span>
                        <span>{new Date(comment.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      {comment.status === 'pending' && (
                        <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium mb-3">Chờ duyệt</span>
                      )}
                      {comment.status === 'approved' && (
                        <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium mb-3">Đã duyệt</span>
                      )}
                      {comment.status === 'spam' && (
                        <span className="inline-block px-2.5 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium mb-3">Spam</span>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        {comment.status === 'approved' && (
                          <button 
                            onClick={() => { setReplyingTo(comment._id); setReplyContent(""); }}
                            title="Phản hồi" 
                            className="p-2 text-slate-400 hover:text-blue-600 transition rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200"
                          >
                            <Reply size={16} />
                          </button>
                        )}
                        {comment.status !== 'approved' && (
                          <button 
                            onClick={() => handleUpdateStatus(comment._id, 'approved')}
                            title="Phê duyệt" 
                            className="p-2 text-slate-400 hover:text-emerald-600 transition rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {comment.status !== 'spam' && (
                          <button 
                            onClick={() => handleUpdateStatus(comment._id, 'spam')}
                            title="Đánh dấu Spam" 
                            className="p-2 text-slate-400 hover:text-amber-600 transition rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200"
                          >
                            <AlertOctagon size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(comment._id)}
                          title="Xoá vĩnh viễn" 
                          className="p-2 text-slate-400 hover:text-red-600 transition rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Hộp thoại phản hồi */}
                  {replyingTo === comment._id && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={3} className="px-6 py-4 border-t border-blue-100">
                        <div className="flex gap-3 items-start ml-12">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden">
                            A
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder={`Phản hồi lại ${comment.authorName}...`}
                              className="w-full border-blue-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-3 min-h-[80px]"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button 
                                onClick={() => setReplyingTo(null)}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
                              >
                                <X size={14} /> Hủy
                              </button>
                              <button 
                                onClick={() => handleReplySubmit(comment)}
                                disabled={isSubmittingReply}
                                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 disabled:opacity-70"
                              >
                                {isSubmittingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Gửi phản hồi
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
