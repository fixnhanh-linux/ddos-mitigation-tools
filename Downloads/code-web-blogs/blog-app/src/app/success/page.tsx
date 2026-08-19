"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useSession } from "next-auth/react";

export default function SuccessPage() {
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    // Bắn pháo hoa chúc mừng
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    // Bắt buộc update lại session để NextAuth lấy token mới từ DB
    update();

    return () => clearInterval(interval);
  }, [update]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 size={48} />
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 mb-2">Thanh toán thành công!</h1>
          <p className="text-slate-500 mb-8">
            Tuyệt vời! Tài khoản của bạn đã được nâng cấp lên hạng <span className="font-bold text-indigo-600">Premium Member</span>. 
            Chúc bạn có những trải nghiệm tuyệt vời nhất cùng hệ thống!
          </p>
          
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-8 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Trạng thái Premium</p>
                <p className="text-xs text-slate-500">Đã kích hoạt toàn bộ tính năng</p>
              </div>
            </div>
            <div className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded text-xs font-bold uppercase">
              Active
            </div>
          </div>
          
          <Link 
            href="/dashboard"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group"
          >
            Trở về Dashboard 
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
