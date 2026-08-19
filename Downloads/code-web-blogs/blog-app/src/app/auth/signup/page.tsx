"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Đăng ký thất bại!");
      } else {
        setSuccess("Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.");
        // Redirect to sign in after 2 seconds
        setTimeout(() => {
          router.push("/auth/signin");
        }, 2000);
      }
    } catch (err) {
      setError("Đã xảy ra lỗi hệ thống, vui lòng thử lại!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel – decorative */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 relative overflow-hidden items-center justify-center p-16">
        {/* Animated blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 text-white max-w-md text-center space-y-8">
          <div className="grid grid-cols-3 gap-3 w-fit mx-auto mb-8">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          <h2 className="text-4xl font-black leading-tight">
            Khám phá kiến thức<br />
            <span className="text-indigo-200">vô tận</span>
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Đăng ký tài khoản ngay hôm nay để trở thành một phần của cộng đồng chúng tôi.
          </p>
          {/* Feature list */}
          <div className="space-y-3 text-left">
            {["Đọc bài viết không giới hạn", "Bình luận và tương tác", "Lưu bài viết yêu thích"].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-indigo-100 text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 my-auto">
          {/* Logo */}
          <div className="text-center space-y-2">
            <Link href="/" className="inline-block text-3xl font-black text-indigo-600 tracking-tighter hover:text-indigo-700 transition">
              Fix Nhanh.
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">Tạo tài khoản mới</h1>
            <p className="text-slate-500 text-sm">Điền thông tin bên dưới để bắt đầu</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-100 animate-in slide-in-from-top duration-300">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-start gap-3 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium border border-emerald-100 animate-in slide-in-from-top duration-300">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Họ và tên</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Địa chỉ Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
                    placeholder="nguyenvana@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
                    placeholder="Ít nhất 6 ký tự"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
                    placeholder="Nhập lại mật khẩu"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || success.length > 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed text-sm mt-2"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Đang đăng ký...</>
                ) : (
                  <>Đăng ký tài khoản <ArrowRight size={16} /></>
                )}
              </button>
            </form>
            
            {/* Back link */}
            <p className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
              Đã có tài khoản?{" "}
              <Link href="/auth/signin" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
                Đăng nhập ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
