"use client";

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

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

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  async function registerServiceWorker() {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      setSubscription(sub);
      setIsSubscribed(true);
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
        // Note: should also delete from database in a complete implementation
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  }

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 bg-slate-50 dark:bg-white p-6 rounded-3xl border border-slate-100 dark:border-transparent">
      <div className={`p-4 rounded-2xl ${isSubscribed ? 'bg-indigo-50 text-[#5B45FF]' : 'bg-[#e2e8f0] text-slate-500'}`}>
        {isSubscribed ? <Bell size={26} /> : <BellOff size={26} strokeWidth={1.5} />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 text-[17px] leading-snug mb-1">Nhận thông báo bài mới</h4>
        <p className="text-[14.5px] text-slate-500 dark:text-[#64748b] font-medium leading-relaxed">Đừng bỏ lỡ những bài viết công nghệ hay nhất.</p>
      </div>
      <button 
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        className={`px-6 py-3.5 text-[14px] font-bold rounded-2xl transition whitespace-nowrap ${
          isSubscribed 
            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-200' 
            : 'bg-[#5B45FF] text-white hover:bg-[#4a36e0]'
        }`}
      >
        {isSubscribed ? 'Tắt thông báo' : 'Bật thông báo'}
      </button>
    </div>
  );
}
