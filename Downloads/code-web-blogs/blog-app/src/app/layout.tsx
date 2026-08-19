import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let googleVerification = "";
  let siteTitle = "Tên Website";
  let tagline = "Tạp chí Công nghệ & Đời sống";
  
  try {
    const connectDB = (await import("@/lib/mongodb")).default;
    const Setting = (await import("@/models/Setting")).default;
    await connectDB();
    
    // Fetch general settings
    const generalSettings = await Setting.find({ group: 'general' }).lean();
    const siteTitleSetting = generalSettings.find((s: any) => s.key === 'site_title');
    const taglineSetting = generalSettings.find((s: any) => s.key === 'tagline');
    const customHeaderSetting = generalSettings.find((s: any) => s.key === 'custom_header');
    
    siteTitle = siteTitleSetting?.value || siteTitle;
    tagline = taglineSetting?.value || tagline;
    
    // Check custom_header from general first, fallback to marketing
    let customHeaderVal = customHeaderSetting?.value;
    if (!customHeaderVal) {
      const marketingSettings = await Setting.find({ group: 'marketing' }).lean();
      const marketingCustomHeader = marketingSettings.find((s: any) => s.key === 'custom_header');
      customHeaderVal = marketingCustomHeader?.value;
    }

    if (customHeaderVal) {
      const match = customHeaderVal.match(/<meta[^>]+name="google-site-verification"[^>]+content="([^"]+)"/i);
      if (match) {
        googleVerification = match[1];
      }
    }
  } catch (e) {
    console.error("Error fetching global settings for metadata", e);
  }

  return {
    title: {
      template: `%s | ${siteTitle}`,
      default: `${siteTitle} - ${tagline}`,
    },
    description: "Cập nhật những xu hướng công nghệ mới nhất, chia sẻ kinh nghiệm lập trình và thiết kế UI/UX.",
    openGraph: {
      title: `${siteTitle} - ${tagline}`,
      description: "Cập nhật những xu hướng công nghệ mới nhất, chia sẻ kinh nghiệm lập trình và thiết kế UI/UX.",
      siteName: siteTitle,
      locale: "vi_VN",
      type: "website",
    },
    verification: {
      google: googleVerification || undefined,
    }
  };
}

import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import Script from "next/script";
import PageViewTracker from "@/components/PageViewTracker";
import connectDB from "@/lib/mongodb";
import Setting from "@/models/Setting";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let customHeader = "";
  let ga4Id = "";

  try {
    await connectDB();
    const settings = await Setting.findOne({ group: 'marketing' }).lean();
    if (settings && settings.settings) {
      customHeader = settings.settings.custom_header || "";
      ga4Id = settings.settings.ga4_id || "";
    }
  } catch (e) {
    console.error("Error fetching global settings", e);
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme') || 'system';
                let isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
        
        <PageViewTracker />
        
        {/* Google Analytics */}
        {ga4Id && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${ga4Id}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
