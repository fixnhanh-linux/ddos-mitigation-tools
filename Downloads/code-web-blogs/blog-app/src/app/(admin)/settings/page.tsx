"use client";

import { Save, Download, Database } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import { Upload } from "lucide-react";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    site_title: "",
    tagline: "",
    maintenance_mode: false,
    no_index: false,
    openai_key: "",
    gemini_key: "",
    ai_provider: "openai",
    google_drive_credentials: "",
    google_drive_folder_id: "",
    custom_header: "",
    // Cloud Storage
    aws_region: "",
    aws_access_key_id: "",
    aws_secret_access_key: "",
    aws_s3_bucket_name: "",
    cloudinary_cloud_name: "",
    cloudinary_api_key: "",
    cloudinary_api_secret: "",
    // UI Content
    hero_title: "",
    hero_desc: "",
    newsletter_title: "",
    newsletter_desc: "",
    footer_newsletter_title: "",
    footer_newsletter_desc: "",
    footer_copyright: "",
    footer_tech: "",
    newsletter_placeholder: "",
    newsletter_btn: "",
    footer_newsletter_placeholder: "",
    footer_newsletter_btn: "",
  });
  
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings?group=general')
      .then(res => res.json())
      .then(data => {
        setSettings({
          site_title: data.site_title || "Tên Website",
          tagline: data.tagline || "Chia sẻ kiến thức công nghệ mỗi ngày",
          maintenance_mode: data.maintenance_mode || false,
          no_index: data.no_index || false,
          openai_key: data.openai_key || "",
          gemini_key: data.gemini_key || "",
          ai_provider: data.ai_provider || "openai",
          google_drive_credentials: data.google_drive_credentials || "",
          google_drive_folder_id: data.google_drive_folder_id || "",
          custom_header: data.custom_header || "",
          // Cloud Storage
          aws_region: data.aws_region || "",
          aws_access_key_id: data.aws_access_key_id || "",
          aws_secret_access_key: data.aws_secret_access_key || "",
          aws_s3_bucket_name: data.aws_s3_bucket_name || "",
          cloudinary_cloud_name: data.cloudinary_cloud_name || "",
          cloudinary_api_key: data.cloudinary_api_key || "",
          cloudinary_api_secret: data.cloudinary_api_secret || "",
          // UI Content
          hero_title: data.hero_title || "Chào mừng đến với Tên Website",
          hero_desc: data.hero_desc || "Chưa có bài viết nào được xuất bản. Hãy đăng nhập quản trị để viết bài đầu tiên!",
          newsletter_title: data.newsletter_title || "Đừng bỏ lỡ tin tức mới",
          newsletter_desc: data.newsletter_desc || "Đăng ký nhận bản tin hàng tuần để cập nhật những bài viết, xu hướng công nghệ mới nhất trực tiếp vào hộp thư của bạn.",
          footer_newsletter_title: data.footer_newsletter_title || "Đăng ký nhận bản tin",
          footer_newsletter_desc: data.footer_newsletter_desc || "Nhận những bài viết mới nhất, mẹo lập trình và tin tức công nghệ gửi trực tiếp vào hộp thư của bạn mỗi tuần.",
          footer_copyright: data.footer_copyright || "Tất cả bản quyền được bảo lưu.",
          footer_tech: data.footer_tech || "Được xây dựng bằng Next.js, MongoDB và TailwindCSS.",
          newsletter_placeholder: data.newsletter_placeholder || "Địa chỉ email của bạn",
          newsletter_btn: data.newsletter_btn || "Đăng ký",
          footer_newsletter_placeholder: data.footer_newsletter_placeholder || "Nhập email của bạn...",
          footer_newsletter_btn: data.footer_newsletter_btn || "Đăng ký",
        });
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'general', settings })
      });
      if (res.ok) {
        alert("Đã lưu cấu hình thành công!");
      } else {
        alert("Có lỗi xảy ra khi lưu.");
      }
    } catch (e) {
      alert("Lỗi kết nối.");
    }
    setIsSaving(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      alert("Vui lòng chọn tệp JSON hợp lệ.");
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const posts = JSON.parse(text);

      const res = await fetch("/api/import/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts })
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || "Import dữ liệu thành công!");
      } else {
        alert(data.error || "Lỗi khi import dữ liệu.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi khi đọc file hoặc kết nối với máy chủ.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBackupDrive = async () => {
    if (!settings.google_drive_credentials) {
      alert("Vui lòng điền thông tin JSON của Google Service Account trước và Lưu cấu hình.");
      return;
    }
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          googleDriveCredentials: settings.google_drive_credentials,
          folderId: settings.google_drive_folder_id
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Backup thành công! Link file: ${data.link}`);
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Lỗi kết nối: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cài đặt Hệ thống</h1>
          <p className="text-slate-500 mt-1">Cấu hình các thông tin cơ bản cho website của bạn.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-70"
        >
          <Save size={18} />
          <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Thông tin chung</h3>
              <p className="text-sm text-slate-500 mt-1">Tên website và mô tả ngắn (Tagline) hiển thị trên trình duyệt.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tên trang web (Site Title)</label>
                <input type="text" value={settings.site_title} onChange={(e) => setSettings({...settings, site_title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Khẩu hiệu (Tagline)</label>
                <input type="text" value={settings.tagline} onChange={(e) => setSettings({...settings, tagline: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                <p className="mt-1 text-sm text-slate-400">Một câu ngắn gọn mô tả website của bạn.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Ngày và Giờ</h3>
              <p className="text-sm text-slate-500 mt-1">Định dạng hiển thị thời gian trên các bài viết.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Múi giờ</label>
                <select className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                  <option>UTC+07:00 (Bangkok, Hanoi, Jakarta)</option>
                  <option>UTC+00:00 (London, Lisbon)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Định dạng ngày</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="radio" name="date_format" className="text-indigo-600 focus:ring-indigo-500" defaultChecked />
                    <span className="text-sm text-slate-700">11 tháng 7, 2026 (F j, Y)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="radio" name="date_format" className="text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-slate-700">2026-07-11 (Y-m-d)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="radio" name="date_format" className="text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-slate-700">11/07/2026 (d/m/Y)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Lưu trữ Đám mây (Cloud Storage)</h3>
              <p className="text-sm text-slate-500 mt-1">Cấu hình kho lưu trữ ảnh. Ưu tiên 1: AWS S3. Ưu tiên 2: Cloudinary. Nếu bỏ trống cả hai, ảnh sẽ lưu tạm thời tại máy chủ.</p>
            </div>
            <div className="col-span-2 space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Database size={18} className="text-amber-500" /> Amazon Web Services (AWS S3)
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">AWS Region (VD: ap-southeast-1)</label>
                    <input type="text" value={settings.aws_region} onChange={(e) => setSettings({...settings, aws_region: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Access Key ID</label>
                    <input type="text" value={settings.aws_access_key_id} onChange={(e) => setSettings({...settings, aws_access_key_id: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Secret Access Key</label>
                    <input type="password" value={settings.aws_secret_access_key} onChange={(e) => setSettings({...settings, aws_secret_access_key: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bucket Name</label>
                    <input type="text" value={settings.aws_s3_bucket_name} onChange={(e) => setSettings({...settings, aws_s3_bucket_name: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Upload size={18} className="text-blue-500" /> Cloudinary
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cloud Name</label>
                    <input type="text" value={settings.cloudinary_cloud_name} onChange={(e) => setSettings({...settings, cloudinary_cloud_name: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                    <input type="text" value={settings.cloudinary_api_key} onChange={(e) => setSettings({...settings, cloudinary_api_key: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
                    <input type="password" value={settings.cloudinary_api_secret} onChange={(e) => setSettings({...settings, cloudinary_api_secret: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Bảo trì & Khác</h3>
              <p className="text-sm text-slate-500 mt-1">Các thiết lập nâng cao và quản trị SEO cơ bản.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <h4 className="font-medium text-slate-800">Chế độ bảo trì</h4>
                  <p className="text-sm text-slate-500">Tạm thời ẩn website với khách truy cập.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings.maintenance_mode} onChange={(e) => setSettings({...settings, maintenance_mode: e.target.checked})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <h4 className="font-medium text-slate-800">Ngăn chặn công cụ tìm kiếm</h4>
                  <p className="text-sm text-slate-500">Yêu cầu Google không lập chỉ mục trang web này.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings.no_index} onChange={(e) => setSettings({...settings, no_index: e.target.checked})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Mã Header Tuỳ chỉnh (Xác thực Google, Pixel...)</label>
                <textarea rows={3} value={settings.custom_header} onChange={(e) => setSettings({...settings, custom_header: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm" placeholder='<meta name="google-site-verification" content="..." />'></textarea>
                <p className="mt-1 text-xs text-slate-400">Các thẻ HTML nhập vào đây sẽ được chèn tự động vào thẻ &lt;head&gt; của website.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800">Trợ lý AI (Cấu hình)</h2>
              <p className="text-sm text-slate-500 mt-1">Cấu hình API Key để sử dụng AI thật thay vì dữ liệu mẫu.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhà cung cấp AI (AI Provider)</label>
                <select
                  value={settings.ai_provider}
                  onChange={(e) => setSettings({...settings, ai_provider: e.target.value})}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="openai">OpenAI (GPT-4o/GPT-3.5)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro / Flash)</option>
                </select>
              </div>

              {settings.ai_provider === "gemini" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={settings.gemini_key} 
                    onChange={(e) => setSettings({...settings, gemini_key: e.target.value})} 
                    placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm" 
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">OpenAI API Key</label>
                  <input 
                    type="password" 
                    value={settings.openai_key} 
                    onChange={(e) => setSettings({...settings, openai_key: e.target.value})} 
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm" 
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">Nếu bỏ trống, hệ thống sẽ sử dụng Trợ lý AI giả lập (Mock).</p>
            </div>
          </div>
        </div>
      </div>

      {/* UI Content Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">Nội dung Giao diện (UI)</h2>
          <p className="text-sm text-slate-500 mt-1">Thay đổi nội dung văn bản hiển thị trên trang chủ và các thành phần chung.</p>
        </div>
        <div className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Trang chủ (Chưa có bài viết)</h3>
              <p className="text-sm text-slate-500 mt-1">Văn bản hiển thị khi website chưa xuất bản bài viết nào.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu đề (Hero Title)</label>
                <input type="text" value={settings.hero_title} onChange={(e) => setSettings({...settings, hero_title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả (Hero Description)</label>
                <textarea rows={3} value={settings.hero_desc} onChange={(e) => setSettings({...settings, hero_desc: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Đăng ký nhận tin (Trang chủ)</h3>
              <p className="text-sm text-slate-500 mt-1">Banner nhập email ở dưới cùng của trang chủ.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu đề</label>
                <input type="text" value={settings.newsletter_title} onChange={(e) => setSettings({...settings, newsletter_title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả</label>
                <textarea rows={2} value={settings.newsletter_desc} onChange={(e) => setSettings({...settings, newsletter_desc: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Placeholder Input</label>
                  <input type="text" value={settings.newsletter_placeholder} onChange={(e) => setSettings({...settings, newsletter_placeholder: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Chữ nút bấm</label>
                  <input type="text" value={settings.newsletter_btn} onChange={(e) => setSettings({...settings, newsletter_btn: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <h3 className="text-lg font-semibold text-slate-800">Chân trang (Footer)</h3>
              <p className="text-sm text-slate-500 mt-1">Thông tin bản quyền và Form nhận bản tin nhỏ ở Footer.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu đề (Nhận bản tin Footer)</label>
                <input type="text" value={settings.footer_newsletter_title} onChange={(e) => setSettings({...settings, footer_newsletter_title: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả (Nhận bản tin Footer)</label>
                <textarea rows={2} value={settings.footer_newsletter_desc} onChange={(e) => setSettings({...settings, footer_newsletter_desc: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Placeholder Input</label>
                  <input type="text" value={settings.footer_newsletter_placeholder} onChange={(e) => setSettings({...settings, footer_newsletter_placeholder: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Chữ nút bấm</label>
                  <input type="text" value={settings.footer_newsletter_btn} onChange={(e) => setSettings({...settings, footer_newsletter_btn: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Thông tin bản quyền (Copyright)</label>
                <input type="text" value={settings.footer_copyright} onChange={(e) => setSettings({...settings, footer_copyright: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Thông tin nền tảng (Tech Stack)</label>
                <input type="text" value={settings.footer_tech} onChange={(e) => setSettings({...settings, footer_tech: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2FA Settings */}
      <TwoFactorSettings />

      {/* Backup Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Sao lưu & Xuất dữ liệu (Backup)</h2>
              <p className="text-sm text-slate-500 mt-1">Xuất toàn bộ bài viết ra định dạng tệp để lưu trữ an toàn.</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-6 hover:border-emerald-300 transition group relative overflow-hidden bg-white">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                <Download size={100} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">Định dạng JSON</h3>
              <p className="text-sm text-slate-500 mb-6 relative z-10">
                Phù hợp để khôi phục dữ liệu hoặc import sang hệ thống MongoDB khác. Giữ nguyên toàn bộ cấu trúc dữ liệu.
              </p>
              <a 
                href="/api/export/posts?format=json" 
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition relative z-10"
              >
                <Download size={18} />
                <span>Tải xuống JSON</span>
              </a>

              <div className="mt-6 border-t border-slate-100 pt-4 relative z-10">
                <h4 className="font-semibold text-slate-700 text-sm mb-2">Khôi phục dữ liệu (Restore)</h4>
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  ref={fileInputRef} 
                  onChange={handleImport}
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="inline-flex items-center gap-2 px-5 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-50 text-sm"
                >
                  <Upload size={16} />
                  <span>{isImporting ? "Đang xử lý..." : "Import từ file JSON"}</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 hover:border-blue-300 transition group relative overflow-hidden bg-white">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                <Database size={100} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">Đồng bộ Google Drive</h3>
              <p className="text-sm text-slate-500 mb-6 relative z-10">
                Nén toàn bộ Source Code và Database và tải lên Google Drive của bạn một cách an toàn. 
                Vui lòng điền cấu hình API phía dưới trước khi nhấn nút này.
              </p>
              
              <button 
                onClick={handleBackupDrive}
                disabled={isBackingUp}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition relative z-10 disabled:opacity-70"
              >
                <Database size={18} />
                <span>{isBackingUp ? "Đang nén & Upload (Có thể mất vài phút)..." : "Chạy Full Backup lên Drive"}</span>
              </button>

              <div className="mt-6 border-t border-slate-100 pt-4 relative z-10 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Google Drive Folder ID (Tùy chọn)</label>
                  <input 
                    type="text" 
                    value={settings.google_drive_folder_id} 
                    onChange={(e) => setSettings({...settings, google_drive_folder_id: e.target.value})} 
                    placeholder="1A2B3C4D5E6F..." 
                    className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service Account JSON</label>
                  <textarea 
                    value={settings.google_drive_credentials} 
                    onChange={(e) => setSettings({...settings, google_drive_credentials: e.target.value})} 
                    placeholder='{"type": "service_account", "project_id": "..."}'
                    rows={4}
                    className="w-full text-xs font-mono border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
