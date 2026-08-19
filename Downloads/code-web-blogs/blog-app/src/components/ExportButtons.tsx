"use client";

import { useState } from "react";
import { Download, FileText, FileDown } from "lucide-react";
import toast from "react-hot-toast";

interface ExportButtonsProps {
  slug: string;
}

export default function ExportButtons({ slug }: ExportButtonsProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportWord = () => {
    window.location.href = `/api/posts/${slug}/export?format=word`;
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPdf(true);
      toast.loading("Đang tạo PDF, vui lòng đợi...", { id: "export-pdf" });
      
      const element = document.getElementById("article-content");
      if (!element) {
        throw new Error("Không tìm thấy nội dung bài viết");
      }

      // Hide elements not needed in PDF
      const premiumBox = element.querySelector('.animate-pulse');
      if (premiumBox) (premiumBox as HTMLElement).style.display = 'none';

      // Dynamic import to prevent SSR issues with window object
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt: any = {
        margin:       0.5,
        filename:     `${slug}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(element).save();
      
      // Restore elements
      if (premiumBox) (premiumBox as HTMLElement).style.display = 'flex';
      
      toast.success("Xuất PDF thành công!", { id: "export-pdf" });
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi xuất PDF", { id: "export-pdf" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <button 
        onClick={handleExportWord}
        className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition font-medium text-sm w-full"
        title="Xuất ra Word"
      >
        <FileText size={18} />
        <span className="hidden lg:inline">Xuất Word</span>
      </button>
      <button 
        onClick={handleExportPDF}
        disabled={isExportingPdf}
        className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition font-medium text-sm w-full disabled:opacity-50"
        title="Xuất ra PDF"
      >
        <FileDown size={18} />
        <span className="hidden lg:inline">{isExportingPdf ? "Đang xử lý..." : "Xuất PDF"}</span>
      </button>
    </div>
  );
}
