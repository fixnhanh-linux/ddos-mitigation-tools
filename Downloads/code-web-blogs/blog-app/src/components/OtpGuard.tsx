"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OtpGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    // Các route không cần block dù chưa xác thực OTP
    const isPublicAuthRoute = 
      pathname?.startsWith("/api/auth") || 
      pathname === "/auth/verify-google" || 
      pathname === "/auth/signin" ||
      pathname === "/auth/verify";

    if (session?.user) {
      const isOtpVerified = (session.user as any).isGoogleOtpVerified;
      // Nếu đã đăng nhập nhưng OTP chưa được verify và đang không ở trang xác thực
      if (isOtpVerified !== true && !isPublicAuthRoute) {
        router.replace("/auth/verify-google");
        return;
      }
    }

    setIsChecking(false);
  }, [session, status, pathname, router]);

  // Nếu đang loading session hoặc đang chuẩn bị redirect, hiển thị màn hình chờ (hoặc null)
  if (status === "loading" || isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Bỏ qua trang verify-google để không bị loop block
  if (session?.user && (session.user as any).isGoogleOtpVerified !== true) {
    if (pathname !== "/auth/verify-google" && !pathname?.startsWith("/api/auth")) {
      return null;
    }
  }

  return <>{children}</>;
}
