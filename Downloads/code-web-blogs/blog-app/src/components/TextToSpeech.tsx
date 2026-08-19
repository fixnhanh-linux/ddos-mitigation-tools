"use client";

import { useState, useEffect } from "react";
import { Play, Square, Pause } from "lucide-react";

export default function TextToSpeech({ contentHtml }: { contentHtml: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [synth, setSynth] = useState<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSynth(window.speechSynthesis);
    }
    return () => {
      if (synth) synth.cancel();
    };
  }, [synth]);

  const getTextFromHtml = (html: string) => {
    if (typeof document === "undefined") return html;
    const tempDivElement = document.createElement("div");
    tempDivElement.innerHTML = html;
    return tempDivElement.textContent || tempDivElement.innerText || "";
  };

  const handlePlay = () => {
    if (!synth) return;
    
    if (isPaused) {
      synth.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    synth.cancel(); // Dừng nếu đang đọc dở
    const textToRead = getTextFromHtml(contentHtml);
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "vi-VN";
    utterance.rate = 1.1; // Tốc độ đọc
    
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    synth.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (synth && isPlaying) {
      synth.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (synth) {
      synth.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-8">
      <div className="flex-1">
        <h4 className="font-bold text-indigo-900 text-sm">AI Đọc bài viết (BETA)</h4>
        <p className="text-xs text-indigo-600/80">Lười đọc chữ? Hãy để AI đọc nội dung này cho bạn nghe.</p>
      </div>
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button onClick={handlePlay} className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition shadow-sm" title="Phát">
            <Play size={18} className="ml-1" />
          </button>
        ) : (
          <button onClick={handlePause} className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition shadow-sm" title="Tạm dừng">
            <Pause size={18} />
          </button>
        )}
        
        {(isPlaying || isPaused) && (
          <button onClick={handleStop} className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition shadow-sm" title="Dừng hẳn">
            <Square size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
