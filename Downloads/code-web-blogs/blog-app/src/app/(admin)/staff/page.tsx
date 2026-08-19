"use client";

import { useState, useEffect, useRef } from "react";
import { Users, UserPlus, Search, Edit2, Shield, Ban, Loader2, KeyRound, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  bio?: string;
  status: "active" | "banned";
  isVerified?: boolean;
  createdAt: string;
}

export default function StaffPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "editor", phone: "", bio: "", status: "active", avatar: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const currentUserEmail = session?.user?.email;
  const currentUserRole = (session?.user as any)?.role;

  const isTargetDisabled = (targetUser: UserData) => {
    if (targetUser.email === currentUserEmail) return true;
    if (currentUserRole === "admin") {
      if (targetUser.role === "admin" || targetUser.role === "super-admin") {
        return true;
      }
    }
    return false;
  };

  const isEditDisabled = (targetUser: UserData) => {
    if (targetUser.email === currentUserEmail) return false; // Self-edit is allowed!
    if (currentUserRole === "admin") {
      if (targetUser.role === "admin" || targetUser.role === "super-admin") {
        return true;
      }
    }
    return false;
  };

  const getDisabledReason = (targetUser: UserData) => {
    if (targetUser.email === currentUserEmail) return "Bạn không thể tự thay đổi vai trò hoặc trạng thái của mình";
    if (currentUserRole === "admin" && (targetUser.role === "admin" || targetUser.role === "super-admin")) {
      return "Admin không thể sửa tài khoản ngang hàng hoặc cao hơn";
    }
    return "";
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users?type=staff");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      toast.error("Lỗi khi tải danh sách nhân sự");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole }),
      });
      if (res.ok) {
        toast.success("Cập nhật quyền thành công!");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Đã thêm nhân sự mới!");
        setShowAddModal(false);
        setNewUser({ name: "", email: "", password: "", role: "editor", phone: "", bio: "", status: "active", avatar: "" });
        fetchUsers();
      } else {
        toast.error(data.error || "Lỗi khi thêm nhân sự");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUser._id,
          name: editUser.name,
          email: editUser.email,
          phone: editUser.phone,
          bio: editUser.bio,
          avatar: editUser.avatar,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Cập nhật thông tin thành công!");
        setShowEditModal(false);
        fetchUsers();
      } else {
        toast.error(data.error || "Lỗi khi cập nhật");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      if (res.ok) {
        toast.success("Cập nhật trạng thái thành công!");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (isEdit && editUser) {
          setEditUser({ ...editUser, avatar: data.url });
        } else {
          setNewUser({ ...newUser, avatar: data.url });
        }
        toast.success("Đã tải ảnh lên");
      } else throw new Error();
    } catch {
      toast.error("Lỗi khi tải ảnh");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword) return;
    
    setIsResetting(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTargetUser._id, password: newPassword }),
      });
      if (res.ok) {
        toast.success(`Đã đổi mật khẩu cho ${resetTargetUser.name}!`);
        setShowResetModal(false);
        setNewPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân sự "${userName}"? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        toast.success("Đã xóa nhân sự thành công!");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Không thể xóa nhân sự");
      }
    } catch (error) {
      toast.error("Lỗi kết nối");
    }
  };

  const handleVerifyUser = async (userId: string, userName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xác thực thủ công cho tài khoản "${userName}"?`)) {
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isVerified: true }),
      });
      if (res.ok) {
        toast.success("Xác thực nhân sự thành công!");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      toast.error("Lỗi mạng");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Nhân sự</h1>
          <p className="text-slate-500 mt-1">Phân quyền, cấp phép và quản trị thành viên hệ thống.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          <UserPlus size={18} />
          <span>Thêm Nhân sự</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nhân sự qua tên, email..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Đang tải danh sách nhân sự...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Thành viên</th>
                  <th className="px-6 py-4 font-semibold">Vai trò (Role)</th>
                  <th className="px-6 py-4 font-semibold">Trạng thái</th>
                  <th className="px-6 py-4 font-semibold text-right">Đổi quyền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Không tìm thấy nhân sự nào phù hợp.
                    </td>
                  </tr>
                ) : filteredUsers.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold uppercase overflow-hidden">
                          {u.avatar ? (
                            <img src={u.avatar} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            u.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {u.name}
                            {u.isVerified ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Đã xác thực
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                Chưa xác thực
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white shadow-sm ${u.role === "super-admin" ? "text-purple-600" : "text-slate-700"}`}>
                        {u.role === "super-admin" && <Shield size={12} className="text-purple-600" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {u.status === "banned" ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                            <Ban size={12} /> Bị khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Đang hoạt động
                          </span>
                        )}
                        <select 
                          className={`ml-2 border-none bg-transparent text-xs text-slate-400 hover:text-slate-700 cursor-pointer focus:ring-0 ${isTargetDisabled(u) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          value={u.status}
                          onChange={(e) => handleStatusChange(u._id, e.target.value)}
                          disabled={isTargetDisabled(u)}
                          title={getDisabledReason(u)}
                        >
                          <option value="active">Active</option>
                          <option value="banned">Ban</option>
                        </select>
                        
                        <div className="mt-1 flex items-center gap-2">
                          {u.isVerified ? (
                            <span className="text-[11px] text-emerald-600 font-medium">✓ Đã xác thực</span>
                          ) : (
                            <button 
                              onClick={() => handleVerifyUser(u._id, u.name)}
                              disabled={isTargetDisabled(u)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
                            >
                              Kích hoạt email
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <select 
                          className={`border border-slate-300 rounded-lg py-1.5 pl-3 pr-8 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 ${isTargetDisabled(u) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          disabled={isTargetDisabled(u)}
                          title={getDisabledReason(u)}
                        >
                          <option value="user">User</option>
                          <option value="author">Author</option>
                          <option value="editor">Editor</option>
                          {(currentUserRole === "super-admin" || u.role === "admin") && <option value="admin">Admin</option>}
                          {(currentUserRole === "super-admin" || u.role === "super-admin") && <option value="super-admin">Super Admin</option>}
                        </select>
                        <button 
                          onClick={() => { setEditUser(u); setShowEditModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => { setResetTargetUser(u); setShowResetModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Đổi mật khẩu"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          disabled={isTargetDisabled(u)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Xóa người dùng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Thêm nhân sự mới</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddUser} className="p-6">
              
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {newUser.avatar ? (
                      <img src={newUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 font-medium text-sm">No Image</span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Edit2 size={12} />}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                </div>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên *</label>
                  <input 
                    type="text" required
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input 
                    type="email" required
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                  <input 
                    type="tel"
                    value={newUser.phone}
                    onChange={e => setNewUser({...newUser, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu *</label>
                  <input 
                    type="password" required minLength={6}
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="******"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="author">Author</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                    <select 
                      value={newUser.status}
                      onChange={e => setNewUser({...newUser, status: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="active">Active (Đang HĐ)</option>
                      <option value="banned">Banned (Khóa)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giới thiệu (Bio)</label>
                  <textarea 
                    value={newUser.bio}
                    onChange={e => setNewUser({...newUser, bio: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                    placeholder="Vài dòng giới thiệu..."
                  ></textarea>
                </div>
              </div>
              
              <div className="pt-6 flex gap-3 justify-end border-t border-slate-100 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-70"
                >
                  {isSubmitting ? "Đang xử lý..." : "Lưu nhân sự"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Chỉnh sửa thông tin</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleEditUser} className="p-6">
              
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {editUser.avatar ? (
                      <img src={editUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 font-medium text-sm">No Image</span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={isUploading || isEditDisabled(editUser)}
                    className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Edit2 size={12} />}
                  </button>
                  <input type="file" ref={editFileInputRef} onChange={(e) => handleAvatarUpload(e, true)} accept="image/*" className="hidden" />
                </div>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên *</label>
                  <input 
                    type="text" required
                    value={editUser.name}
                    onChange={e => setEditUser({...editUser, name: e.target.value})}
                    disabled={isEditDisabled(editUser)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input 
                    type="email" required
                    value={editUser.email}
                    onChange={e => setEditUser({...editUser, email: e.target.value})}
                    disabled={isEditDisabled(editUser)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                  <input 
                    type="tel"
                    value={editUser.phone || ""}
                    onChange={e => setEditUser({...editUser, phone: e.target.value})}
                    disabled={isEditDisabled(editUser)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giới thiệu (Bio)</label>
                  <textarea 
                    value={editUser.bio || ""}
                    onChange={e => setEditUser({...editUser, bio: e.target.value})}
                    disabled={isEditDisabled(editUser)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none disabled:bg-slate-50 disabled:text-slate-500"
                  ></textarea>
                </div>
              </div>
              
              <div className="pt-6 flex gap-3 justify-end border-t border-slate-100 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || isEditDisabled(editUser)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-70"
                >
                  {isSubmitting ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && resetTargetUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Đổi Mật Khẩu</h3>
              <button onClick={() => { setShowResetModal(false); setNewPassword(""); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                Nhập mật khẩu mới cho tài khoản <strong className="text-slate-700">{resetTargetUser.name}</strong> ({resetTargetUser.email}):
              </p>
              <div>
                <input 
                  type="password" required minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                />
              </div>
              <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowResetModal(false); setNewPassword(""); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isResetting || newPassword.length < 6}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-70 flex items-center gap-2"
                >
                  {isResetting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  <span>Lưu mật khẩu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
