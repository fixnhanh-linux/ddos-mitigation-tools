"use client";

import { useState } from "react";
import ReadingCustomizer, { ReadingSettings } from "./ReadingCustomizer";

export default function ClientReadingWrapper({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReadingSettings | null>(null);

  const containerClasses = settings 
    ? `${settings.fontSize} ${settings.fontFamily} ${settings.lineHeight}` 
    : "text-lg font-sans leading-relaxed";

  return (
    <div className="relative">
      {/* Nút tuỳ chỉnh nổi */}
      <div className="absolute -top-16 right-0 z-10">
        <ReadingCustomizer onSettingsChange={setSettings} />
      </div>
      
      {/* Nội dung bài viết */}
      <div className={`transition-all duration-300 ${containerClasses}`}>
        {children}
      </div>
    </div>
  );
}
