"use client";

import { useState, useEffect } from "react";
import { MessageSquare, CornerDownRight } from "lucide-react";
import { useSession } from "next-auth/react";

const CommentItem = ({ 
  comment, 
  depth = 0, 
  onReply 
}: { 
  comment: any; 
  depth?: number; 
  onReply: (parentId: string, authorName: string) => void 
}) => {
  return (
    <div className={`mt-6 ${depth > 0 ? "ml-4 md:ml-8 lg:ml-12 border-l-2 border-slate-100 dark:border-slate-700 pl-4 md:pl-6" : ""}`}>
      <div className="bg-slate-50 dark:bg-slate-700/50 p-5 rounded-2xl border border-transparent dark:border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">
            {comment.authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{comment.authorName}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {new Date(comment.createdAt).toLocaleDateString("vi-VN", {
                day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-2">{comment.content}</p>
        
        <div className="mt-3">
          <button 
            onClick={() => onReply(comment._id, comment.authorName)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition"
          >
            <MessageSquare size={12} /> Trả lời
          </button>
        </div>
      </div>

      {comment.children && comment.children.length > 0 && (
        <div className="mt-2">
          {comment.children.map((child: any) => (
            <CommentItem key={child._id} comment={child} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [formData, setFormData] = useState({ authorName: "", authorEmail: "", content: "" });
  const [status, setStatus] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    fetchComments();
  }, [postId]);

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        authorName: session?.user?.name || prev.authorName,
        authorEmail: session?.user?.email || prev.authorEmail,
      }));
    }
  }, [session]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?postId=${postId}`);
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Lỗi tải bình luận:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildTree = (flatComments: any[]) => {
    const map = new Map();
    const roots: any[] = [];
    flatComments.forEach(c => map.set(c._id, { ...c, children: [] }));
    flatComments.forEach(c => {
      if (c.parentId) {
        const parent = map.get(c.parentId);
        if (parent) {
          parent.children.push(map.get(c._id));
        } else {
          roots.push(map.get(c._id)); // Fail-safe
        }
      } else {
        roots.push(map.get(c._id));
      }
    });
    return roots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: null, text: "" });

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          postId, 
          parentId: replyTo?.id || null 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", text: data.message });
        setFormData({ authorName: "", authorEmail: "", content: "" });
        setReplyTo(null);
        // fetchComments(); // Tạm tắt để đợi admin duyệt
      } else {
        setStatus({ type: "error", text: data.error });
      }
    } catch (error) {
      setStatus({ type: "error", text: "Lỗi kết nối máy chủ!" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (parentId: string, authorName: string) => {
    setReplyTo({ id: parentId, name: authorName });
    // Scroll to form
    document.getElementById("comment-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const commentTree = buildTree(comments);

  return (
    <div className="mt-16 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Bình luận ({comments.length})</h3>

      <div className="space-y-2 mb-12">
        {isLoading ? (
          <p className="text-slate-500 dark:text-slate-400">Đang tải bình luận...</p>
        ) : comments.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 italic">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        ) : (
          commentTree.map(c => (
            <CommentItem key={c._id} comment={c} onReply={handleReply} />
          ))
        )}
      </div>

      <div id="comment-form" className="scroll-mt-24 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {replyTo ? (
            <span className="flex items-center gap-2">
              <CornerDownRight size={18} className="text-indigo-500" />
              Trả lời <span className="text-indigo-600">{replyTo.name}</span>
              <button 
                onClick={() => setReplyTo(null)}
                className="text-xs ml-2 text-slate-400 hover:text-red-500 font-normal"
              >
                (Hủy)
              </button>
            </span>
          ) : "Để lại bình luận của bạn"}
        </h4>
        
        {status.type === "success" && <div className="mb-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl">{status.text}</div>}
        {status.type === "error" && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">{status.text}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!session?.user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Tên của bạn *" 
                required
                value={formData.authorName}
                onChange={e => setFormData({...formData, authorName: e.target.value})}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
              />
              <input 
                type="email" 
                placeholder="Email của bạn *" 
                required
                value={formData.authorEmail}
                onChange={e => setFormData({...formData, authorEmail: e.target.value})}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
              />
            </div>
          )}
          <textarea 
            rows={4} 
            placeholder="Viết suy nghĩ của bạn..." 
            required
            value={formData.content}
            onChange={e => setFormData({...formData, content: e.target.value})}
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-slate-900 dark:text-white"
          ></textarea>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-70"
          >
            {isSubmitting ? "Đang gửi..." : "Gửi bình luận"}
          </button>
        </form>
      </div>
    </div>
  );
}
