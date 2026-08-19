"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Star } from "lucide-react";

interface UserPoints {
  _id: string;
  name: string;
  points: number;
}

export default function LeaderboardWidget() {
  const [users, setUsers] = useState<UserPoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch("/api/users/leaderboard");
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) return null;
  if (users.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-3xl p-6 shadow-sm border border-amber-200/50 dark:border-slate-700 transition-colors relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -top-10 -right-10 text-amber-200/40 dark:text-amber-900/20 rotate-12">
        <Trophy size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="text-amber-500" size={20} />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bảng Phong Thần</h3>
        </div>
        
        <div className="space-y-4">
          {users.map((user, index) => {
            let rankColor = "text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400";
            if (index === 0) rankColor = "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-500";
            if (index === 1) rankColor = "text-slate-600 bg-slate-200 dark:bg-slate-600 dark:text-slate-300";
            if (index === 2) rankColor = "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-500";

            return (
              <div key={user._id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rankColor}`}>
                    {index < 3 ? <Medal size={16} /> : index + 1}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {user.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-900/50 px-2 py-1 rounded-full border border-amber-100 dark:border-slate-700">
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{user.points}</span>
                  <Star className="text-amber-500" size={12} fill="currentColor" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
