"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token2fa, setToken2fa] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [showEmailOTP, setShowEmailOTP] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Load saved email if exists
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload: any = { email, password, rememberMe: rememberMe.toString(), redirect: false };
      if (showEmailOTP) payload.otp = emailOtp;
      if (show2FA) payload.token2fa = token2fa;

      // Handle localStorage
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      if (!showEmailOTP) {
        if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captchaToken) {
          setError("Vui lòng xác nhận bạn không phải người máy (Captcha).");
          setIsLoading(false);
          return;
        }

        // Yêu cầu gửi mã OTP
        const reqOtp = await fetch("/api/auth/login-otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, captchaToken })
        });
        const reqOtpData = await reqOtp.json();
        
        if (reqOtp.ok) {
           if (reqOtpData.otpBypassed) {
              const res = await signIn("credentials", payload);
              if (res?.error) {
                 setError(res.error);
              } else {
                 await fetch("/api/auth/trust-device", { method: "POST" });
                 router.push("/dashboard");
                 router.refresh();
              }
              setIsLoading(false);
              return;
           } else {
              setShowEmailOTP(true);
              setCooldown(50);
              setError("");
           }
        } else {
           setError(reqOtpData.error || "Không thể gửi mã OTP.");
        }
        setIsLoading(false);
        return;
      }

      const res = await signIn("credentials", payload);

      if (res?.error) {
        if (res.error === "2FA_REQUIRED") {
          setShow2FA(true);
          setError("Vui lòng nhập mã xác thực 2 bước (Google Authenticator).");
        } else if (res.error === "INVALID_2FA") {
          setError("Mã xác thực không hợp lệ. Vui lòng thử lại.");
        } else if (res.error === "OTP_REQUIRED") {
          setShowEmailOTP(true);
          setError("Vui lòng nhập mã OTP được gửi qua email.");
        } else if (res.error === "CredentialsSignin" || res.error === "Signin") {
          setError("Email hoặc mật khẩu không chính xác!");
        } else {
          setError(res.error);
        }
      } else {
        await fetch("/api/auth/trust-device", { method: "POST" });
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Đã xảy ra lỗi hệ thống.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setCooldown(50);
      } else {
        setError(data.error || "Không thể gửi lại mã OTP.");
      }
    } catch {
      setError("Đã xảy ra lỗi.");
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
          {/* Grid icon decorative */}
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
            Hệ thống quản trị<br />
            <span className="text-indigo-200">chuyên nghiệp</span>
          </h2>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Quản lý bài viết, độc giả và nội dung website của bạn một cách thông minh và hiệu quả.
          </p>
          {/* Feature list */}
          <div className="space-y-3 text-left">
            {["Quản lý bài viết & media", "Phân tích lưu lượng truy cập", "Tích hợp SEO & Marketing"].map((f) => (
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center space-y-2">
            <Link href="/" className="inline-block text-3xl font-black text-indigo-600 tracking-tighter hover:text-indigo-700 transition">
              Fix Nhanh.
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">Chào mừng trở lại!</h1>
            <p className="text-slate-500 text-sm">Đăng nhập để truy cập trang quản trị</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 space-y-6">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-100 animate-in slide-in-from-top duration-300">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!showEmailOTP && !show2FA ? (
                <>
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
                        placeholder="admin@example.com"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
                      <Link href="/auth/forgot-password" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Quên mật khẩu?</Link>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
                        placeholder="••••••••"
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

                  {/* Remember Me */}
                  <div className="flex items-center">
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-700 font-medium">
                      Ghi nhớ đăng nhập
                    </label>
                  </div>
                </>
              ) : showEmailOTP && !show2FA ? (
                /* Email OTP */
                <div className="space-y-3 animate-in slide-in-from-bottom duration-400">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Mail size={20} className="text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">Xác thực Email</p>
                      <p className="text-xs text-indigo-600 mt-0.5">Chúng tôi đã gửi mã 6 số đến {email}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Mã xác thực (OTP)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full py-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono text-3xl tracking-[0.5em] transition bg-white text-slate-900 placeholder:text-slate-300"
                      placeholder="------"
                      autoComplete="off"
                      autoFocus
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={cooldown > 0 || isLoading}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition"
                      >
                        {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã OTP"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* 2FA */
                <div className="space-y-3 animate-in slide-in-from-bottom duration-400">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <ShieldCheck size={20} className="text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">Xác thực 2 bước</p>
                      <p className="text-xs text-indigo-600 mt-0.5">Mở Google Authenticator và nhập mã 6 số</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Mã xác thực (2FA)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={token2fa}
                      onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, ""))}
                      className="w-full py-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono text-3xl tracking-[0.5em] transition bg-white text-slate-900 placeholder:text-slate-300"
                      placeholder="------"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Captcha */}
              {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !showEmailOTP && !show2FA && (
                <div className="flex justify-center pt-2 pb-1">
                  <ReCAPTCHA
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
                    onChange={(token) => setCaptchaToken(token)}
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                ) : show2FA || showEmailOTP ? (
                  <><ShieldCheck size={16} /> Xác thực & Đăng nhập</>
                ) : (
                  <>Đăng nhập <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium">HOẶC ĐĂNG NHẬP BẰNG</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold rounded-xl shadow-sm transition-all hover:-translate-y-0.5 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>

          {/* Signup link */}
          <p className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
            Chưa có tài khoản?{" "}
            <Link href="/auth/signup" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
              Đăng ký ngay
            </Link>
          </p>

          {/* Back link */}
          <p className="text-center text-sm text-slate-500 mt-4">
            <Link href="/" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
              ← Quay lại trang chủ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
