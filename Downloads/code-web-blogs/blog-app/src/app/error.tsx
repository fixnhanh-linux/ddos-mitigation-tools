"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCcw } from "lucide-react";
import FadeIn from "@/components/FadeIn";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry in a real app
    console.error("Tên Website Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <FadeIn className="text-center max-w-lg">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 dark:opacity-30 animate-pulse rounded-full" />
            <AlertOctagon size={100} className="text-red-500 dark:text-red-400 relative z-10" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
          Lỗi Hệ thống cục bộ
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Hệ thống gặp sự cố trong quá trình xử lý yêu cầu của bạn. Đội ngũ kỹ thuật đã được thông báo ngầm.
          <br />
          Mã lỗi: <span className="font-mono text-sm bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-red-500">{error.message || "Unknown"}</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition shadow-lg shadow-red-200 dark:shadow-none"
          >
            <RotateCcw size={18} />
            Thử tải lại
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-full font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Về Trang chủ
          </Link>
        </div>
      </FadeIn>
    </div>
  );
}
