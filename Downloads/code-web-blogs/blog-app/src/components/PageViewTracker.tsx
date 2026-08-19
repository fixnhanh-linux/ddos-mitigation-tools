"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Không track nếu đang ở môi trường dev (tuỳ chọn)
    // if (process.env.NODE_ENV === "development") return;

    if (!pathname) return;

    const trackView = async () => {
      try {
        await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            referer: document.referrer,
          }),
        });
      } catch (error) {
        // Silent fail
      }
    };

    trackView();
  }, [pathname]);

  return null; // Không render gì ra UI
}
