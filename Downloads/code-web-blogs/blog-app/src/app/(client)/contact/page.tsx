"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: null, text: "" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", text: data.message });
        setFormData({ name: "", email: "", message: "" });
      } else {
        setStatus({ type: "error", text: data.error });
      }
    } catch (error) {
      setStatus({ type: "error", text: "Lỗi kết nối máy chủ!" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 mb-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">Liên hệ với chúng tôi</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Bạn có câu hỏi, góp ý hay muốn hợp tác? Đừng ngần ngại để lại lời nhắn, đội ngũ Tên Website sẽ phản hồi bạn sớm nhất có thể.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Contact Info */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-xl">
          <div className="space-y-8">
            <h3 className="text-2xl font-bold">Thông tin liên hệ</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-indigo-300 flex-shrink-0" />
                <p className="text-indigo-50">Tòa nhà Landmark 81, Vinhomes Central Park, Bình Thạnh, TP.HCM</p>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="text-indigo-300 flex-shrink-0" />
                <p className="text-indigo-50">+84 987 654 321</p>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="text-indigo-300 flex-shrink-0" />
                <p className="text-indigo-50">hello@tenwebsite.com</p>
              </div>
            </div>
          </div>

          <div className="pt-12">
            <p className="text-sm text-indigo-200 font-medium mb-4">Kết nối qua Mạng xã hội</p>
            <div className="flex gap-4">
              <Link href="#" className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-white hover:text-indigo-600 flex items-center justify-center transition">FB</Link>
              <Link href="#" className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-white hover:text-indigo-600 flex items-center justify-center transition">TW</Link>
              <Link href="#" className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-white hover:text-indigo-600 flex items-center justify-center transition">IN</Link>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Gửi lời nhắn</h3>

          {status.type === "success" && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-medium">
              {status.text}
            </div>
          )}
          {status.type === "error" && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl font-medium">
              {status.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-900 dark:text-white"
                  placeholder="Nhập tên của bạn"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email liên hệ</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-900 dark:text-white"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nội dung tin nhắn</label>
              <textarea
                rows={5}
                required
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y text-slate-900 dark:text-white"
                placeholder="Bạn muốn trao đổi điều gì..."
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Đang gửi...</span>
              ) : (
                <>
                  <Send size={18} />
                  <span>Gửi tin nhắn ngay</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
