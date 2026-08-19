"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function PremiumBanner() {
  const router = useRouter();
  const { data: session } = useSession();
  const isPremium = (session?.user as any)?.isPremium;

  const handleUpgrade = () => {
    router.push("/checkout");
  };

  if (isPremium) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <Sparkles className="absolute top-4 right-4 text-white/20" size={64} />
        <h3 className="text-2xl font-black mb-2 relative z-10">Premium Member ✨</h3>
        <p className="text-emerald-50 text-sm mb-4 relative z-10">
          Tài khoản của bạn đã được kích hoạt Premium. Chúc bạn trải nghiệm tuyệt vời!
        </p>
        <div className="inline-block bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 text-sm font-medium relative z-10">
          Đã kích hoạt
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
      <Sparkles className="absolute top-4 right-4 text-white/20" size={64} />
      <h3 className="text-2xl font-black mb-4 relative z-10">Premium Member</h3>
      <p className="text-indigo-100 text-sm mb-6 relative z-10">
        Nâng cấp tài khoản để trải nghiệm các tính năng độc quyền và bài viết chuyên sâu.
      </p>
      <button 
        onClick={handleUpgrade}
        className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all relative z-10"
      >
        Nâng cấp ngay
      </button>
    </div>
  );
}
