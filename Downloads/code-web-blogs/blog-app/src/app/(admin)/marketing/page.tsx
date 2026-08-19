"use client";

import { Save, BarChart2, Mail, Rss, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function MarketingPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    ga4_id: "",
    fb_pixel: "",
    custom_header: "",
    email_provider: "Mailchimp",
    email_api_key: "",
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_pass: "",
    auto_newsletter: true,
    enable_rss: true,
    recaptcha_site: "",
    recaptcha_secret: "",
    blacklist_words: "",
  });

  useEffect(() => {
    fetch('/api/settings?group=marketing')
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
        body: JSON.stringify({ group: 'marketing', settings })
      });
      if (res.ok) alert("Đã lưu cấu hình Marketing thành công!");
    } catch (e) {
      alert("Lỗi kết nối.");
    }
    setIsSaving(false);
  };
  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">SEO & Marketing</h1>
          <p className="text-slate-500 mt-1">Cấu hình các công cụ theo dõi và phân phối nội dung.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-70">
          <Save size={18} />
          <span>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Analytics */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <BarChart2 size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Tracking & Analytics</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Google Analytics 4 (Measurement ID)</label>
                <input type="text" value={settings.ga4_id} onChange={(e) => setSettings({...settings, ga4_id: e.target.value})} placeholder="G-XXXXXXXXXX" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                <p className="mt-1 text-sm text-slate-400">Dùng để theo dõi lượt truy cập và hành vi người dùng.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Facebook Pixel ID</label>
                <input type="text" value={settings.fb_pixel} onChange={(e) => setSettings({...settings, fb_pixel: e.target.value})} placeholder="Thêm ID Pixel của bạn" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mã Header Tuỳ chỉnh</label>
                <textarea rows={4} value={settings.custom_header} onChange={(e) => setSettings({...settings, custom_header: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm" placeholder="<script>...</script>"></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Mail size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Email Marketing (Newsletter)</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhà cung cấp Email</label>
                <select value={settings.email_provider} onChange={(e) => setSettings({...settings, email_provider: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                  <option className="text-slate-900">Mailchimp</option>
                  <option>ConvertKit</option>
                  <option>Brevo (Sendinblue)</option>
                  <option>Tự thiết lập SMTP</option>
                </select>
              </div>
              
              {settings.email_provider === "Tự thiết lập SMTP" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Host</label>
                    <input type="text" value={settings.smtp_host} onChange={(e) => setSettings({...settings, smtp_host: e.target.value})} placeholder="smtp.example.com" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Port</label>
                    <input type="text" value={settings.smtp_port} onChange={(e) => setSettings({...settings, smtp_port: e.target.value})} placeholder="465 hoặc 587" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tên người dùng (Username)</label>
                    <input type="text" value={settings.smtp_user} onChange={(e) => setSettings({...settings, smtp_user: e.target.value})} placeholder="email@example.com" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu (Password)</label>
                    <input type="password" value={settings.smtp_pass} onChange={(e) => setSettings({...settings, smtp_pass: e.target.value})} placeholder="••••••••••••••••" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={async () => {
                        const loadingToast = toast.loading("Đang kiểm tra kết nối SMTP...");
                        try {
                          const res = await fetch("/api/settings/test-smtp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              host: settings.smtp_host,
                              port: settings.smtp_port,
                              user: settings.smtp_user,
                              pass: settings.smtp_pass
                            })
                          });
                          const data = await res.json();
                          toast.dismiss(loadingToast);
                          if (res.ok) {
                            toast.success(data.message);
                          } else {
                            toast.error(data.error || "Kết nối thất bại");
                          }
                        } catch (error) {
                          toast.dismiss(loadingToast);
                          toast.error("Lỗi kết nối mạng");
                        }
                      }}
                      className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
                    >
                      Kiểm tra kết nối
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
                  <input type="password" value={settings.email_api_key} onChange={(e) => setSettings({...settings, email_api_key: e.target.value})} placeholder="••••••••••••••••" className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              )}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100 mt-4">
                <input type="checkbox" checked={settings.auto_newsletter} onChange={(e) => setSettings({...settings, auto_newsletter: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300" />
                <div>
                  <p className="font-medium text-slate-700">Tự động gửi email khi có bài mới</p>
                  <p className="text-sm text-slate-500">Gửi thông báo tới danh sách subscriber ngay khi xuất bản bài viết.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Feeds & Spam */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <Rss size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Phân phối nội dung</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Bật RSS Feed</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.enable_rss} onChange={(e) => setSettings({...settings, enable_rss: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Đường dẫn RSS của bạn:</p>
                <code className="text-sm text-indigo-600 font-medium break-all">https://yourdomain.com/feed.xml</code>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <ShieldAlert size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Bảo mật & Chống Spam</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">reCAPTCHA v3 Site Key</label>
                <input type="text" value={settings.recaptcha_site} onChange={(e) => setSettings({...settings, recaptcha_site: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">reCAPTCHA v3 Secret Key</label>
                <input type="password" value={settings.recaptcha_secret} onChange={(e) => setSettings({...settings, recaptcha_secret: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ khoá chặn (Blacklist)</label>
                <textarea rows={3} value={settings.blacklist_words} onChange={(e) => setSettings({...settings, blacklist_words: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" placeholder="Nhập các từ khoá tục tĩu, cách nhau bằng dấu phẩy..."></textarea>
                <p className="mt-1 text-xs text-slate-400">Các bình luận chứa từ này sẽ bị tự động xoá.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
