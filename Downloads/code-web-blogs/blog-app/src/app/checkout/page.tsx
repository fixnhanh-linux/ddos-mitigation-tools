"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, QrCode, ShieldCheck, Check, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const PACKAGES = [
  { id: "1_month", name: "1 Tháng", price: 99000, duration: 30, popular: false },
  { id: "6_months", name: "6 Tháng", price: 499000, duration: 180, popular: true, save: "Tiết kiệm 15%" },
  { id: "12_months", name: "1 Năm", price: 899000, duration: 365, popular: false, save: "Tiết kiệm 25%" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "qr">("qr");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Giả lập thời gian xử lý thanh toán 2.5 giây
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selectedPkg.id, duration: selectedPkg.duration }),
      });
      
      if (res.ok) {
        // Redirect to success page
        router.push("/success");
      } else {
        toast.error("Có lỗi xảy ra trong quá trình thanh toán!");
        setIsProcessing(false);
      }
    } catch (e) {
      toast.error("Lỗi kết nối mạng!");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 transition mb-4">
            <ArrowLeft size={16} className="mr-1" /> Quay lại Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Nâng cấp Premium</h1>
          <p className="mt-2 text-slate-500">Mở khoá toàn bộ tính năng độc quyền và bài viết chuyên sâu.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Cột trái: Chọn gói */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">1. Chọn gói đăng ký</h2>
              <div className="space-y-3">
                {PACKAGES.map((pkg) => (
                  <label 
                    key={pkg.id} 
                    className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPkg.id === pkg.id 
                        ? "border-indigo-600 bg-indigo-50/50" 
                        : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="package" 
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" 
                      checked={selectedPkg.id === pkg.id}
                      onChange={() => setSelectedPkg(pkg)}
                    />
                    <div className="ml-4 flex-1 flex justify-between items-center">
                      <div>
                        <span className="block text-sm font-bold text-slate-900">{pkg.name}</span>
                        {pkg.save && <span className="block text-xs font-medium text-emerald-600 mt-0.5">{pkg.save}</span>}
                      </div>
                      <div className="text-right">
                        <span className="block text-lg font-bold text-slate-900">{pkg.price.toLocaleString("vi-VN")}đ</span>
                        <span className="block text-xs text-slate-500">/ {pkg.duration} ngày</span>
                      </div>
                    </div>
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Phổ biến nhất
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">2. Phương thức thanh toán</h2>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setPaymentMethod("qr")}
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition ${
                    paymentMethod === "qr" ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  <QrCode size={32} className="mb-2" />
                  <span className="font-semibold text-sm">Chuyển khoản QR</span>
                  <span className="text-xs opacity-70 mt-1">VietQR / Momo</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition ${
                    paymentMethod === "card" ? "border-indigo-600 bg-indigo-50/50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  <CreditCard size={32} className="mb-2" />
                  <span className="font-semibold text-sm">Thẻ Quốc Tế</span>
                  <span className="text-xs opacity-70 mt-1">Visa / Mastercard</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cột phải: Thanh toán / QR */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden sticky top-6">
              <div className="p-6 bg-slate-900 text-white">
                <h3 className="font-semibold mb-1">Tổng thanh toán</h3>
                <div className="text-3xl font-black">{selectedPkg.price.toLocaleString("vi-VN")} <span className="text-xl font-medium text-slate-400">VND</span></div>
                <div className="text-sm text-slate-400 mt-1">Gói: Premium {selectedPkg.name}</div>
              </div>
              
              <div className="p-6">
                {paymentMethod === "qr" ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-800 mb-4">Quét mã QR bằng ứng dụng ngân hàng</p>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 inline-block mb-4">
                      {/* Dùng API VietQR để tự động tạo mã QR thật với số tiền tương ứng */}
                      <img 
                        src={`https://img.vietqr.io/image/970422-0123456789-compact2.jpg?amount=${selectedPkg.price}&addInfo=Nang cap Premium&accountName=BLOG APP DEMO`} 
                        alt="VietQR" 
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg mb-6 text-left">
                      <p className="mb-1"><strong>Ngân hàng:</strong> MBBank</p>
                      <p className="mb-1"><strong>Số tài khoản:</strong> 0123456789</p>
                      <p className="mb-1"><strong>Tên tài khoản:</strong> BLOG APP DEMO</p>
                      <p className="mb-1"><strong>Số tiền:</strong> {selectedPkg.price.toLocaleString("vi-VN")}đ</p>
                      <p><strong>Nội dung:</strong> Nang cap Premium</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">TÊN TRÊN THẺ</label>
                      <input type="text" placeholder="NGUYEN VAN A" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SỐ THẺ</label>
                      <div className="relative">
                        <input type="text" placeholder="0000 0000 0000 0000" className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                        <CreditCard size={18} className="absolute left-3 top-2.5 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">HẾT HẠN (MM/YY)</label>
                        <input type="text" placeholder="12/28" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">CVC</label>
                        <input type="text" placeholder="123" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Đang xử lý...
                    </>
                  ) : (
                    <>
                      {paymentMethod === "qr" ? "Xác nhận đã chuyển khoản" : "Thanh toán ngay"}
                    </>
                  )}
                </button>
                
                <div className="mt-4 flex items-center justify-center text-xs text-slate-500 gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Thanh toán bảo mật an toàn 100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
