"use client";

import { createContext, useContext, useState, useRef, useEffect } from "react";

interface AudioContextType {
  audioUrl: string | null;
  audioTitle: string | null;
  isPlaying: boolean;
  setAudio: (url: string, title: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  closeAudio: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const setAudio = (url: string, title: string) => {
    if (url === audioUrl) {
      // Toggle play if clicking the same audio
      togglePlay();
      return;
    }
    setAudioUrl(url);
    setAudioTitle(title);
    setIsPlaying(true);
  };

  const play = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const closeAudio = () => {
    setAudioUrl(null);
    setAudioTitle(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [audioUrl, isPlaying]);

  return (
    <AudioContext.Provider value={{ audioUrl, audioTitle, isPlaying, setAudio, play, pause, togglePlay, closeAudio, audioRef }}>
      {children}
      {/* Hidden audio element used globally */}
      <audio 
        ref={audioRef} 
        src={audioUrl || undefined} 
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
