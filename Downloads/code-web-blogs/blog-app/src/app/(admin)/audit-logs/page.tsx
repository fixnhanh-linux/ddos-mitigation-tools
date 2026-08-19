"use client";

import { Search, Activity, ShieldAlert, LogIn, FileEdit, Trash2, Download, Settings } from "lucide-react";
import { useState, useEffect } from "react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (type) params.append("type", type);
      if (date) params.append("date", date);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [search, type, date]);

  const getIcon = (type: string) => {
    switch(type) {
      case 'login': return <LogIn size={16} className="text-blue-500" />;
      case 'create': return <FileEdit size={16} className="text-emerald-500" />;
      case 'edit': return <FileEdit size={16} className="text-amber-500" />;
      case 'delete': return <Trash2 size={16} className="text-red-500" />;
      case 'security': return <ShieldAlert size={16} className="text-purple-500" />;
      case 'system': return <Settings size={16} className="text-slate-500" />;
      default: return <Activity size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nhật ký hoạt động (Audit Trails)</h1>
          <p className="text-slate-500 mt-1">Truy vết chi tiết mọi thao tác của người dùng trên hệ thống.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition shadow-sm w-fit">
          <Download size={18} />
          <span>Xuất báo cáo (CSV)</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Bộ lọc */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm theo user, thao tác, hoặc IP..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-slate-700">
            <option value="">Tất cả hoạt động</option>
            <option value="login">Đăng nhập</option>
            <option value="create">Tạo mới</option>
            <option value="edit">Chỉnh sửa</option>
            <option value="delete">Xóa</option>
            <option value="system">Cấu hình hệ thống</option>
            <option value="security">Cảnh báo bảo mật</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-slate-700" />
        </div>

        {/* Bảng Log */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Thời gian</th>
                <th className="px-6 py-4 font-semibold">Người dùng</th>
                <th className="px-6 py-4 font-semibold">Thao tác (Action)</th>
                <th className="px-6 py-4 font-semibold">Địa chỉ IP</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Đang tải dữ liệu...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Không tìm thấy nhật ký nào</td></tr>
              ) : logs.map(log => (
                <tr key={log._id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                    {log.userName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getIcon(log.type)}
                      <span className="text-slate-700">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {log.ip === "::1" || log.ip === "::ffff:127.0.0.1" ? "127.0.0.1" : (log.ip || "Unknown IP")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.status === "success" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        Thành công
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Thất bại
                      </span>
                    )}
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
