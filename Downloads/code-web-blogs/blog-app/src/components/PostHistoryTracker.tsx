"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function PostHistoryTracker({ postId }: { postId: string }) {
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && postId) {
      fetch("/api/user/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      }).catch(err => console.error("Error saving history:", err));
    }
  }, [status, postId]);

  return null;
}
