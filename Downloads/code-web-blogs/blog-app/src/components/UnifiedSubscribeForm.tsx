"use client";

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || "BP6AAegTzTUBbISSb-6K3KA5NeAzkqDj15Bj8op1tCfDKehahvH9UzkPAau47bGNyqR52i1X8GgrLoJulwzAa-w";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function UnifiedSubscribeForm() {
  const [email, setEmail] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  
  // Trạng thái bật tắt nhận thông báo
  const [enablePush, setEnablePush] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        setSubscription(sub);
        setIsSubscribed(true);
        setEnablePush(true);
      }
    } catch (e) {
      console.log('SW registration failed', e);
    }
  }

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
      setSubscription(sub);
      setIsSubscribed(true);
      
      // Save to database
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('Không thể đăng ký nhận thông báo. Vui lòng cấp quyền trong trình duyệt.');
    }
  }

  async function unsubscribeFromPush() {
    try {
      const sub = await subscription?.unsubscribe();
      if (sub) {
        setIsSubscribed(false);
        setSubscription(null);
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTogglePush = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnablePush(checked); // Cập nhật UI ngay lập tức để phản hồi nhanh
    
    if (checked && !isSubscribed) {
      await subscribeToPush();
    } else if (!checked && isSubscribed) {
      await unsubscribeFromPush();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Có lỗi xảy ra, vui lòng thử lại sau.");
        return;
      }
      
      toast.success(data.message || 'Đăng ký nhận bản tin thành công!');
      setEmail('');
    } catch (err) {
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="flex gap-3">
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Địa chỉ Email..." 
          className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white border-0 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#5B45FF] text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-300 font-medium" 
          required
          disabled={isSubmitting}
        />
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-7 py-3.5 bg-[#5B45FF] text-white rounded-2xl hover:bg-[#4a36e0] transition font-bold text-[15px] whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
        </button>
      </div>
      
      {isSupported && (
        <label className="flex items-center gap-2.5 cursor-pointer mt-1 select-none group w-fit">
          <div className={`flex items-center justify-center w-5 h-5 rounded border ${enablePush ? 'bg-[#5B45FF] border-[#5B45FF]' : 'bg-transparent border-slate-300 dark:border-slate-600 group-hover:border-[#5B45FF]'} transition-colors`}>
            {enablePush && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <input 
            type="checkbox" 
            checked={enablePush} 
            onChange={handleTogglePush} 
            className="hidden" 
          />
          <span className="text-[14px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
            {enablePush ? <Bell size={16} className="text-[#5B45FF]" /> : <BellOff size={16} />} 
            Nhận thông báo bài mới trực tiếp trên trình duyệt
          </span>
        </label>
      )}
    </form>
  );
}
