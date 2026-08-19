"use client";

import { useState, useRef } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2, X, Check } from "lucide-react";

interface ImageEditorModalProps {
  media: any;
  onClose: () => void;
  onSuccess: (updatedMedia: any) => void;
}

const ASPECT_RATIOS = {
  mobile: 9 / 16,
  tablet: 4 / 3,
  desktop: 16 / 9,
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function ImageEditorModal({ media, onClose, onSuccess }: ImageEditorModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [activeTab, setActiveTab] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [isSaving, setIsSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, ASPECT_RATIOS[activeTab]));
  }

  const handleTabChange = (tab: "mobile" | "tablet" | "desktop") => {
    setActiveTab(tab);
    if (imgRef.current) {
      setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, ASPECT_RATIOS[tab]));
    }
  };

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/jpeg", 0.95);
    });
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    setIsSaving(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      
      const formData = new FormData();
      formData.append("file", croppedBlob, `${media.filename}-cropped.jpg`);
      formData.append("variantType", activeTab);

      const res = await fetch(`/api/media/${media._id}/crop`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Lỗi khi lưu ảnh");
      
      const data = await res.json();
      onSuccess(data.media);
    } catch (e) {
      alert("Đã xảy ra lỗi khi lưu ảnh cắt.");
      console.error(e);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Chỉnh sửa ảnh theo thiết bị</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-500">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-900 flex justify-center gap-4 border-b border-slate-100 dark:border-slate-700">
          <button onClick={() => handleTabChange("mobile")} className={`px-6 py-2 rounded-lg font-medium text-sm transition ${activeTab === "mobile" ? "bg-indigo-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"}`}>
            Bản Mobile (9:16)
          </button>
          <button onClick={() => handleTabChange("tablet")} className={`px-6 py-2 rounded-lg font-medium text-sm transition ${activeTab === "tablet" ? "bg-indigo-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"}`}>
            Bản Tablet (4:3)
          </button>
          <button onClick={() => handleTabChange("desktop")} className={`px-6 py-2 rounded-lg font-medium text-sm transition ${activeTab === "desktop" ? "bg-indigo-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"}`}>
            Bản Desktop (16:9)
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-900 flex justify-center items-center min-h-[400px]">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={ASPECT_RATIOS[activeTab]}
            className="max-w-full max-h-full rounded shadow-sm"
          >
            <img
              ref={imgRef}
              src={media.url}
              alt="Crop"
              onLoad={onImageLoad}
              style={{ maxHeight: "500px", width: "auto" }}
            />
          </ReactCrop>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 rounded-b-2xl">
          <p className="text-sm text-slate-500">
            {media.variants?.[activeTab] ? (
              <span className="text-green-600 font-medium flex items-center gap-1"><Check size={16}/> Đã có bản tuỳ chỉnh cho {activeTab}</span>
            ) : (
              <span>Chưa tạo bản tuỳ chỉnh cho {activeTab}</span>
            )}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              Hủy bỏ
            </button>
            <button onClick={handleSave} disabled={isSaving || !completedCrop} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Cắt & Lưu Bản {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
