import React from "react";

interface ResponsivePictureProps {
  originalUrl: string;
  alt: string;
  variants?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  className?: string;
}

export default function ResponsivePicture({ originalUrl, alt, variants, className }: ResponsivePictureProps) {
  // Nếu không có variant nào, fallback về img bình thường
  if (!variants || (!variants.mobile && !variants.tablet && !variants.desktop)) {
    return <img src={originalUrl} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <picture>
      {/* Màn hình Mobile (dưới 640px) */}
      {variants.mobile && (
        <source media="(max-width: 639px)" srcSet={variants.mobile} />
      )}
      
      {/* Màn hình Tablet (từ 640px đến 1023px) */}
      {variants.tablet && (
        <source media="(min-width: 640px) and (max-width: 1023px)" srcSet={variants.tablet} />
      )}

      {/* Màn hình Desktop (từ 1024px trở lên) */}
      {variants.desktop && (
        <source media="(min-width: 1024px)" srcSet={variants.desktop} />
      )}

      {/* Fallback ảnh gốc nếu không match các điều kiện trên hoặc variant bị thiếu */}
      <img src={originalUrl} alt={alt} className={className} loading="lazy" />
    </picture>
  );
}
