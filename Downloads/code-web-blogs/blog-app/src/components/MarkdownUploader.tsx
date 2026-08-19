"use client";

import { useState, useRef } from "react";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function MarkdownUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
      toast.error("Vui lòng chọn file định dạng Markdown (.md)");
      return;
    }

    setIsUploading(true);

    try {
      const textContent = await file.text();
      
      const response = await fetch("/api/import-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content: textContent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi khi nhập file");
      }

      toast.success(data.message || "Nhập file thành công!");
      
      // Reload danh sách bài viết
      router.refresh();
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast.error(error.message || "Đã có lỗi xảy ra");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept=".md" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden" 
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isUploading ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />}
        <span>{isUploading ? "Đang xử lý..." : "Nhập file .md"}</span>
      </button>
    </div>
  );
}
