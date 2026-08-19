"use client";

import { useState } from "react";

export default function NewsletterForm({ 
  placeholder = "Nhập email của bạn...", 
  buttonText = "Đăng ký" 
}: { 
  placeholder?: string; 
  buttonText?: string; 
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, text: "" });

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStatus({ type: "success", text: data.message });
      setEmail("");
    } catch (err: any) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md ml-auto">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <input 
          type="email" 
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder} 
          className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 outline-none" 
        />
        <button 
          type="submit" 
          disabled={isLoading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition whitespace-nowrap disabled:opacity-70"
        >
          {isLoading ? "..." : buttonText}
        </button>
      </form>
      {status.text && (
        <p className={`mt-2 text-sm ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
