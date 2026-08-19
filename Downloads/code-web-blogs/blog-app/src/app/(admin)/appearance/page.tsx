"use client";

import { Save, Palette, LayoutTemplate, Type, Image as ImageIcon, Loader2, Moon, Code, FileText, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

export default function AppearancePage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [appearance, setAppearance] = useState({
    primaryColor: "#4f46e5",
    fontFamily: "geist",
    layoutStyle: "modern",
    logoUrl: "",
    faviconUrl: "",
    themeMode: "light",
    showAuthorBox: true,
    showRelatedPosts: true,
    customCss: "",
  });

  useEffect(() => {
    fetch('/api/settings?group=appearance')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(data).length > 0) {
          setAppearance(prev => ({ ...prev, ...data }));
        }
      });
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingFavicon(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (type === 'logo') setAppearance(prev => ({ ...prev, logoUrl: data.url }));
        else setAppearance(prev => ({ ...prev, faviconUrl: data.url }));
        toast.success("Tải ảnh lên thành công");
      } else throw new Error();
    } catch {
      toast.error("Lỗi tải ảnh");
    } finally {
      if (type === 'logo') {
        setIsUploadingLogo(false);
        if (logoInputRef.current) logoInputRef.current.value = "";
      } else {
        setIsUploadingFavicon(false);
        if (faviconInputRef.current) faviconInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: 'appearance', settings: appearance })
      });
      if (res.ok) {
        toast.success("Đã lưu thiết lập giao diện thành công!");
      } else {
        toast.error("Không thể lưu thiết lập.");
      }
    } catch (e) {
      toast.error("Lỗi kết nối.");
    }
    setIsSaving(false);
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cài đặt Giao diện</h1>
          <p className="text-slate-500 mt-1">Tùy chỉnh màu sắc, phông chữ và bố cục website của bạn.</p>
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
          
          {/* Màu sắc chủ đạo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <Palette size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Màu sắc chủ đạo</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Chọn màu sắc thương hiệu chính của bạn.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Màu chính (Primary Color)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={appearance.primaryColor} 
                    onChange={(e) => setAppearance({...appearance, primaryColor: e.target.value})} 
                    className="w-10 h-10 border-0 rounded-lg shadow-sm cursor-pointer" 
                  />
                  <input 
                    type="text" 
                    value={appearance.primaryColor} 
                    onChange={(e) => setAppearance({...appearance, primaryColor: e.target.value})} 
                    className="flex-1 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Phông chữ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <Type size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Typography</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Cấu hình phông chữ hiển thị trên toàn trang.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phông chữ chính</label>
                <select 
                  value={appearance.fontFamily}
                  onChange={(e) => setAppearance({...appearance, fontFamily: e.target.value})}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="geist">Geist Sans (Mặc định)</option>
                  <option value="inter">Inter</option>
                  <option value="roboto">Roboto</option>
                  <option value="lora">Lora (Serif)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Logo & Favicon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <ImageIcon size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Hình ảnh Nhận diện</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Cập nhật Logo và Favicon cho website.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo Website</label>
                <div className="flex gap-4 items-start">
                  <div className="w-24 h-24 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {appearance.logoUrl ? (
                      <img src={appearance.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">Chưa có Logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input type="file" ref={logoInputRef} onChange={(e) => handleUpload(e, 'logo')} accept="image/*" className="hidden" />
                      <button 
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                      >
                        {isUploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Tải ảnh mới
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Hoặc nhập URL logo..."
                      value={appearance.logoUrl} 
                      onChange={(e) => setAppearance({...appearance, logoUrl: e.target.value})} 
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm text-slate-600" 
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Favicon (Biểu tượng trình duyệt)</label>
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {appearance.faviconUrl ? (
                      <img src={appearance.faviconUrl} alt="Favicon" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-400">16x16</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input type="file" ref={faviconInputRef} onChange={(e) => handleUpload(e, 'favicon')} accept="image/*" className="hidden" />
                      <button 
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={isUploadingFavicon}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                      >
                        {isUploadingFavicon ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Tải ảnh mới
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Hoặc nhập URL favicon..."
                      value={appearance.faviconUrl} 
                      onChange={(e) => setAppearance({...appearance, faviconUrl: e.target.value})} 
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm text-slate-600" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chế độ Giao diện */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <Moon size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Chế độ Hiển thị</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Cài đặt chế độ nền mặc định cho trang web.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chủ đề mặc định</label>
                <select 
                  value={appearance.themeMode}
                  onChange={(e) => setAppearance({...appearance, themeMode: e.target.value})}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="light">Sáng (Light Mode)</option>
                  <option value="dark">Tối (Dark Mode)</option>
                  <option value="system">Tự động theo hệ thống</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cấu hình Bài viết */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Cấu hình Bài viết</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Bật/tắt các thành phần trên trang chi tiết bài viết.</p>
            </div>
            <div className="col-span-2 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={appearance.showAuthorBox} onChange={() => setAppearance({...appearance, showAuthorBox: !appearance.showAuthorBox})} />
                  <div className={`block w-10 h-6 rounded-full transition ${appearance.showAuthorBox ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${appearance.showAuthorBox ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition">Hiển thị Hộp thông tin Tác giả ở cuối bài</div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={appearance.showRelatedPosts} onChange={() => setAppearance({...appearance, showRelatedPosts: !appearance.showRelatedPosts})} />
                  <div className={`block w-10 h-6 rounded-full transition ${appearance.showRelatedPosts ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${appearance.showRelatedPosts ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition">Hiển thị danh sách Bài viết liên quan</div>
              </label>
            </div>
          </div>

          {/* Bố cục */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <LayoutTemplate size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Bố cục trang chủ</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Chọn kiểu hiển thị danh sách bài viết ở trang chủ.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <label className={`border-2 rounded-xl p-4 cursor-pointer transition ${appearance.layoutStyle === "modern" ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
                  <input type="radio" name="layout" value="modern" checked={appearance.layoutStyle === "modern"} onChange={() => setAppearance({...appearance, layoutStyle: "modern"})} className="sr-only" />
                  <div className="h-20 bg-white border border-slate-200 rounded-lg mb-3 flex gap-2 p-2">
                    <div className="w-1/3 bg-slate-200 rounded"></div>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="h-3 bg-slate-200 rounded w-full"></div>
                      <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                    </div>
                  </div>
                  <h4 className="font-semibold text-center text-slate-800 text-sm">Hiện đại (Modern)</h4>
                </label>
                <label className={`border-2 rounded-xl p-4 cursor-pointer transition ${appearance.layoutStyle === "classic" ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
                  <input type="radio" name="layout" value="classic" checked={appearance.layoutStyle === "classic"} onChange={() => setAppearance({...appearance, layoutStyle: "classic"})} className="sr-only" />
                  <div className="h-20 bg-white border border-slate-200 rounded-lg mb-3 flex flex-col gap-2 p-2">
                    <div className="h-8 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                  <h4 className="font-semibold text-center text-slate-800 text-sm">Cổ điển (Classic Grid)</h4>
                </label>
              </div>
            </div>
          </div>

          {/* Custom CSS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <Code size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold">Tùy chỉnh CSS</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Chèn các đoạn mã CSS tùy chỉnh để can thiệp sâu vào giao diện.</p>
            </div>
            <div className="col-span-2 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Custom CSS</label>
                <div className="relative rounded-lg overflow-hidden border border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition">
                  <div className="absolute top-0 left-0 w-8 h-full bg-slate-100 border-r border-slate-300 text-right pr-2 pt-2.5 text-xs text-slate-400 font-mono select-none">
                    1<br/>2<br/>3<br/>4<br/>5
                  </div>
                  <textarea 
                    value={appearance.customCss}
                    onChange={(e) => setAppearance({...appearance, customCss: e.target.value})}
                    rows={5}
                    placeholder="/* Nhập mã CSS của bạn vào đây... */&#10;.custom-header {&#10;  background: red;&#10;}"
                    className="w-full pl-10 pr-3 py-2 border-0 bg-slate-50 font-mono text-sm text-slate-700 focus:ring-0 resize-y whitespace-pre-wrap"
                  ></textarea>
                </div>
                <p className="text-xs text-slate-500 mt-2">Đoạn CSS này sẽ được tự động chèn vào thẻ &lt;head&gt; của trang web.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
