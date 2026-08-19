"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dictionaries } from "@/lib/dictionaries";

type Language = "vi" | "en" | "ja";
type Dictionary = typeof dictionaries.vi;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("vi");

  const router = useRouter();

  useEffect(() => {
    // Read from cookie first, fallback to localStorage
    const savedLang = document.cookie.replace(/(?:(?:^|.*;\s*)app_lang\s*\=\s*([^;]*).*$)|^.*$/, "$1") || localStorage.getItem("app_lang") as Language;
    if (savedLang && ["vi", "en", "ja"].includes(savedLang)) {
      setLangState(savedLang as Language);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("app_lang", newLang);
    document.cookie = `app_lang=${newLang}; path=/; max-age=31536000`;
    router.refresh();
  };

  const t = dictionaries[lang] || dictionaries.vi;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
