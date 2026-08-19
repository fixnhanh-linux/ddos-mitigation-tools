"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Bell, MessageCircle, User, Settings, LogOut, ChevronDown, ExternalLink, Menu } from "lucide-react";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";

export default function AdminHeader() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  // Lưu lại trạng thái tin nhắn trước đó để so sánh và hiện thông báo
  const prevContactsRef = useRef<any[]>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch avatar from profile API
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/profile")
      .then(r => r.json())
      .then(data => { if (data.avatar) setAvatarUrl(data.avatar); })
      .catch(() => {});
  }, [session]);

  // Fetch initial data and set up WebSocket
  useEffect(() => {
    if (!session?.user) return;
    
    // 1. Fetch dữ liệu ban đầu khi component mount
    const fetchInitialData = async () => {
      try {
        const res = await fetch("/api/messages/contacts");
        if (res.ok) {
          const data = await res.json();
          const newContacts = data.contacts || [];
          setContacts(newContacts);
          const totalUnread = newContacts.reduce((sum: number, contact: any) => sum + (contact.unread || 0), 0);
          setUnreadCount(totalUnread);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu ban đầu:", error);
      }
    };

    fetchInitialData();

    // 2. Khởi tạo và kết nối WebSocket
    // Phải "ping" API để đảm bảo server socket được chạy trước khi client kết nối
    fetch("/api/socket");

    const socket: Socket = io({
      path: "/api/socket",
      addTrailingSlash: false,
    });

    socket.on("connect", () => {
      console.log("✅ Admin connected to WebSocket");
    });

    // 3. Lắng nghe sự kiện "new_message"
    socket.on("new_message", (newMessage: any) => {
      // Khi có tin nhắn mới, fetch lại toàn bộ danh sách để cập nhật
      // Đây là cách đơn giản nhất, bạn có thể tối ưu bằng cách chỉ cập nhật contact liên quan
      fetchInitialData();

      // Hiển thị toast
      toast(
        (t) => (
          <div className="flex flex-col gap-1 cursor-pointer" onClick={() => { window.location.href = "/messages"; toast.dismiss(t.id); }}>
            <span className="font-semibold text-sm text-indigo-600">Tin nhắn mới từ {newMessage.authorName}</span>
            <span className="text-sm text-slate-700 truncate max-w-[200px]">{newMessage.content}</span>
          </div>
        ),
        { icon: '💬', duration: 5000 }
      );
    });

    // 4. Dọn dẹp khi component unmount
    return () => {
      socket.disconnect();
    };
  }, [session]);

  const unreadContacts = contacts.filter(c => c.unread > 0);
  const userRole = (session?.user as any)?.role;
  const roleName =
    userRole === "super-admin" ? "Super Admin" :
    userRole === "admin" ? "Quản trị viên" :
    userRole === "editor" ? "Biên tập viên" :
    userRole === "author" ? "Tác giả" : "Nhân viên";

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 md:px-8 py-4 flex justify-between items-center shrink-0 shadow-sm relative z-20">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu Button */}
        <button
          onClick={() => window.dispatchEvent(new Event("toggle-admin-sidebar"))}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg hover:text-indigo-600 transition cursor-pointer"
          title="Mở menu"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 truncate max-w-[150px] sm:max-w-none">
          Xin chào, {session?.user?.name || "Admin"}!
        </h2>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Chuông thông báo */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-full transition ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'}`}
          >
            <Bell size={22} className={unreadCount > 0 ? "animate-pulse" : ""} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 text-sm">Thông báo mới</h3>
                <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {unreadContacts.length > 0 ? (
                  unreadContacts.map(contact => (
                    <Link 
                      href="/messages" 
                      key={contact.id}
                      onClick={() => setShowNotifications(false)}
                      className="flex items-start gap-3 p-3 hover:bg-slate-50 border-b border-slate-50 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0">
                        {contact.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className="font-medium text-sm text-slate-800 truncate">{contact.name}</p>
                          <span className="text-xs text-slate-400 shrink-0">{contact.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{contact.lastMessage}</p>
                      </div>
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2 shrink-0"></div>
                    </Link>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-500">
                    <MessageCircle size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Bạn không có thông báo mới nào</p>
                  </div>
                )}
              </div>
              
              <Link 
                href="/messages"
                onClick={() => setShowNotifications(false)}
                className="block w-full text-center p-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition border-t border-slate-100 bg-slate-50"
              >
                Xem táº¥t cáº£ tin nháº¯n
              </Link>
            </div>
          )}
        </div>
        
        {/* Avatar with dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover shadow border-2 border-white ring-2 ring-indigo-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold uppercase shadow">
                {session?.user?.name?.charAt(0) || "A"}
              </div>
            )}
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${showProfileMenu ? "rotate-180" : ""}`} />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
              {/* Profile info */}
              <div className="p-4 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover shadow" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg uppercase shadow">
                    {session?.user?.name?.charAt(0) || "A"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{session?.user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
                  <span className={`mt-1 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    userRole === "super-admin" ? "bg-purple-100 text-purple-600" :
                    userRole === "admin" ? "bg-red-100 text-red-600" :
                    userRole === "editor" ? "bg-blue-100 text-blue-600" :
                    "bg-amber-100 text-amber-600"
                  }`}>{roleName}</span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-2">
                <Link href="/profile" onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <User size={16} />
                  <span>Hồ sơ cá nhân</span>
                  <ExternalLink size={12} className="ml-auto text-slate-400" />
                </Link>
                <Link href="/settings" onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <Settings size={16} />
                  <span>Cài đặt hệ thống</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 py-2">
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
