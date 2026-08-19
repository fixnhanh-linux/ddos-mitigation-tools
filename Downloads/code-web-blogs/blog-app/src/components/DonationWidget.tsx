"use client";

import { useState, useEffect } from "react";
import { Coffee, CreditCard, Heart } from "lucide-react";

export default function DonationWidget({ variant = "default" }: { variant?: "default" | "mini" }) {
  const [settings, setSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"bank" | "momo" | "coffee">("bank");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings?group=monetization')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setIsLoading(false);
        
        // Cấu hình kiểm tra trong DB
        const dbHasBank = !!(data.donation_bank_id && data.donation_bank_account);
        const dbHasMomo = !!data.donation_momo || !!data.donation_momo_qr;
        const dbHasCoffee = !!data.donation_buymeacoffee;
        const noConfig = !dbHasBank && !dbHasMomo && !dbHasCoffee;

        // Set default active tab based on what is available
        if (dbHasBank || noConfig) setActiveTab("bank");
        else if (dbHasMomo) setActiveTab("momo");
        else if (dbHasCoffee) setActiveTab("coffee");
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading || !settings) return null;
  if (!settings.enable_donation) return null;

  const bankId = settings.donation_bank_id || "MB";
  const bankAccount = settings.donation_bank_account || "9999999999999";
  const bankName = settings.donation_bank_name || "ADMIN WEB BLOG";
  
  let momoPhone = settings.donation_momo || "";
  let momoLink = "";
  
  if (momoPhone.startsWith("http")) {
    momoLink = momoPhone;
  } else if (momoPhone) {
    momoLink = `https://nhantien.momo.vn/${momoPhone}`;
  }
  
  const momoQrImage = settings.donation_momo_qr || "";
  
  const coffeeLink = settings.donation_buymeacoffee || "https://www.buymeacoffee.com/adminblog";

  // Kiểm tra xem đã điền cấu hình nào chưa
  const dbHasBank = !!(settings.donation_bank_id && settings.donation_bank_account);
  const dbHasMomo = !!settings.donation_momo || !!settings.donation_momo_qr;
  const dbHasCoffee = !!settings.donation_buymeacoffee;
  
  // Nếu chưa có cấu hình nào thì mặc định bật Bank làm fallback
  const noConfig = !dbHasBank && !dbHasMomo && !dbHasCoffee;

  const hasBank = dbHasBank || noConfig;
  const hasMomo = dbHasMomo;
  const hasCoffee = dbHasCoffee;

  // Đếm số lượng cổng quyên góp được bật
  const activeCount = [hasBank, hasMomo, hasCoffee].filter(Boolean).length;

  if (variant === "mini") {
    return (
      <div className="bg-gradient-to-br from-pink-50 to-orange-50 border border-pink-100 rounded-2xl p-5 mb-8 text-center">
        <div className="flex items-center justify-center gap-2 text-pink-600 mb-2">
          <Heart size={20} className="fill-pink-600" />
          <h3 className="font-bold text-lg">{settings.donation_title || "Ủng hộ tác giả"}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">{settings.donation_message}</p>
        
        {/* Nếu chỉ bật đúng 1 phương thức, hiện thẳng QR code / Nút của phương thức đó */}
        {activeCount === 1 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-pink-100/50 shadow-sm flex flex-col items-center">
            {hasBank && (
              <>
                <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100 mb-3 relative group">
                  <img 
                    src={`https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png`} 
                    alt="VietQR" 
                    className="w-40 h-40 rounded-xl"
                  />
                </div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{bankId}</p>
                <p className="text-base font-black text-indigo-600 tracking-wide">{bankAccount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{bankName}</p>
              </>
            )}
            {hasMomo && (
              <div className="w-full flex flex-col items-center">
                <div 
                  className="p-2 bg-white rounded-2xl shadow-sm border border-pink-100 mb-3 relative group cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(momoPhone);
                    alert("Đã copy số điện thoại MoMo: " + momoPhone);
                  }}
                  title="Nhấn để copy số điện thoại"
                >
                  {momoQrImage ? (
                    <img src={momoQrImage} alt="MoMo QR" className="w-40 h-40 rounded-xl object-contain" />
                  ) : (
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`2|99|${momoPhone}|||0|0|0|`)}`} alt="MoMo Auto QR" className="w-40 h-40 rounded-xl" />
                  )}
                  
                  {/* Copy Overlay */}
                  <div className="absolute inset-0 bg-[#A50064]/90 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white gap-2 backdrop-blur-sm scale-95 group-hover:scale-100">
                    <div className="p-2 bg-white/20 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </div>
                    <span className="text-sm font-bold">Copy SĐT</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#A50064] uppercase tracking-wider mb-0.5">Ví MoMo</p>
                <p className="text-base font-black text-slate-800 tracking-wide">{momoPhone}</p>
              </div>
            )}
            {hasCoffee && (
              <a href={coffeeLink} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFDD00] text-black rounded-xl hover:bg-[#e6c700] transition text-sm font-bold shadow-sm">
                <Coffee size={18} /> Buy Me A Coffee
              </a>
            )}
          </div>
        ) : (
          /* Nếu bật nhiều phương thức, hiện các nút chuyển hướng */
          <div className="space-y-2">
            {hasBank && (
              <button onClick={() => { setActiveTab("bank"); document.getElementById('main-donation')?.scrollIntoView({ behavior: 'smooth' })}} className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-pink-200 text-pink-700 rounded-lg hover:bg-pink-50 transition text-sm font-medium">
                <CreditCard size={16} /> Chuyển khoản (VietQR)
              </button>
            )}
            {hasMomo && (
              <button onClick={() => { setActiveTab("momo"); document.getElementById('main-donation')?.scrollIntoView({ behavior: 'smooth' })}} className="w-full flex items-center justify-center gap-2 py-2 bg-[#A50064] text-white rounded-lg hover:bg-[#8a0053] transition text-sm font-medium">
                MoMo
              </button>
            )}
            {hasCoffee && (
              <a href={coffeeLink} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 py-2 bg-[#FFDD00] text-black rounded-lg hover:bg-[#e6c700] transition text-sm font-medium">
                <Coffee size={16} /> Buy Me A Coffee
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="main-donation" className="bg-white border-2 border-pink-100 rounded-2xl p-6 sm:p-8 my-10 shadow-sm relative overflow-hidden">
      <div className="absolute -top-10 -right-10 text-pink-50 opacity-50 transform rotate-12 pointer-events-none">
        <Heart size={200} className="fill-pink-100" />
      </div>
      
      <div className="relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Coffee size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{settings.donation_title || "Ủng hộ tác giả"}</h2>
        <p className="text-slate-600 max-w-lg mx-auto">{settings.donation_message}</p>
      </div>

      <div className="max-w-md mx-auto">
        {/* Chỉ hiện tab nếu bật nhiều hơn 1 phương thức */}
        {activeCount > 1 && (
          <div className="flex justify-center gap-2 mb-6">
            {hasBank && (
              <button 
                onClick={() => setActiveTab("bank")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'bank' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Chuyển khoản
              </button>
            )}
            {hasMomo && (
              <button 
                onClick={() => setActiveTab("momo")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'momo' ? 'bg-[#A50064] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                MoMo
              </button>
            )}
            {hasCoffee && (
              <button 
                onClick={() => setActiveTab("coffee")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'coffee' ? 'bg-[#FFDD00] text-black shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Buy Me A Coffee
              </button>
            )}
          </div>
        )}

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
          {activeTab === "bank" && hasBank && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <img 
                src={`https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png`} 
                alt="VietQR" 
                className="w-48 h-48 mx-auto rounded-xl shadow-sm mb-4 border border-slate-100 p-1 bg-white"
              />
              <div className="space-y-1">
                <p className="text-sm text-slate-500 uppercase font-semibold">{bankId}</p>
                <p className="text-xl font-bold text-slate-800 tracking-wider">{bankAccount}</p>
                <p className="text-sm font-medium text-slate-700 uppercase">{bankName}</p>
              </div>
            </div>
          )}

          {activeTab === "momo" && hasMomo && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div 
                className="p-3 bg-white rounded-3xl shadow-sm border border-pink-100 mb-5 inline-block relative group cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(momoPhone);
                  alert("Đã copy số điện thoại MoMo: " + momoPhone);
                }}
                title="Nhấn để copy số điện thoại"
              >
                {momoQrImage ? (
                  <img src={momoQrImage} alt="MoMo QR" className="w-56 h-56 rounded-2xl object-contain" />
                ) : (
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`2|99|${momoPhone}|||0|0|0|`)}`} alt="MoMo Auto QR" className="w-56 h-56 rounded-2xl" />
                )}
                
                {/* Copy Overlay */}
                <div className="absolute inset-0 bg-[#A50064]/90 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center text-white gap-3 backdrop-blur-sm scale-95 group-hover:scale-100">
                  <div className="p-4 bg-white/20 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </div>
                  <span className="text-base font-bold">Copy số điện thoại</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500 uppercase font-semibold">Ví MoMo</p>
                <p className="text-2xl font-black text-[#A50064] tracking-wider">{momoPhone}</p>
                <p className="text-sm font-medium text-slate-700">Quét mã hoặc chạm vào mã để copy SĐT</p>
              </div>
            </div>
          )}

          {activeTab === "coffee" && hasCoffee && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-8">
              <a href={coffeeLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-[#FFDD00] text-black rounded-xl hover:bg-[#e6c700] transition font-bold shadow-lg shadow-yellow-500/30">
                Buy me a coffee
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
