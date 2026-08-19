"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import SearchInput from "./SearchInput";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function ClientHeader({
  siteTitle,
  categories,
  session,
  translations
}: {
  siteTitle: string;
  categories: any[];
  session: any;
  translations: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md shadow-sm dark:shadow-slate-800/50 sticky top-0 z-50 border-b border-transparent dark:border-slate-800">
        <div className="max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter shrink-0 mr-4">
            {siteTitle}.
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">{translations.home}</Link>
            {categories.map((cat: any) => (
              <Link key={cat._id.toString()} href={`/category/${cat.slug}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">
                {cat.name}
              </Link>
            ))}
            <Link href="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">{translations.about}</Link>
            <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition whitespace-nowrap">{translations.contact}</Link>

            <div className="flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-4">
              <SearchInput />
              <ThemeToggle />
              <UserMenu session={session} />
            </div>
          </nav>

          {/* Mobile Header Buttons (visible on screens < md) */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <UserMenu session={session} />
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Mở menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 md:hidden animate-in fade-in duration-200">
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-900 p-6 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{siteTitle}</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg transition cursor-pointer"
                title="Đóng menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="w-full">
              <SearchInput />
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col gap-4 text-base font-semibold text-slate-700 dark:text-slate-300">
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition">{translations.home}</Link>
              
              <div className="border-t border-b border-slate-100 dark:border-slate-800 py-3 my-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-bold">Chuyên mục</span>
                <div className="flex flex-col gap-2.5 pl-2">
                  {categories.map((cat: any) => (
                    <Link key={cat._id.toString()} href={`/category/${cat.slug}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition text-sm">
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>

              <Link href="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition">{translations.about}</Link>
              <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition">{translations.contact}</Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
