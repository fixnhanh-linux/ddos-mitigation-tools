"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, User } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";

export default function UserMenu({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session) {
    return (
      <Link href="/api/auth/signin" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition">
        {t.login}
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition"
      >
        {session.user?.avatar || session.user?.image ? (
          <img src={session.user.avatar || session.user.image} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
            {session.user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-slate-50 mb-2">
            <p className="font-bold text-slate-900 truncate">{session.user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{session.user?.email}</p>
          </div>
          {session.user?.role !== "user" && (
            <Link href="/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              <LayoutDashboard size={16} />
              {t.dashboard}
            </Link>
          )}
          <Link href="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
            <User size={16} />
            {t.profile}
          </Link>
          
          <div className="h-px bg-slate-50 my-2"></div>
          
          <button onClick={() => { setIsOpen(false); signOut({ callbackUrl: "/" }); }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
            <LogOut size={16} />
            {t.logout}
          </button>
        </div>
      )}
    </div>
  );
}
