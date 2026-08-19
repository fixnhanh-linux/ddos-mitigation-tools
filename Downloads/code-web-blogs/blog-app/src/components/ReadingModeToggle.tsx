"use client";

import { useState } from "react";
import { Maximize, Minimize } from "lucide-react";

export default function ReadingModeToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Lỗi khi vào chế độ toàn màn hình: ${err.message}`);
      });
      setIsFullscreen(true);
      // Optional: Add a class to body to hide header/footer in full screen reading mode
      document.body.classList.add("reading-mode");
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
        document.body.classList.remove("reading-mode");
      }
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className="fixed bottom-24 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all z-50 hover:scale-110 flex items-center justify-center group"
      title="Chế độ đọc toàn màn hình"
    >
      {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-lg">
        {isFullscreen ? "Thoát toàn màn hình" : "Đọc toàn màn hình"}
      </span>
    </button>
  );
}
