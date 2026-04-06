import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

export function useLikedSongs() {
  const { user } = useAuthStore();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadLikes = useCallback(async () => {
    if (!user) { setLikedIds(new Set()); setLoading(false); return; }
    const { data } = await supabase
      .from("liked_songs")
      .select("song_id")
      .eq("user_id", user.id);
    setLikedIds(new Set((data || []).map((d) => d.song_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadLikes(); }, [loadLikes]);

  const toggleLike = useCallback(async (songId: string) => {
    if (!user) return;
    const isLiked = likedIds.has(songId);
    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(songId);
      else next.add(songId);
      return next;
    });

    if (isLiked) {
      await supabase.from("liked_songs").delete().eq("user_id", user.id).eq("song_id", songId);
    } else {
      await supabase.from("liked_songs").insert({ user_id: user.id, song_id: songId });
    }
  }, [user, likedIds]);

  const isLiked = useCallback((songId: string) => likedIds.has(songId), [likedIds]);

  return { likedIds, isLiked, toggleLike, loading, likeCount: likedIds.size, refresh: loadLikes };
}
