"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const success = searchParams?.get("success");
  const token = searchParams?.get("token");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (token && success !== "true") {
      setIsRedirecting(true);
      window.location.href = `/api/auth/verify?token=${token}`;
    }
  }, [token, success]);

  if (isRedirecting) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Đang xác thực...</h2>
        <p className="text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-100">
      {success === "true" ? (
        <>
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Xác thực thành công!</h2>
          <p className="text-slate-600 mb-8">
            Tài khoản của bạn đã được kích hoạt. Bây giờ bạn có thể đăng nhập và sử dụng toàn bộ các tính năng của hệ thống.
          </p>
          <Link
            href="/auth/signin"
            className="w-full block py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition"
          >
            Đăng nhập ngay
          </Link>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Xác thực thất bại</h2>
          <p className="text-slate-600 mb-8">
            Đường dẫn xác thực không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại email hoặc liên hệ hỗ trợ.
          </p>
          <Link
            href="/auth/signin"
            className="w-full block py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            Quay lại trang Đăng nhập
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div>Đang tải...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
