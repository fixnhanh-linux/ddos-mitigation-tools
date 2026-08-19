"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Image as ImageIcon, Loader2, UploadCloud } from "lucide-react";
import Image from "next/image";

interface MediaSelectorModalProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function MediaSelectorModal({ onSelect, onClose }: MediaSelectorModalProps) {
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/media?limit=30");
      if (res.ok) {
        const data = await res.json();
        setMediaList(data.media);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", files[0]); // Only upload 1 for quick selection

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchMedia();
      } else {
        alert("Upload thất bại!");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối khi tải lên");
    }
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Chọn ảnh từ Thư viện</h2>
            <label className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium cursor-pointer transition flex items-center gap-2 border border-indigo-100">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              <span>{isUploading ? "Đang tải..." : "Tải ảnh lên"}</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
            </div>
          ) : mediaList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-slate-300" />
              <p>Thư viện trống. Hãy vào menu "Đa phương tiện" để tải ảnh lên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {mediaList.map((media) => (
                <div 
                  key={media._id} 
                  onClick={() => onSelect(media.url)}
                  className="group cursor-pointer border border-slate-200 rounded-lg overflow-hidden hover:border-indigo-500 hover:ring-2 hover:ring-indigo-200 transition"
                >
                  <div className="aspect-square bg-slate-100 relative">
                    {media.mimeType.startsWith("image/") ? (
                      <img src={media.url} alt={media.filename} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <ImageIcon size={32} />
                      </div>
                    )}
                  </div>
                  <div className="p-2 truncate text-xs text-center text-slate-600 group-hover:text-indigo-700 font-medium bg-slate-50">
                    {media.filename}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
