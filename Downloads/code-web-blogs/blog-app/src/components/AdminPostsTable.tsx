"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Edit, Eye, Trash2, FileText, FileDown, Settings } from "lucide-react";
import PostModerationActions from "./PostModerationActions";
import toast from "react-hot-toast";
import DeletePostButton from "./DeletePostButton";
import { useRouter } from "next/navigation";

export default function AdminPostsTable({ posts, isAuthor }: { posts: any[]; isAuthor: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/categories")
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) setCategories(data);
      })
      .catch(console.error);
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(posts.map((p) => p._id.toString()));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xoá ${selectedIds.length} bài viết đã chọn?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/posts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        router.refresh();
        toast.success("Xoá thành công!");
      } else {
        toast.error("Xoá thất bại!");
      }
    } catch (e) {
      toast.error("Lỗi kết nối.");
    }
    setIsDeleting(false);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    setIsUpdating(true);
    
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    
    try {
      const res = await fetch("/api/posts/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ids: selectedIds,
          category: selectedCategory || undefined,
          tags: tags.length > 0 ? tags : undefined
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(`Đã cập nhật ${data.count} bài viết!`);
        setIsUpdateModalOpen(false);
        setSelectedIds([]);
        setSelectedCategory("");
        setTagsInput("");
        router.refresh();
      } else {
        toast.error(data.error || "Cập nhật thất bại!");
      }
    } catch (e) {
      toast.error("Lỗi kết nối.");
    }
    setIsUpdating(false);
  };

  const handleExportPDF = async (post: any) => {
    try {
      toast.loading("Đang tạo PDF, vui lòng đợi...", { id: "export-pdf" });
      const html2pdf = (await import("html2pdf.js")).default;
      
      const container = document.createElement("div");
      container.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333;">
          <h1 style="font-size: 24px; margin-bottom: 20px;">${post.title}</h1>
          <div style="line-height: 1.6;">${post.content || ''}</div>
        </div>
      `;
      
      const opt = {
        margin:       0.5,
        filename:     `${post.slug}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
      };
      
      await html2pdf().set(opt).from(container).save();
      toast.success("Xuất PDF thành công!", { id: "export-pdf" });
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất PDF", { id: "export-pdf" });
    }
  };

  return (
    <div>
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 flex flex-col sm:flex-row justify-between items-center rounded-t-xl gap-3">
          <span className="text-blue-800 font-medium">Đã chọn {selectedIds.length} bài viết</span>
          <div className="flex gap-2">
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Settings size={16} />
              Cập nhật chung
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 size={16} />
              {isDeleting ? "Đang xoá..." : "Xoá các mục đã chọn"}
            </button>
          </div>
        </div>
      )}

      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Cập nhật hàng loạt</h3>
            <p className="text-sm text-gray-500 mb-4">
              Thay đổi chuyên mục hoặc tags cho {selectedIds.length} bài viết đã chọn. Để trống nếu không muốn thay đổi.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chuyên mục mới</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="">-- Giữ nguyên chuyên mục --</option>
                  <option value="none">-- Bỏ chọn chuyên mục --</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (cách nhau bởi dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: công nghệ, lập trình..."
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">Lưu ý: Tags mới sẽ GHI ĐÈ các tags cũ của bài viết.</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                disabled={isUpdating}
              >
                Hủy
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={isUpdating}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
              >
                {isUpdating ? "Đang xử lý..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white shadow-sm border border-gray-100 overflow-x-auto ${selectedIds.length > 0 ? 'rounded-b-xl' : 'rounded-xl'}`}>
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
              <th className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={posts.length > 0 && selectedIds.length === posts.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="p-4 font-semibold">Tiêu đề</th>
              <th className="p-4 font-semibold text-center">Lượt xem</th>
              <th className="p-4 font-semibold">Trạng thái</th>
              <th className="p-4 font-semibold">Ngày tạo</th>
              <th className="p-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Chưa có bài viết nào phù hợp.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post._id.toString()} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedIds.includes(post._id.toString())}
                      onChange={() => handleSelectOne(post._id.toString())}
                    />
                  </td>
                  <td className="p-4 font-medium text-gray-800">
                    <div>{post.title}</div>
                    {!isAuthor && post.author && (
                      <div className="text-xs text-gray-500 font-normal mt-1">bởi {post.author.name}</div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-500 text-sm">
                      <Eye size={16} />
                      <span>{post.views || 0}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {(post.status === "published" || post.published === true) && (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">Xuất bản</span>
                    )}
                    {post.status === "pending" && (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">Chờ duyệt</span>
                    )}
                    {(post.status === "draft" || (!post.status && !post.published)) && (
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">Bản nháp</span>
                    )}
                    {post.status === "rejected" && (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap" title={post.rejectionReason}>Từ chối</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <a href={`/api/posts/${post.slug}/export?format=word`} className="text-emerald-500 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded" title="Xuất Word">
                        <FileText size={18} />
                      </a>
                      <button onClick={() => handleExportPDF(post)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded" title="Xuất PDF">
                        <FileDown size={18} />
                      </button>
                      <Link href={`/posts/edit/${post._id}`} className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded" title="Sửa bài viết">
                        <Edit size={18} />
                      </Link>
                      <DeletePostButton postId={post._id.toString()} />
                    </div>
                    {!isAuthor && post.status === "pending" && (
                      <div className="mt-2">
                         <PostModerationActions postId={post._id.toString()} status={post.status} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
