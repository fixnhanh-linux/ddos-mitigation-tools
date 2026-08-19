import Link from "next/link";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";
import Setting from "@/models/Setting";
import ScrollToTop from "@/components/ScrollToTop";
import NewsletterForm from "@/components/NewsletterForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AudioProvider } from "@/context/AudioContext";
import FloatingAudioPlayer from "@/components/FloatingAudioPlayer";
import ClientHeader from "@/components/ClientHeader";

import { getDictionary } from "@/lib/getDictionary";

export const revalidate = 60; // ISR

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await connectDB();
  const categoriesRaw = await Category.find().lean();
  const categories = categoriesRaw.map((cat: any) => ({
    _id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug
  }));
  const session = await getServerSession(authOptions);
  
  const t = await getDictionary();

  const generalSettings = await Setting.find({ group: 'general' }).lean();
  const siteTitleSetting = generalSettings.find((s: any) => s.key === 'site_title');
  const maintenanceSetting = generalSettings.find((s: any) => s.key === 'maintenance_mode');

  const getSetting = (key: string, defaultValue: any) => generalSettings.find((s: any) => s.key === key)?.value ?? defaultValue;

  const siteTitle = getSetting('site_title', "Tên Website");
  const isMaintenanceMode = getSetting('maintenance_mode', false) === true;

  const footerNewsletterTitle = getSetting('footer_newsletter_title', "");
  const footerNewsletterDesc = getSetting('footer_newsletter_desc', "");
  const footerCopyright = getSetting('footer_copyright', "");
  const footerTech = getSetting('footer_tech', "Được xây dựng bằng Next.js, MongoDB và TailwindCSS.");
  const footerNewsletterPlaceholder = getSetting('footer_newsletter_placeholder', "Nhập email của bạn...");
  const footerNewsletterBtn = getSetting('footer_newsletter_btn', "Đăng ký");

  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'admin' || userRole === 'super-admin';

  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-center px-4">
        <div className="max-w-xl w-full space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="relative w-full aspect-video mx-auto max-w-md">
            {/* Tự vẽ SVG Hoạt hình bằng Code */}
            <svg viewBox="0 0 500 300" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#312e81" />
                  <stop offset="100%" stopColor="#1e1b4b" />
                </linearGradient>
                <linearGradient id="gradWire" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Hào quang nền */}
              <circle cx="250" cy="150" r="100" fill="#4f46e5" className="animate-ping opacity-10" />

              {/* Server Bên Trái */}
              <rect x="40" y="50" width="120" height="200" rx="12" fill="url(#grad1)" stroke="#4f46e5" strokeWidth="2" />
              <rect x="50" y="70" width="100" height="24" rx="4" fill="#1e293b" />
              <rect x="50" y="110" width="100" height="24" rx="4" fill="#1e293b" />
              <rect x="50" y="150" width="100" height="24" rx="4" fill="#1e293b" />
              <rect x="50" y="190" width="100" height="24" rx="4" fill="#1e293b" />

              {/* Đèn nháy Server Trái */}
              <circle cx="135" cy="82" r="5" fill="#10b981" className="animate-[pulse_1s_infinite]" filter="url(#glow)" />
              <circle cx="135" cy="122" r="5" fill="#ef4444" className="animate-[pulse_0.5s_infinite]" filter="url(#glow)" />
              <circle cx="135" cy="162" r="5" fill="#3b82f6" className="animate-[pulse_2s_infinite]" filter="url(#glow)" />
              <circle cx="135" cy="202" r="5" fill="#10b981" className="animate-[pulse_1.5s_infinite]" />

              {/* Server Bên Phải */}
              <rect x="340" y="50" width="120" height="200" rx="12" fill="url(#grad1)" stroke="#4f46e5" strokeWidth="2" />
              <rect x="350" y="70" width="100" height="24" rx="4" fill="#1e293b" />
              <rect x="350" y="110" width="100" height="24" rx="4" fill="#1e293b" />
              <rect x="350" y="150" width="100" height="24" rx="4" fill="#1e293b" />

              {/* Đèn nháy Server Phải */}
              <circle cx="435" cy="82" r="5" fill="#10b981" className="animate-[pulse_2s_infinite]" filter="url(#glow)" />
              <circle cx="435" cy="122" r="5" fill="#f59e0b" className="animate-[pulse_1.2s_infinite]" filter="url(#glow)" />
              <circle cx="435" cy="162" r="5" fill="#ef4444" className="animate-[pulse_0.8s_infinite]" filter="url(#glow)" />

              {/* Dây điện bị đứt (Bên Trái) */}
              <path d="M 160 162 Q 210 162 230 170" fill="none" stroke="url(#gradWire)" strokeWidth="12" strokeLinecap="round" className="animate-[pulse_1s_infinite]" />

              {/* Dây điện bị đứt (Bên Phải) */}
              <path d="M 340 122 Q 290 122 260 140" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />

              {/* Tia lửa điện (Sparks) */}
              <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: '245px 155px' }}>
                <path d="M 245 145 L 250 130 L 255 145 L 270 150 L 255 155 L 250 170 L 245 155 L 230 150 Z" fill="#eab308" filter="url(#glow)" className="animate-[ping_1.5s_infinite]" />
                <circle cx="235" cy="140" r="4" fill="#ef4444" className="animate-[bounce_1s_infinite]" />
                <circle cx="255" cy="170" r="5" fill="#3b82f6" className="animate-[pulse_0.5s_infinite]" filter="url(#glow)" />
              </g>

              {/* Tua vít đang sửa (Screwdriver) */}
              <g className="animate-[bounce_2s_infinite]" style={{ transformOrigin: '250px 100px' }}>
                {/* Thân tua vít */}
                <rect x="246" y="50" width="8" height="70" rx="2" fill="#94a3b8" />
                {/* Cán tua vít */}
                <rect x="238" y="20" width="24" height="45" rx="6" fill="#f59e0b" />
                <rect x="238" y="30" width="24" height="5" fill="#d97706" />
                <rect x="238" y="45" width="24" height="5" fill="#d97706" />
                {/* Đầu tua vít */}
                <path d="M 245 120 L 250 135 L 255 120 Z" fill="#cbd5e1" />
              </g>
            </svg>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 relative z-10">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4">Website đang nâng cấp</h1>
            <p className="text-slate-600 leading-relaxed font-medium">Hệ thống của chúng tôi đang tiến hành đấu nối lại máy chủ và nâng cấp đường truyền. Vui lòng quay lại sau ít phút nhé!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AudioProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <ClientHeader 
          siteTitle={siteTitle} 
          categories={categories} 
          session={session} 
          translations={t} 
        />

        <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 py-12">
          {children}
        </main>

        <footer className="bg-slate-900 text-slate-300 py-16 mt-auto">
          <div className="max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center border-b border-slate-800 pb-12 mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">{footerNewsletterTitle}</h3>
              <p className="text-slate-400 max-w-md">{footerNewsletterDesc}</p>
            </div>
            <NewsletterForm placeholder={footerNewsletterPlaceholder} buttonText={footerNewsletterBtn} />
          </div>
          <div className="max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} {siteTitle}. {footerCopyright}</p>
            <p className="mt-2 text-slate-600">{footerTech}</p>
          </div>
        </footer>

        {/* Floating Scroll To Top */}
        <ScrollToTop />

        {/* Global Audio Player */}
        <FloatingAudioPlayer />
      </div>
    </AudioProvider>
  );
}
