"use client";

import { FileText, Plus, Search, Edit2, Trash2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function PagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pages?search=${search}&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
      }
    } catch (error) {
      toast.error("Lỗi khi tải danh sách trang tĩnh");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [search, status]);

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá trang này?")) return;
    try {
      const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Đã xoá trang");
        setPages(pages.filter(p => p._id !== id));
      } else {
        toast.error("Lỗi khi xoá");
      }
    } catch (e) {
      toast.error("Lỗi kết nối");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trang tĩnh (Pages)</h1>
          <p className="text-slate-500 mt-1">Quản lý các trang thông tin cố định như Giới thiệu, Liên hệ, Chính sách.</p>
        </div>
        <Link href="/pages/new" className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm w-fit">
          <Plus size={18} />
          <span>Tạo trang mới</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Thanh công cụ */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm tiêu đề trang..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
          <select 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
          </select>
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Tiêu đề</th>
                <th className="px-6 py-4 font-semibold">Đường dẫn (URL)</th>
                <th className="px-6 py-4 font-semibold">Ngày tạo</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-center">Lượt xem</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="animate-spin mx-auto text-indigo-600 mb-2" size={32} />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Không tìm thấy trang tĩnh nào
                  </td>
                </tr>
              ) : pages.map((page) => (
                <tr key={page._id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{page.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200">
                      /{page.slug}
                      <Link href={`/${page.slug}`} target="_blank" className="hover:text-indigo-600"><ExternalLink size={12} /></Link>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(page.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-4">
                    {page.status === "published" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Đã xuất bản
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Bản nháp
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-600">
                    {page.views || 0}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <Link href={`/pages/${page._id}/edit`} title="Chỉnh sửa" className="p-2 text-slate-400 hover:text-indigo-600 transition">
                      <Edit2 size={16} />
                    </Link>
                    <button onClick={() => handleDelete(page._id)} title="Xóa" className="p-2 text-slate-400 hover:text-red-600 transition">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
