"use client";

import { useState } from "react";
import { X, Globe, Search, Loader2 } from "lucide-react";

interface CrawlModalProps {
  onClose: () => void;
  onSuccess: (data: {
    title: string;
    content: string;
    excerpt: string;
    coverImage: string;
  }) => void;
}

export default function CrawlModal({ onClose, onSuccess }: CrawlModalProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError("Vui lòng nhập đường dẫn URL.");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("URL không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi lấy dữ liệu.");
      }

      onSuccess({
        title: data.title || "",
        content: data.content || "",
        excerpt: data.excerpt || "",
        coverImage: data.coverImage || "",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Globe className="text-blue-500" size={20} />
            Quét nội dung từ URL
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCrawl} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Đường dẫn bài viết (URL)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://vnexpress.net/..."
              className="w-full border border-slate-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-slate-500">
              Nhập link bài báo hoặc blog. Hệ thống sẽ tự động bóc tách tiêu đề, nội dung và ảnh bìa.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Đang lấy dữ liệu...
                </>
              ) : (
                <>
                  <Search size={16} /> Bắt đầu quét
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
