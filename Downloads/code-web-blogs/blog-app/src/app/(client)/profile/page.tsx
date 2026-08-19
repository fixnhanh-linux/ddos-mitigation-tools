"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Bookmark, History, MessageSquare, Settings, LogOut, Loader2, KeyRound, Save, Heart } from "lucide-react";
import toast from "react-hot-toast";
import DonationWidget from "@/components/DonationWidget";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  
  const [profileData, setProfileData] = useState({ name: "", phone: "", bio: "", avatar: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (status === "authenticated") {
        try {
          const res = await fetch("/api/user/profile");
          if (res.ok) {
            const data = await res.json();
            setProfileData({
              name: data.name || "",
              phone: data.phone || "",
              bio: data.bio || "",
              avatar: data.avatar || session?.user?.image || ""
            });
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    };
    
    const fetchDashboardData = async () => {
      if (status === "authenticated") {
        setIsFetchingData(true);
        try {
          const [bRes, hRes, cRes] = await Promise.all([
            fetch("/api/user/bookmarks"),
            fetch("/api/user/history"),
            fetch("/api/user/comments")
          ]);
          if (bRes.ok) setBookmarks(await bRes.json());
          if (hRes.ok) setHistory(await hRes.json());
          if (cRes.ok) setComments(await cRes.json());
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsFetchingData(false);
        }
      }
    };

    fetchProfile();
    fetchDashboardData();
  }, [status, session]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          bio: profileData.bio,
          avatar: profileData.avatar
        }),
      });
      if (res.ok) {
        toast.success("Cập nhật thông tin thành công!");
      } else {
        toast.error("Có lỗi xảy ra, vui lòng thử lại.");
      }
    } catch (error) {
      toast.error("Lỗi kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfileData({ ...profileData, avatar: data.url });
        toast.success("Tải ảnh lên thành công! Nhớ bấm Lưu thay đổi nhé.");
      } else {
        toast.error("Tải ảnh thất bại.");
      }
    } catch (error) {
      toast.error("Lỗi kết nối.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Hồ sơ cá nhân", icon: User },
    { id: "bookmarks", label: "Bài viết đã lưu", icon: Bookmark },
    { id: "history", label: "Lịch sử đọc", icon: History },
    { id: "comments", label: "Bình luận của tôi", icon: MessageSquare },
    { id: "donate", label: "Ủng hộ tác giả", icon: Heart },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                  {profileData.avatar ? (
                    <img src={profileData.avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover shadow-md border-2 border-slate-200" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-md border-2 border-slate-200">
                      {profileData.name.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 shadow-md">
                    {isUploadingAvatar ? <Loader2 className="animate-spin text-white" size={24} /> : <span className="text-white text-xs font-bold">Đổi ảnh</span>}
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                <h2 className="text-xl font-bold text-slate-800">{profileData.name}</h2>
                <p className="text-slate-500 text-sm mt-1">{session?.user?.email}</p>
                <span className={`mt-3 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                  (session?.user as any)?.role === "super-admin" ? "bg-purple-50 text-purple-600 border border-purple-200" :
                  (session?.user as any)?.role === "admin" ? "bg-red-50 text-red-600 border border-red-200" :
                  (session?.user as any)?.role === "editor" ? "bg-blue-50 text-blue-600 border border-blue-200" :
                  (session?.user as any)?.role === "author" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                  "bg-indigo-50 text-indigo-600"
                }`}>
                  {(session?.user as any)?.role === "super-admin" ? "Super Admin" :
                   (session?.user as any)?.role === "admin" ? "Admin" :
                   (session?.user as any)?.role === "editor" ? "Biên tập viên" :
                   (session?.user as any)?.role === "author" ? "Tác giả" :
                   "Thành viên"}
                </span>
              </div>
            </div>

            {/* Dashboard Link for Staff */}
            {(session?.user as any)?.role && (session?.user as any)?.role !== "user" && (
              <div className="mb-6">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-md transition text-sm"
                >
                  <Settings size={18} />
                  <span>Vào Trang Quản Trị</span>
                </Link>
              </div>
            )}

            <nav className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-6 py-4 text-left transition border-b border-slate-50 last:border-none ${
                      activeTab === tab.id 
                        ? "bg-indigo-50 text-indigo-600 border-l-4 border-l-indigo-600" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-l-4 border-l-transparent"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              
              {activeTab === "profile" && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <User className="text-indigo-600" />
                    Thông tin tài khoản
                  </h3>
                  <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Họ tên</label>
                        <input 
                          type="text" 
                          value={profileData.name}
                          onChange={e => setProfileData({...profileData, name: e.target.value})}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input 
                          type="email" 
                          value={session?.user?.email || ""}
                          disabled
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed" 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                        <input 
                          type="tel" 
                          value={profileData.phone}
                          onChange={e => setProfileData({...profileData, phone: e.target.value})}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                          placeholder="Chưa cập nhật"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Giới thiệu ngắn (Bio)</label>
                        <textarea 
                          rows={4}
                          value={profileData.bio}
                          onChange={e => setProfileData({...profileData, bio: e.target.value})}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" 
                          placeholder="Viết vài dòng giới thiệu về bạn..."
                        ></textarea>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-70"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Lưu Thay Đổi
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === "bookmarks" && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Bookmark className="text-indigo-600" />
                    Bài viết đã lưu
                  </h3>
                  {isFetchingData ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                  ) : bookmarks.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bookmark size={24} className="text-slate-400" />
                      </div>
                      <p>Bạn chưa lưu bài viết nào.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {bookmarks.map((b: any) => (
                        <div key={b._id} className="bg-white border border-slate-100 rounded-xl p-4 flex gap-4 hover:shadow-md transition">
                          <img src={b.post?.coverImage || '/placeholder.png'} alt={b.post?.title} className="w-24 h-24 object-cover rounded-lg" />
                          <div className="flex flex-col flex-1">
                            <Link href={`/posts/${b.post?.slug}`} className="font-bold text-slate-800 hover:text-indigo-600 line-clamp-2">
                              {b.post?.title}
                            </Link>
                            <p className="text-xs text-slate-400 mt-auto">Đã lưu: {new Date(b.createdAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <History className="text-indigo-600" />
                    Lịch sử đọc
                  </h3>
                  {isFetchingData ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History size={24} className="text-slate-400" />
                      </div>
                      <p>Chưa có lịch sử đọc gần đây.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {history.map((h: any) => (
                        <div key={h._id} className="bg-white border border-slate-100 rounded-xl p-4 flex gap-4 hover:shadow-md transition">
                          <img src={h.post?.coverImage || '/placeholder.png'} alt={h.post?.title} className="w-24 h-24 object-cover rounded-lg" />
                          <div className="flex flex-col flex-1">
                            <Link href={`/posts/${h.post?.slug}`} className="font-bold text-slate-800 hover:text-indigo-600 line-clamp-2">
                              {h.post?.title}
                            </Link>
                            <p className="text-xs text-slate-400 mt-auto">Đọc lúc: {new Date(h.viewedAt).toLocaleString('vi-VN')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "comments" && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <MessageSquare className="text-indigo-600" />
                    Bình luận của tôi
                  </h3>
                  {isFetchingData ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={24} className="text-slate-400" />
                      </div>
                      <p>Bạn chưa có bình luận nào.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((c: any) => (
                        <div key={c._id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-slate-500">
                              Bài viết: <Link href={`/posts/${c.post?.slug}`} className="text-indigo-600 hover:underline">{c.post?.title}</Link>
                            </span>
                            <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-slate-700 italic border-l-2 border-indigo-200 pl-3">"{c.content}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "donate" && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Heart className="text-indigo-600" />
                    Ủng hộ tác giả
                  </h3>
                  <div className="py-4">
                    <p className="text-slate-600 mb-8">
                      Cảm ơn bạn đã luôn đồng hành. Sự ủng hộ của bạn giúp website duy trì và phát triển thêm nhiều nội dung chất lượng hơn!
                    </p>
                    <DonationWidget />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
