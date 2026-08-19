"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { Toaster } from "react-hot-toast";
import OtpGuard from "./OtpGuard";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <OtpGuard>
          {children}
          <Toaster position="top-right" />
        </OtpGuard>
      </LanguageProvider>
    </SessionProvider>
  );
}
