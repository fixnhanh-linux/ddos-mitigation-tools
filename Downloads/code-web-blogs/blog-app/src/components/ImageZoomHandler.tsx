"use client";

import { useEffect } from "react";

export default function ImageZoomHandler() {
  useEffect(() => {
    // Tìm tất cả các ảnh trong nội dung bài viết
    const article = document.getElementById("article-content");
    if (!article) return;

    const images = article.querySelectorAll("img");
    
    images.forEach((img) => {
      // Bỏ qua nếu ảnh đã được xử lý
      if (img.classList.contains("zoomable-image")) return;
      
      img.classList.add("zoomable-image");
      img.style.cursor = "zoom-in";
      
      img.addEventListener("click", () => {
        // Tạo lớp overlay
        const overlay = document.createElement("div");
        overlay.className = "fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out opacity-0 transition-opacity duration-300";
        
        // Tạo ảnh phóng to
        const zoomedImg = document.createElement("img");
        zoomedImg.src = img.src;
        zoomedImg.alt = img.alt;
        zoomedImg.className = "max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl scale-95 transition-transform duration-300";
        
        overlay.appendChild(zoomedImg);
        document.body.appendChild(overlay);
        
        // Kích hoạt hiệu ứng xuất hiện
        requestAnimationFrame(() => {
          overlay.classList.remove("opacity-0");
          zoomedImg.classList.remove("scale-95");
          zoomedImg.classList.add("scale-100");
        });
        
        // Xử lý đóng
        const closeOverlay = () => {
          overlay.classList.add("opacity-0");
          zoomedImg.classList.remove("scale-100");
          zoomedImg.classList.add("scale-95");
          setTimeout(() => {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
          }, 300);
        };
        
        overlay.addEventListener("click", closeOverlay);
        
        // Đóng khi nhấn ESC
        const escHandler = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            closeOverlay();
            window.removeEventListener("keydown", escHandler);
          }
        };
        window.addEventListener("keydown", escHandler);
      });
    });
  }, []);

  return null;
}
