"use client";

import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import Image from "next/image";

export default function TwoFactorSettings() {
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState("");

  // Assuming we don't know the exact state until we fetch it,
  // but for simplicity, we provide the UI to enable/disable.
  // In a real app, we'd fetch the current 2FA status of the user on mount.

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/auth/2fa/generate");
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setMessage("Vui lòng quét mã QR này bằng Google Authenticator hoặc Authy, sau đó nhập mã gồm 6 chữ số bên dưới để xác nhận.");
      } else {
        setMessage(data.error || "Có lỗi xảy ra.");
      }
    } catch (e) {
      setMessage("Lỗi kết nối.");
    }
    setIsGenerating(false);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Xác thực 2 bước đã được bật thành công!");
        setQrCode("");
        setSecret("");
        setToken("");
      } else {
        setMessage(data.error || "Mã xác thực không đúng.");
      }
    } catch (e) {
      setMessage("Lỗi kết nối.");
    }
    setIsVerifying(false);
  };

  const handleDisable = async () => {
    if (!token) {
      setMessage("Vui lòng nhập mã xác thực hiện tại để tắt.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Xác thực 2 bước đã được tắt.");
        setToken("");
      } else {
        setMessage(data.error || "Mã xác thực không đúng.");
      }
    } catch (e) {
      setMessage("Lỗi kết nối.");
    }
    setIsVerifying(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Bảo mật (2FA)</h2>
            <p className="text-sm text-slate-500 mt-1">Xác thực 2 bước giúp tài khoản quản trị của bạn an toàn tuyệt đối trước hacker.</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-sm font-medium">
            {message}
          </div>
        )}

        {!qrCode && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              <ShieldCheck size={18} />
              <span>{isGenerating ? "Đang tạo mã..." : "Bật Xác thực 2 bước"}</span>
            </button>

            <div className="flex-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập mã 2FA hiện tại để tắt"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleDisable}
                  disabled={isVerifying}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                >
                  <ShieldAlert size={18} />
                  <span>Tắt 2FA</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {qrCode && (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <Image src={qrCode} alt="QR Code" width={200} height={200} />
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <h3 className="font-bold text-lg text-slate-800">Quét mã QR để hoàn tất</h3>
              <p className="text-sm text-slate-600">
                Mở ứng dụng <strong>Google Authenticator</strong> hoặc <strong>Authy</strong> trên điện thoại và quét mã QR bên cạnh. Sau đó nhập mã 6 số hiện trên màn hình điện thoại vào ô bên dưới.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <input
                  type="text"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="000000"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-center font-mono text-xl tracking-widest sm:w-48"
                />
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || token.length !== 6}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isVerifying ? "Đang xác nhận..." : "Xác nhận & Bật"}
                </button>
                <button
                  onClick={() => { setQrCode(""); setSecret(""); setMessage(""); }}
                  className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
