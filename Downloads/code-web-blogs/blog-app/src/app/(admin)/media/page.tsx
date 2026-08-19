"use client";

import { useState, useEffect, useCallback } from "react";
import { UploadCloud, Trash2, Copy, Image as ImageIcon, Loader2, Crop } from "lucide-react";
import Image from "next/image";
import ImageEditorModal from "@/components/ImageEditorModal";

export default function MediaLibraryPage() {
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [editingMedia, setEditingMedia] = useState<any | null>(null);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/media?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMediaList(data.media);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const filteredMediaList = mediaList.filter(media => {
    const matchesSearch = media.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" 
      ? true 
      : filterType === "image" 
        ? media.mimeType.startsWith("image/") 
        : media.mimeType.startsWith("audio/");
    return matchesSearch && matchesFilter;
  });

  const handleUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
        alert(`File ${file.name} không hợp lệ. Chỉ chấp nhận ảnh hoặc audio.`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
           const data = await res.json();
           alert(`Upload thất bại: ${data.error || 'Lỗi không xác định'}`);
        }
      } catch (e: any) {
        alert(`Lỗi kết nối khi tải lên: ${e.message}`);
        console.error("Upload failed", e);
      }
    }

    setIsUploading(false);
    fetchMedia();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá file này?")) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMediaList(mediaList.filter((m) => m._id !== id));
      }
    } catch (e) {
      alert("Lỗi khi xoá");
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    alert("Đã copy URL!");
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleSyncS3 = async () => {
    if (!confirm("Tiến trình này sẽ tải TẤT CẢ các ảnh/audio từ máy chủ (Local) lên S3, sau đó sửa lại tất cả đường dẫn trong bài viết và XÓA file gốc trên máy chủ. Bạn có chắc chắn muốn tiếp tục không?")) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch("/api/media/sync-s3", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Đồng bộ thành công ${data.syncedCount} file!`);
        fetchMedia();
      } else {
        alert(data.error || "Lỗi đồng bộ");
      }
    } catch (e) {
      alert("Lỗi kết nối");
    }
    setIsSyncing(false);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Thư viện Media</h1>
          <p className="text-slate-500 mt-1">Quản lý hình ảnh và âm thanh đã tải lên.</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Tìm kiếm file..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm w-48 lg:w-64"
          />
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-sm bg-white"
          >
            <option value="all">Tất cả định dạng</option>
            <option value="image">Hình ảnh</option>
            <option value="audio">Âm thanh</option>
          </select>
          <button 
            onClick={handleSyncS3}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            <span>Đồng bộ S3</span>
          </button>
          <label className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition cursor-pointer flex items-center gap-2">
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            <span>Tải lên</span>
            <input 
              type="file" 
              multiple 
              accept="image/*, audio/*" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files);
                e.target.value = '';
              }} 
            />
          </label>
        </div>
      </div>

      <div 
        onDragOver={onDragOver} 
        onDragLeave={onDragLeave} 
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
          dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"
        }`}
      >
        <UploadCloud size={48} className={`mx-auto mb-4 ${dragActive ? "text-indigo-500" : "text-slate-400"}`} />
        <h3 className="text-lg font-bold text-slate-700">Kéo thả file vào đây</h3>
        <p className="text-slate-500 mt-2">Hỗ trợ JPG, PNG, GIF, MP3. Kích thước tối đa 5MB/file.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 size={32} className="animate-spin mx-auto text-indigo-600" /></div>
      ) : filteredMediaList.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <ImageIcon size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Chưa có file nào</h3>
          <p className="text-slate-500 mt-1">Hãy kéo thả hoặc bấm nút Tải lên để thêm file mới vào thư viện.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredMediaList.map((media) => (
            <div key={media._id} className="group relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
              <div 
                className="aspect-video bg-slate-100 flex items-center justify-center relative overflow-hidden cursor-pointer"
                onClick={() => media.mimeType.startsWith("image/") && setSelectedMedia(media)}
              >
                {media.mimeType.startsWith("image/") ? (
                  <img src={media.url} alt={media.filename} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                    <span className="text-xs uppercase font-bold">{media.mimeType.split("/")[1]}</span>
                  </div>
                )}
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center gap-3">
                  {media.mimeType.startsWith("image/") && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingMedia(media); }} className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 hover:scale-110 transition" title="Cắt & Tuỳ biến ảnh">
                      <Crop size={18} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); copyToClipboard(media.url); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:scale-110 transition" title="Copy URL">
                    <Copy size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(media._id); }} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 hover:scale-110 transition" title="Xoá file">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-slate-700 truncate" title={media.filename}>{media.filename}</p>
                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 font-medium uppercase">
                  <span>{media.mimeType.split("/")[1]}</span>
                  <span>{(media.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center p-4" onClick={() => setSelectedMedia(null)}>
          <div className="relative max-w-4xl w-full h-auto max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 right-0 flex gap-4">
              <button onClick={() => copyToClipboard(selectedMedia.url)} className="text-white hover:text-indigo-400 font-medium flex items-center gap-2 text-sm">
                <Copy size={16} /> Copy URL
              </button>
              <button onClick={() => setSelectedMedia(null)} className="text-white hover:text-slate-300 font-medium text-sm">
                Đóng (Esc)
              </button>
            </div>
            <img src={selectedMedia.url} alt={selectedMedia.filename} className="w-full h-full object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingMedia && (
        <ImageEditorModal 
          media={editingMedia}
          onClose={() => setEditingMedia(null)}
          onSuccess={(updatedMedia) => {
            setMediaList(prev => prev.map(m => m._id === updatedMedia._id ? updatedMedia : m));
            setEditingMedia(null);
            alert("Đã lưu ảnh tuỳ chỉnh thành công!");
          }}
        />
      )}
    </div>
  );
}
