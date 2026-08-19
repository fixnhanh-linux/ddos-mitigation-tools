"use client";

import { Plus, Edit2, Trash2, Tag, Layers, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catParent, setCatParent] = useState("");
  const [isCatSaving, setIsCatSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [tagName, setTagName] = useState("");
  const [tagSlug, setTagSlug] = useState("");
  const [isTagSaving, setIsTagSaving] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resCat, resTag] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/tags")
      ]);
      if (resCat.ok) setCategories(await resCat.json());
      if (resTag.ok) setTags(await resTag.json());
    } catch (e) {
      toast.error("Lỗi khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper function to auto-generate slug
  const generateSlug = (text: string) => {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  };

  const handleCatNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCatName(e.target.value);
    setCatSlug(generateSlug(e.target.value));
  };

  const handleTagNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(e.target.value);
    setTagSlug(generateSlug(e.target.value));
  };

  const handleAddCategory = async () => {
    if (!catName || !catSlug) return toast.error("Vui lòng nhập tên và slug chuyên mục");
    setIsCatSaving(true);
    try {
      const url = editingCategory ? `/api/categories/${editingCategory._id}` : "/api/categories";
      const method = editingCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, slug: catSlug, parentId: catParent || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingCategory ? "Cập nhật chuyên mục thành công" : "Thêm chuyên mục thành công");
      resetCatForm();
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi lưu chuyên mục");
    } finally {
      setIsCatSaving(false);
    }
  };

  const handleAddTag = async () => {
    if (!tagName || !tagSlug) return toast.error("Vui lòng nhập tên và slug thẻ");
    setIsTagSaving(true);
    try {
      const url = editingTag ? `/api/tags/${editingTag._id}` : "/api/tags";
      const method = editingTag ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName, slug: tagSlug })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingTag ? "Cập nhật thẻ thành công" : "Thêm thẻ thành công");
      resetTagForm();
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi lưu thẻ");
    } finally {
      setIsTagSaving(false);
    }
  };

  const resetCatForm = () => {
    setCatName("");
    setCatSlug("");
    setCatParent("");
    setEditingCategory(null);
  };

  const resetTagForm = () => {
    setTagName("");
    setTagSlug("");
    setEditingTag(null);
  };

  const startEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCatName(cat.name.replace(/^---\s*/, "")); // Bỏ dấu --- nếu là danh mục con
    setCatSlug(cat.slug);
    setCatParent(cat.parentId || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditTag = (tag: any) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagSlug(tag.slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa chuyên mục này?")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Đã xóa chuyên mục");
      setCategories(categories.filter(c => c._id !== id));
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi xóa");
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa thẻ này?")) return;
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Lỗi khi xóa thẻ");
      toast.success("Đã xóa thẻ");
      setTags(tags.filter(t => t._id !== id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Build category tree for display
  const rootCategories = categories.filter(c => !c.parentId);
  const displayCategories: any[] = [];
  rootCategories.forEach(root => {
    displayCategories.push(root);
    const children = categories.filter(c => c.parentId === root._id);
    children.forEach(child => {
      displayCategories.push({ ...child, name: `--- ${child.name}` });
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Phân loại (Taxonomy)</h1>
          <p className="text-slate-500 mt-1">Quản lý Chuyên mục (Categories) và Thẻ (Tags).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cột Categories */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers size={20} />
              </div>
              <h2 className="font-semibold text-slate-800">{editingCategory ? "Sửa Chuyên mục" : "Thêm Chuyên mục mới"}</h2>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên chuyên mục</label>
              <input 
                type="text" 
                value={catName}
                onChange={handleCatNameChange}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                placeholder="Ví dụ: Lập trình" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đường dẫn tĩnh (Slug)</label>
              <input 
                type="text" 
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                placeholder="lap-trinh" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chuyên mục cha</label>
              <select 
                value={catParent}
                onChange={(e) => setCatParent(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">-- Trống --</option>
                {rootCategories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddCategory}
                disabled={isCatSaving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isCatSaving ? <Loader2 size={18} className="animate-spin" /> : (editingCategory ? "Cập nhật" : "Thêm Chuyên mục")}
              </button>
              {editingCategory && (
                <button onClick={resetCatForm} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition">
                  Hủy
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">Tên</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-center">Bài viết</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500"><Loader2 className="animate-spin mx-auto" /></td>
                  </tr>
                ) : displayCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500">Chưa có chuyên mục nào</td>
                  </tr>
                ) : displayCategories.map(c => (
                  <tr key={c._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{c.count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEditCategory(c)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteCategory(c._id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cột Tags */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                <Tag size={20} />
              </div>
              <h2 className="font-semibold text-slate-800">{editingTag ? "Sửa Thẻ (Tag)" : "Thêm Thẻ (Tag) mới"}</h2>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên thẻ</label>
              <input 
                type="text" 
                value={tagName}
                onChange={handleTagNameChange}
                className="w-full border-slate-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 text-sm" 
                placeholder="Ví dụ: Tutorial" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đường dẫn tĩnh (Slug)</label>
              <input 
                type="text" 
                value={tagSlug}
                onChange={(e) => setTagSlug(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 text-sm" 
                placeholder="tutorial" 
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddTag}
                disabled={isTagSaving}
                className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isTagSaving ? <Loader2 size={18} className="animate-spin" /> : (editingTag ? "Cập nhật" : "Thêm Thẻ")}
              </button>
              {editingTag && (
                <button onClick={resetTagForm} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition">
                  Hủy
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Danh sách Thẻ ({tags.length})</h3>
            {isLoading ? (
              <div className="text-center py-4 text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>
            ) : tags.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">Chưa có thẻ nào</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <div key={t._id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-sm transition-colors group">
                    <span className="font-medium text-slate-700">{t.name}</span>
                    <span className="text-xs text-slate-400 bg-slate-200 px-1.5 rounded-md">{t.count || 0}</span>
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditTag(t)} className="p-0.5 text-slate-400 hover:text-indigo-600"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteTag(t._id)} className="p-0.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
