"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export default function VerifyGoogleOtpPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    // Check if session is loaded
    if (status === "loading") return;
    
    // If not logged in, redirect to login
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }

    // If already verified, redirect to dashboard
    if (session?.user && (session.user as any).isGoogleOtpVerified === true) {
      router.replace("/dashboard");
      return;
    }

    // Auto send OTP on mount if not verified
    if (!isInitialized) {
      setIsInitialized(true);
      handleRequestOTP();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, router, isInitialized]);

  const handleRequestOTP = async () => {
    try {
      setIsSending(true);
      const res = await fetch("/api/auth/google-otp/request", {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        setCooldown(50);
        toast.success("Đã gửi mã OTP. Vui lòng kiểm tra email của bạn.");
      } else {
        toast.error(data.error || "Không thể gửi OTP.");
      }
    } catch (error) {
      toast.error("Đã có lỗi xảy ra.");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Vui lòng nhập đủ 6 số OTP");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/google-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Xác thực thành công!");
        // Update session so token.isGoogleOtpVerified becomes true
        await update({ isGoogleOtpVerified: true });
        router.push("/dashboard");
        router.refresh(); // Ensure layout updates
      } else {
        toast.error(data.error || "Mã OTP không đúng");
      }
    } catch (error) {
      toast.error("Đã có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || !isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600">Đang kiểm tra thông tin...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Bảo mật tài khoản</h2>
        <p className="text-slate-600 mb-6">
          Để bảo vệ tài khoản, chúng tôi đã gửi một mã OTP gồm 6 số đến email <span className="font-semibold text-indigo-600">{session?.user?.email}</span>. Vui lòng kiểm tra và nhập mã đó vào bên dưới.
        </p>

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 text-left">
              Mã OTP (6 số)
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="000000"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Đang xác minh..." : "Xác nhận Đăng nhập"}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={handleRequestOTP}
            disabled={isSending || cooldown > 0}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 transition"
          >
            {isSending ? "Đang gửi lại..." : cooldown > 0 ? `Không nhận được mã? Gửi lại sau ${cooldown}s` : "Không nhận được mã? Gửi lại OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}
