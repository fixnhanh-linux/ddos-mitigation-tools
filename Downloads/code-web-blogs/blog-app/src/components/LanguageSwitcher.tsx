"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition text-sm font-medium text-slate-600">
        <Globe size={16} />
        <span className="uppercase">{lang}</span>
      </button>
      
      <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="p-2 flex flex-col gap-1">
          <button 
            onClick={() => setLang('vi')}
            className={`text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 transition ${lang === 'vi' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button 
            onClick={() => setLang('en')}
            className={`text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 transition ${lang === 'en' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}
          >
            🇺🇸 English
          </button>
          <button 
            onClick={() => setLang('ja')}
            className={`text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 transition ${lang === 'ja' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}
          >
            🇯🇵 日本語
          </button>
        </div>
      </div>
    </div>
  );
}
