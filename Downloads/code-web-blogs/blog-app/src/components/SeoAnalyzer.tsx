"use client";

import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface SeoAnalyzerProps {
  title: string;
  excerpt: string;
  content: string;
}

export default function SeoAnalyzer({ title, excerpt, content }: SeoAnalyzerProps) {
  const [siteTitle, setSiteTitle] = useState("Tên Website");

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const titleSetting = data.find((s: any) => s.key === 'site_title');
        if (titleSetting?.value) {
          setSiteTitle(titleSetting.value);
        }
      })
      .catch(() => {});
  }, []);

  // Strip HTML from content for word count
  const plainTextContent = content.replace(/<[^>]+>/g, "");
  const wordCount = plainTextContent.split(/\s+/).filter((w) => w.length > 0).length;

  const seoChecks = useMemo(() => {
    return [
      {
        label: "Độ dài Tiêu đề",
        status: title.length >= 40 && title.length <= 60 ? "good" : title.length > 60 ? "error" : "warning",
        message: title.length === 0 ? "Chưa có tiêu đề." : `Hiện tại: ${title.length} ký tự. Khuyên dùng: 40-60 ký tự.`,
      },
      {
        label: "Độ dài Tóm tắt (Meta Description)",
        status: excerpt.length >= 120 && excerpt.length <= 160 ? "good" : excerpt.length > 160 ? "error" : "warning",
        message: excerpt.length === 0 ? "Chưa có tóm tắt." : `Hiện tại: ${excerpt.length} ký tự. Khuyên dùng: 120-160 ký tự.`,
      },
      {
        label: "Độ dài Nội dung",
        status: wordCount >= 600 ? "good" : wordCount >= 300 ? "warning" : "error",
        message: `Hiện tại: ${wordCount} từ. Khuyên dùng: Tối thiểu 600 từ.`,
      },
      {
        label: "Chứa từ khóa trong Tiêu đề",
        status: title.length > 0 ? "good" : "warning",
        message: "Hãy đảm bảo tiêu đề chứa từ khóa chính của bài.",
      }
    ];
  }, [title, excerpt, wordCount]);

  const goodCount = seoChecks.filter((c) => c.status === "good").length;
  const scoreColor = goodCount >= 3 ? "text-emerald-500" : goodCount >= 2 ? "text-amber-500" : "text-rose-500";

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Phân tích SEO</h3>
        <div className={`text-2xl font-black ${scoreColor}`}>
          {Math.round((goodCount / seoChecks.length) * 100)}/100
        </div>
      </div>

      <div className="mb-8">
        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Xem trước trên Google</h4>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm max-w-[600px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">N</div>
            <div>
              <div className="text-[12px] text-slate-800 dark:text-slate-300">{siteTitle}</div>
              <div className="text-[11px] text-slate-500 truncate">https://yoursite.com/posts/...</div>
            </div>
          </div>
          <div className="text-[18px] text-[#1a0dab] dark:text-[#8ab4f8] cursor-pointer hover:underline truncate mb-1">
            {title || "Tiêu đề bài viết sẽ hiển thị ở đây"}
          </div>
          <div className="text-[13px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-[1.58]">
            {excerpt || "Mô tả bài viết (Meta Description) sẽ hiển thị ở đây. Hãy viết một đoạn tóm tắt hấp dẫn để thu hút người đọc click vào bài viết của bạn."}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {seoChecks.map((check, index) => (
          <div key={index} className="flex gap-3">
            <div className="mt-0.5">
              {check.status === "good" && <CheckCircle2 size={18} className="text-emerald-500" />}
              {check.status === "warning" && <AlertCircle size={18} className="text-amber-500" />}
              {check.status === "error" && <XCircle size={18} className="text-rose-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{check.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{check.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
