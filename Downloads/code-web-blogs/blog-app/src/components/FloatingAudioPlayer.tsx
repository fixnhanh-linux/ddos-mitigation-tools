"use client";

import { useAudio } from "@/context/AudioContext";
import { Play, Pause, X, Music } from "lucide-react";
import { useEffect, useState } from "react";

export default function FloatingAudioPlayer() {
  const { audioUrl, audioTitle, isPlaying, togglePlay, closeAudio, audioRef } = useAudio();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener("timeupdate", updateProgress);
    return () => audio.removeEventListener("timeupdate", updateProgress);
  }, [audioRef]);

  if (!audioUrl) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden w-80 border border-slate-700/50 backdrop-blur-xl">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800 w-full relative">
          <div
            className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
            <Music size={20} className="text-indigo-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-indigo-400 font-medium mb-0.5 uppercase tracking-wider">Đang phát</p>
            <p className="text-sm font-semibold truncate text-slate-100" title={audioTitle || "Podcast"}>
              {audioTitle || "Podcast Bài viết"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-full transition shadow-lg shadow-indigo-900/50 text-white"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={closeAudio}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
