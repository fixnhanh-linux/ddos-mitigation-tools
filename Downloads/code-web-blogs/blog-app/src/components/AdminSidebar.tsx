"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, FileText, FolderOpen, Tag, Image as ImageIcon, 
  MessageSquare, Users, Settings, LogOut, ShieldAlert,
  ChevronLeft, ChevronRight, Mail, X, Globe
} from 'lucide-react';
import { useEffect } from "react";

interface AdminSidebarProps {
  isAuthor: boolean;
}

export default function AdminSidebar({ isAuthor }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  // Listen to sidebar toggle event and path changes
  useEffect(() => {
    const handleToggle = () => setIsMobileOpen(prev => !prev);
    window.addEventListener("toggle-admin-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-admin-sidebar", handleToggle);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Tổng quan", section: "Tổng quan" },
    { type: "divider", label: "Nội dung" },
    { href: "/posts", icon: FileText, label: "Bài viết" },
    { href: "/crawl", icon: Globe, label: "Crawl Bài Viết" },
    { href: "/media", icon: ImageIcon, label: "Đa phương tiện" },
    { href: "/pages", icon: FileText, label: "Trang tĩnh", hidden: isAuthor },
    { href: "/categories", icon: Tag, label: "Chuyên mục", hidden: isAuthor },
    { href: "/comments", icon: MessageSquare, label: "Bình luận" },
    { href: "/messages", icon: MessageSquare, label: "Tin nhắn" },
    { href: "/subscribers", icon: Mail, label: "Bản tin", hidden: isAuthor },
    { type: "divider", label: "Hệ thống", hidden: isAuthor },
    { href: "/staff", icon: Users, label: "Nhân sự", hidden: isAuthor },
    { href: "/customers", icon: Users, label: "Khách hàng", hidden: isAuthor },
    { href: "/appearance", icon: LayoutDashboard, label: "Giao diện", hidden: isAuthor },
    { href: "/marketing", icon: Tag, label: "SEO & Marketing", hidden: isAuthor },
    { href: "/monetization", icon: FolderOpen, label: "Kiếm tiền", hidden: isAuthor },
    { href: "/audit-logs", icon: ShieldAlert, label: "Audit Logs", hidden: isAuthor },
    { href: "/settings", icon: Settings, label: "Cài đặt hệ thống", hidden: isAuthor },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity cursor-pointer"
        />
      )}

      <aside className={`
        bg-slate-900 text-white flex flex-col transition-all duration-300 relative shrink-0
        fixed lg:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        w-64
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Collapse button - only desktop */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-6 bg-indigo-600 text-white rounded-full p-1 shadow-lg z-10 hover:bg-indigo-700 transition"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="p-6 flex items-center justify-between h-20">
          {!isCollapsed ? (
            <h1 className="text-2xl font-bold tracking-wider text-nowrap truncate">CMS Admin</h1>
          ) : (
            <h1 className="text-xl font-bold tracking-wider text-indigo-400">CMS</h1>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item, index) => {
          if (item.hidden) return null;

          if (item.type === "divider") {
            return (
              <div key={index} className="pt-4 pb-1">
                {!isCollapsed ? (
                  <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</p>
                ) : (
                  <div className="h-px bg-slate-800 mx-3 my-2" />
                )}
              </div>
            );
          }

          const isActive = pathname === item.href;
          const Icon = item.icon as any;

          return (
            <Link 
              key={item.href} 
              href={item.href!} 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                isActive 
                  ? "bg-indigo-600 text-white" 
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className={`flex w-full items-center gap-3 px-3 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition ${isCollapsed ? 'justify-center' : ''}`} 
          title={isCollapsed ? "Đăng xuất" : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
      </aside>
    </>
  );
}
