"use client";

import { useState, useEffect } from "react";
import { Type, Minus, Plus, Settings2, X } from "lucide-react";

export interface ReadingSettings {
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
}

const defaultSettings: ReadingSettings = {
  fontSize: "text-lg",
  fontFamily: "font-sans",
  lineHeight: "leading-relaxed",
};

const fontSizes = [
  { label: "Nhỏ", value: "text-base" },
  { label: "Vừa", value: "text-lg" },
  { label: "Lớn", value: "text-xl" },
  { label: "Rất lớn", value: "text-2xl" },
];

const fontFamilies = [
  { label: "Sans-serif", value: "font-sans" },
  { label: "Serif", value: "font-serif" },
  { label: "Monospace", value: "font-mono" },
];

const lineHeights = [
  { label: "Bình thường", value: "leading-normal" },
  { label: "Rộng", value: "leading-relaxed" },
  { label: "Rất rộng", value: "leading-loose" },
];

export default function ReadingCustomizer({ 
  onSettingsChange 
}: { 
  onSettingsChange: (settings: ReadingSettings) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("reading_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        onSettingsChange(parsed);
      } catch (e) {}
    } else {
      onSettingsChange(defaultSettings);
    }
    setMounted(true);
  }, [onSettingsChange]);

  const updateSetting = (key: keyof ReadingSettings, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
    localStorage.setItem("reading_settings", JSON.stringify(newSettings));
  };

  if (!mounted) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:shadow-md border border-slate-100 dark:border-slate-700 transition"
        title="Tuỳ chỉnh giao diện đọc"
      >
        <Type size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 p-4">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Settings2 size={16} /> Tuỳ chỉnh hiển thị
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Font Size */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Kích thước chữ</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                {fontSizes.map((fs) => (
                  <button
                    key={fs.value}
                    onClick={() => updateSetting("fontSize", fs.value)}
                    className={`py-1 text-sm font-medium rounded-md transition ${settings.fontSize === fs.value ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Phông chữ</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                {fontFamilies.map((ff) => (
                  <button
                    key={ff.value}
                    onClick={() => updateSetting("fontFamily", ff.value)}
                    className={`py-1.5 text-xs font-medium rounded-md transition ${ff.value} ${settings.fontFamily === ff.value ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                  >
                    {ff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Giãn dòng</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                {lineHeights.map((lh) => (
                  <button
                    key={lh.value}
                    onClick={() => updateSetting("lineHeight", lh.value)}
                    className={`py-1.5 text-xs font-medium rounded-md transition ${settings.lineHeight === lh.value ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                  >
                    {lh.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
