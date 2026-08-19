"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

interface PageFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function PageForm({ initialData, isEdit }: PageFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [status, setStatus] = useState(initialData?.status || "draft");
  const [isSaving, setIsSaving] = useState(false);

  // Auto-generate slug from title if not editing and user hasn't typed a custom slug
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!isEdit && !initialData?.slug) {
      setSlug(
        newTitle
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
      );
    }
  };

  const handleSave = async () => {
    if (!title || !slug) {
      toast.error("Vui lòng nhập Tiêu đề và Đường dẫn");
      return;
    }

    setIsSaving(true);
    try {
      const url = isEdit ? `/api/pages/${initialData._id}` : "/api/pages";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, content, status }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi lưu trang");
      }

      toast.success(isEdit ? "Cập nhật thành công!" : "Tạo trang thành công!");
      router.push("/pages");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pages" className="p-2 bg-white rounded-full text-slate-500 hover:text-indigo-600 shadow-sm border border-slate-200 transition">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? "Chỉnh sửa trang" : "Tạo trang mới"}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Tiêu đề trang</label>
            <input 
              type="text" 
              value={title}
              onChange={handleTitleChange}
              placeholder="Ví dụ: Giới thiệu, Liên hệ..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Đường dẫn (Slug)</label>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-500 font-mono text-sm">/</span>
              <input 
                type="text" 
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="gioi-thieu"
                className="w-full px-4 py-2 border border-slate-300 rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Nội dung</label>
          <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[400px]">
            <RichTextEditor content={content} onChange={setContent} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700">Trạng thái:</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="draft">Bản nháp</option>
              <option value="published">Xuất bản</option>
            </select>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Lưu trang
          </button>
        </div>
      </div>
    </div>
  );
}
