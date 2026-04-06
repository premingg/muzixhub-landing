import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastListenDate: string | null;
}

function getLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function useListeningStreak() {
  const { user } = useAuthStore();
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastListenDate: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchStreak = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("listening_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const row = data as any;
      const lastDate = row.last_listen_date;
      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStr = getLocalDateStr(yesterday);

      // Streak is active only if listened today or yesterday
      const isActive = lastDate === todayStr || lastDate === yesterdayStr;
      
      // If streak is broken (no listen in last 24h window), reset to 0 in DB too
      if (!isActive && row.current_streak > 0) {
        await supabase
          .from("listening_streaks")
          .update({ current_streak: 0, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
      }

      setStreak({
        currentStreak: isActive ? row.current_streak : 0,
        longestStreak: row.longest_streak,
        lastListenDate: lastDate,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStreak();
  }, [user]);

  return { ...streak, loading, refetch: fetchStreak };
}

/** Call this when a song starts playing to update the streak */
export async function updateListeningStreak() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = getLocalDateStr(new Date());

  const { data: existing } = await supabase
    .from("listening_streaks")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("listening_streaks").insert({
      user_id: user.id,
      current_streak: 1,
      longest_streak: 1,
      last_listen_date: today,
    } as any);
    return;
  }

  const row = existing as any;
  const lastDate = row.last_listen_date;

  if (lastDate === today) return; // Already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterday);

  let newStreak: number;
  if (lastDate === yesterdayStr) {
    newStreak = row.current_streak + 1;
  } else {
    newStreak = 1; // Reset - gap was more than 1 day
  }

  const newLongest = Math.max(newStreak, row.longest_streak);

  await supabase
    .from("listening_streaks")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_listen_date: today,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("user_id", user.id);
}
