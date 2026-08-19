"use client";

import { Save, DollarSign, Image as ImageIcon, CreditCard, Link as LinkIcon } from "lucide-react";
import { useState, useEffect } from "react";
import MediaSelectorModal from "@/components/MediaSelectorModal";

export default function MonetizationPage() {
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    enable_ads: true,
    adsense_id: "",
    ad_header: "",
    ad_sidebar: "",
    enable_paywall: false,
    stripe_publishable: "",
    stripe_secret: "",
    enable_donation: false,
    donation_title: "Ủng hộ tác giả",
    donation_message: "Nếu bạn thấy bài viết hữu ích, hãy mời mình một ly cà phê nhé!",
    donation_bank_id: "",
    donation_bank_account: "",
    donation_bank_name: "",
    donation_momo: "",
    donation_momo_qr: "",
    donation_buymeacoffee: "",
  });

  useEffect(() => {
    fetch('/api/settings?group=monetization')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(data).length > 0) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'monetization', settings })
      });
      if (res.ok) alert("Đã lưu cấu hình Kiếm tiền thành công!");
    } catch (e) {
      alert("Lỗi kết nối.");
    }
    setIsSaving(false);
  };
  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kiếm tiền (Monetization)</h1>
          <p className="text-slate-500 mt-1">Quản lý quảng cáo, nội dung trả phí và tiếp thị liên kết.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-70">
          <Save size={18} />
          <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Ads Management */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <ImageIcon size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Quản lý Quảng cáo (AdSense)</h2>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.enable_ads} onChange={(e) => setSettings({...settings, enable_ads: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Google AdSense Publisher ID</label>
                <input type="text" value={settings.adsense_id} onChange={(e) => setSettings({...settings, adsense_id: e.target.value})} placeholder="pub-xxxxxxxxxxxxxxxx" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 font-mono text-sm" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Mã Quảng cáo Header</label>
                <textarea rows={3} value={settings.ad_header} onChange={(e) => setSettings({...settings, ad_header: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 font-mono text-xs text-slate-500" placeholder="Chèn mã script hiển thị banner trên cùng..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mã Quảng cáo Sidebar</label>
                <textarea rows={3} value={settings.ad_sidebar} onChange={(e) => setSettings({...settings, ad_sidebar: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-emerald-500 focus:ring-emerald-500 font-mono text-xs text-slate-500" placeholder="Chèn mã script hiển thị banner cột phải..."></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <LinkIcon size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Tiếp thị liên kết (Affiliate)</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Hệ thống sẽ tự động tìm kiếm các từ khóa bên dưới trong bài viết và gắn link Affiliate của bạn vào.</p>
              
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Từ khoá</label>
                  <input type="text" defaultValue="Next.js" className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Link Affiliate</label>
                  <input type="url" defaultValue="https://vercel.com/?ref=myblog" className="w-full border-slate-300 rounded-lg shadow-sm text-sm text-indigo-600" />
                </div>
                <button className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg border border-slate-300 hover:bg-slate-200">Xoá</button>
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Từ khoá</label>
                  <input type="text" defaultValue="Vultr VPS" className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Link Affiliate</label>
                  <input type="url" defaultValue="https://vultr.com/?ref=12345" className="w-full border-slate-300 rounded-lg shadow-sm text-sm text-indigo-600" />
                </div>
                <button className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg border border-slate-300 hover:bg-slate-200">Xoá</button>
              </div>

              <button className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 font-medium rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition mt-2">
                + Thêm từ khoá mới
              </button>
            </div>
          </div>
        </div>

        {/* Paywall / Premium */}
        <div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                  <CreditCard size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Nội dung trả phí (Paywall)</h2>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.enable_paywall} onChange={(e) => setSettings({...settings, enable_paywall: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl text-sm">
                <strong>Chức năng Premium hiện đang tắt.</strong> Khi bật, bạn có thể khoá các bài viết đặc biệt và yêu cầu độc giả nâng cấp tài khoản để đọc toàn bộ nội dung.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cổng thanh toán (Stripe)</label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Stripe Publishable Key</label>
                    <input type="text" placeholder="pk_test_xxxxxxxxxxx" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm font-mono opacity-50 cursor-not-allowed" disabled />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Stripe Secret Key</label>
                    <input type="password" placeholder="sk_test_xxxxxxxxxxx" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm font-mono opacity-50 cursor-not-allowed" disabled />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800">Các gói thành viên (Plans)</h3>
                  <button className="text-sm text-yellow-600 font-medium hover:underline">+ Thêm gói</button>
                </div>

                <div className="space-y-3">
                  <div className="p-4 border border-slate-200 rounded-xl flex justify-between items-center opacity-70">
                    <div>
                      <h4 className="font-bold text-slate-800">Gói Tháng (Monthly)</h4>
                      <p className="text-sm text-slate-500">Truy cập tất cả bài viết Premium trong 30 ngày.</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-slate-800">99.000 ₫</div>
                      <div className="text-xs text-slate-400">/tháng</div>
                    </div>
                  </div>

                  <div className="p-4 border-2 border-yellow-400 rounded-xl bg-yellow-50 flex justify-between items-center opacity-70 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">PHỔ BIẾN</div>
                    <div>
                      <h4 className="font-bold text-slate-800">Gói Năm (Yearly)</h4>
                      <p className="text-sm text-slate-500">Tiết kiệm 20%. Truy cập không giới hạn.</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-slate-800">950.000 ₫</div>
                      <div className="text-xs text-slate-400">/năm</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Donation */}
        <div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
                  <DollarSign size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Ủng hộ tác giả (Donate)</h2>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.enable_donation} onChange={(e) => setSettings({...settings, enable_donation: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
              </label>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu đề hộp Donate</label>
                <input type="text" value={settings.donation_title} onChange={(e) => setSettings({...settings, donation_title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Lời ngỏ (Message)</label>
                <textarea rows={2} value={settings.donation_message} onChange={(e) => setSettings({...settings, donation_message: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm"></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4">VietQR (Chuyển khoản Ngân hàng)</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mã Ngân Hàng (VD: VCB, MB, ACB...)</label>
                      <input type="text" value={settings.donation_bank_id} onChange={(e) => setSettings({...settings, donation_bank_id: e.target.value})} placeholder="VCB" className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Số Tài Khoản</label>
                      <input type="text" value={settings.donation_bank_account} onChange={(e) => setSettings({...settings, donation_bank_account: e.target.value})} placeholder="0123456789" className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tên Chủ Tài Khoản</label>
                    <input type="text" value={settings.donation_bank_name} onChange={(e) => setSettings({...settings, donation_bank_name: e.target.value})} placeholder="NGUYEN VAN A" className="w-full border-slate-300 rounded-lg shadow-sm text-sm uppercase" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-4">Các nền tảng khác</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại MoMo</label>
                    <input type="text" value={settings.donation_momo} onChange={(e) => setSettings({...settings, donation_momo: e.target.value})} placeholder="0123456789" className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Upload mã QR MoMo (Tùy chọn)</label>
                    <div className="flex gap-2">
                      <input type="text" value={settings.donation_momo_qr || ''} onChange={(e) => setSettings({...settings, donation_momo_qr: e.target.value})} placeholder="https://..." className="flex-1 border-slate-300 rounded-lg shadow-sm text-sm" />
                      <button type="button" onClick={() => setShowMediaModal(true)} className="px-3 py-2 bg-pink-50 text-pink-600 rounded-lg text-sm font-medium border border-pink-100 hover:bg-pink-100 whitespace-nowrap">Chọn ảnh</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Link Buy Me A Coffee</label>
                    <input type="text" value={settings.donation_buymeacoffee} onChange={(e) => setSettings({...settings, donation_buymeacoffee: e.target.value})} placeholder="https://www.buymeacoffee.com/..." className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {showMediaModal && (
        <MediaSelectorModal 
          onSelect={(url) => { setSettings({...settings, donation_momo_qr: url}); setShowMediaModal(false); }} 
          onClose={() => setShowMediaModal(false)} 
        />
      )}
    </div>
  );
}
