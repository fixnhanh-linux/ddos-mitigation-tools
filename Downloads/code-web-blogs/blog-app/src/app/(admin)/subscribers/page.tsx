"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Trash2, Search, Download, Users, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface Subscriber {
  _id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/newsletter?${params}`);
      const data = await res.json();
      setSubscribers(data.subscribers || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchSubscribers, 300);
    return () => clearTimeout(t);
  }, [fetchSubscribers]);

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa subscriber này?")) return;
    setDeleting(true);
    await fetch("/api/newsletter", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchSubscribers();
    setDeleting(false);
  };

  const handleDeleteSelected = async () => {
    if (!selected.size || !confirm(`Xóa ${selected.size} subscriber đã chọn?`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id =>
      fetch("/api/newsletter", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    ));
    setSelected(new Set());
    fetchSubscribers();
    setDeleting(false);
  };

  const exportCSV = () => {
    const rows = [["Email", "Trạng thái", "Ngày đăng ký"], ...subscribers.map(s => [s.email, s.active ? "Active" : "Inactive", new Date(s.createdAt).toLocaleDateString("vi-VN")])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "subscribers.csv"; a.click();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === subscribers.length ? new Set() : new Set(subscribers.map(s => s._id)));
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Người đăng ký bản tin</h1>
          <p className="text-slate-500 mt-1">Quản lý danh sách khách hàng đăng ký nhận newsletter.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
            <Download size={16} /> Xuất CSV
          </button>
          {selected.size > 0 && (
            <button onClick={handleDeleteSelected} disabled={deleting} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-60">
              <Trash2 size={16} /> Xóa {selected.size} mục
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Users size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-sm text-slate-500">Tổng đăng ký</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{subscribers.filter(s => s.active).length}</p>
            <p className="text-sm text-slate-500">Đang hoạt động</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center"><XCircle size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{subscribers.filter(s => !s.active).length}</p>
            <p className="text-sm text-slate-500">Không hoạt động</p>
          </div>
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo email..."
              className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button onClick={fetchSubscribers} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 transition text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left">
                  <input type="checkbox" checked={selected.size === subscribers.length && subscribers.length > 0} onChange={toggleAll} className="rounded text-indigo-600" />
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày đăng ký</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="w-4 h-4 bg-slate-200 rounded" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-48" /></td>
                    <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded-full w-20" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="px-5 py-4"><div className="h-8 bg-slate-200 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400">
                    <Mail size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Chưa có ai đăng ký bản tin</p>
                    <p className="text-xs mt-1">Khi có khách đăng ký, danh sách sẽ hiện ở đây.</p>
                  </td>
                </tr>
              ) : subscribers.map(sub => (
                <tr key={sub._id} className="hover:bg-slate-50 transition group">
                  <td className="px-5 py-4">
                    <input type="checkbox" checked={selected.has(sub._id)} onChange={() => toggleSelect(sub._id)} className="rounded text-indigo-600" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {sub.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800">{sub.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {sub.active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 rounded-full">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> Đã hủy
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{new Date(sub.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => handleDelete(sub._id)} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Tổng: <span className="font-semibold text-slate-800">{total}</span> người đăng ký</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition">‹</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 rounded-lg border transition ${p === page ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition">›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
