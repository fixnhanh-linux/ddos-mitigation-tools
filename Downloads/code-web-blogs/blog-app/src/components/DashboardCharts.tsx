"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import { TrendingUp, Eye, BarChart2, Calendar } from "lucide-react";

interface ChartData {
  date: string;
  views: number;
}

interface TopPost {
  _id: string;
  title: string;
  slug: string;
  views: number;
  coverImage?: string;
}

interface Props {
  data7: ChartData[];
  data14: ChartData[];
  data30: ChartData[];
  topPosts: TopPost[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-xl p-3 text-sm">
        <p className="font-bold text-slate-700 mb-1">{label}</p>
        <p className="text-indigo-600 font-semibold">
          <span className="text-slate-500 font-normal">Lượt xem: </span>
          {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const PERIODS = [
  { label: "7 ngày", value: 7 },
  { label: "14 ngày", value: 14 },
  { label: "30 ngày", value: 30 },
];

const BAR_COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

export default function DashboardCharts({ data7, data14, data30, topPosts }: Props) {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  const data = period === 7 ? data7 : period === 14 ? data14 : data30;
  const totalViews = data.reduce((sum, d) => sum + d.views, 0);
  const avgViews = data.length ? Math.round(totalViews / data.length) : 0;
  const maxDay = data.reduce((max, d) => d.views > max.views ? d : max, { date: "-", views: 0 });

  return (
    <div className="space-y-6">
      {/* === Chart: Lượt truy cập === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Biểu đồ Lượt truy cập</h3>
              <p className="text-sm text-slate-500">Thống kê lượt xem theo ngày</p>
            </div>
          </div>
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value as 7 | 14 | 30)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  period === p.value
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Calendar size={12} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-indigo-700">{totalViews.toLocaleString()}</p>
            <p className="text-xs text-indigo-500 font-medium mt-0.5">Tổng lượt xem</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{avgViews.toLocaleString()}</p>
            <p className="text-xs text-emerald-500 font-medium mt-0.5">Trung bình/ngày</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-amber-700 truncate">{maxDay.views > 0 ? maxDay.date : "-"}</p>
            <p className="text-xs text-amber-500 font-medium mt-0.5">Ngày cao nhất ({maxDay.views})</p>
          </div>
        </div>

        {/* Area chart */}
        {data.length === 0 ? (
          <div className="h-64 bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-200">
            <div className="text-center">
              <Eye size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-slate-400 text-sm font-medium">Chưa có đủ dữ liệu</p>
            </div>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  dy={8}
                  interval={period === 30 ? 4 : period === 14 ? 1 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Lượt xem"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fill="url(#viewsGrad)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#4f46e5" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* === Top bài đọc nhiều nhất === */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <BarChart2 size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Top bài đọc nhiều nhất</h3>
            <p className="text-sm text-slate-500">Dựa trên lượt truy cập thực tế 30 ngày qua</p>
          </div>
        </div>

        {topPosts.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Chưa có đủ dữ liệu</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topPosts.slice(0, 5).map(p => ({ name: p.title.substring(0, 20) + (p.title.length > 20 ? "..." : ""), views: p.views }))}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} width={120} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="views" name="Lượt xem" radius={[0, 6, 6, 0]}>
                    {topPosts.slice(0, 5).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index] || "#e0e7ff"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* List ranking */}
            <div className="space-y-3">
              {topPosts.slice(0, 5).map((post, i) => (
                <a
                  key={post._id}
                  href={`/posts/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 group hover:bg-slate-50 -mx-2 px-2 py-2 rounded-xl transition"
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                    style={{ backgroundColor: BAR_COLORS[i] || "#e0e7ff" }}
                  >
                    {i + 1}
                  </span>
                  {post.coverImage && (
                    <img src={post.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition">
                      {post.title}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Eye size={10} /> {post.views.toLocaleString()} lượt xem
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-indigo-600">{post.views.toLocaleString()}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
