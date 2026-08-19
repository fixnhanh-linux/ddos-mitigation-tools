"use client";

import { useAudio } from "@/context/AudioContext";
import { Headphones, Pause } from "lucide-react";

export default function PlayPodcastButton({ audioUrl, title }: { audioUrl: string, title: string }) {
  const { audioUrl: currentUrl, isPlaying, setAudio, togglePlay } = useAudio();

  const isThisAudio = currentUrl === audioUrl;

  const handlePlay = () => {
    if (isThisAudio) {
      togglePlay();
    } else {
      setAudio(audioUrl, title);
    }
  };

  return (
    <button
      onClick={handlePlay}
      className={`mt-6 mb-2 flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition shadow-sm ${
        isThisAudio && isPlaying
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
          : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      }`}
    >
      {isThisAudio && isPlaying ? (
        <>
          <Pause size={20} fill="currentColor" />
          <span>Tạm dừng Podcast</span>
        </>
      ) : (
        <>
          <Headphones size={20} />
          <span>Nghe Podcast bài viết này</span>
        </>
      )}
    </button>
  );
}
