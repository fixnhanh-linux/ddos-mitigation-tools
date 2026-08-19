import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-10">

        {/* SVG minh họa tự vẽ */}
        <div className="relative w-80 h-64 mx-auto">
          <svg viewBox="0 0 400 280" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg404" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e7ff" />
                <stop offset="100%" stopColor="#c7d2fe" />
              </linearGradient>
              <linearGradient id="numGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Nền tròn mờ */}
            <ellipse cx="200" cy="240" rx="160" ry="20" fill="#e0e7ff" opacity="0.6" />

            {/* Số 404 lớn */}
            <text
              x="50%"
              y="55%"
              textAnchor="middle"
              fill="url(#numGrad)"
              fontSize="130"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              opacity="0.12"
            >404</text>

            {/* Tờ giấy bị vò */}
            <g transform="translate(130, 40) rotate(-8)">
              <rect x="0" y="0" width="140" height="180" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="2" />
              <rect x="0" y="0" width="140" height="28" rx="8" fill="#f1f5f9" />
              <rect x="0" y="20" width="140" height="8" fill="#f1f5f9" />
              <line x1="16" y1="50" x2="124" y2="50" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
              <line x1="16" y1="70" x2="110" y2="70" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
              <line x1="16" y1="90" x2="90" y2="90" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
              <line x1="16" y1="110" x2="115" y2="110" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
              <line x1="16" y1="130" x2="70" y2="130" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
              {/* Dấu X đỏ */}
              <circle cx="70" cy="155" r="20" fill="#fee2e2" />
              <line x1="60" y1="145" x2="80" y2="165" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
              <line x1="80" y1="145" x2="60" y2="165" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
            </g>

            {/* Kính lúp */}
            <g transform="translate(240, 120) rotate(20)" className="animate-bounce" style={{ animationDuration: '2s' }}>
              <circle cx="30" cy="30" r="28" fill="none" stroke="#6366f1" strokeWidth="8" />
              <circle cx="30" cy="30" r="18" fill="#e0e7ff" opacity="0.4" />
              <line x1="50" y1="50" x2="68" y2="68" stroke="#6366f1" strokeWidth="8" strokeLinecap="round" />
            </g>

            {/* Dấu chấm hỏi bay */}
            <text x="320" y="90" fontSize="42" fill="#6366f1" opacity="0.4" fontWeight="bold" className="animate-ping">?</text>
            <text x="40" y="100" fontSize="30" fill="#8b5cf6" opacity="0.3" fontWeight="bold">?</text>
          </svg>
        </div>

        {/* Text */}
        <div className="space-y-4">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            404
          </h1>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            Không tìm thấy trang!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            Trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không khả dụng.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
          >
            <Home size={18} />
            Về trang chủ
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 px-7 py-3.5 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl transition-all hover:-translate-y-0.5"
          >
            <Search size={18} />
            Tìm kiếm bài viết
          </Link>
        </div>

      </div>
    </div>
  );
}
