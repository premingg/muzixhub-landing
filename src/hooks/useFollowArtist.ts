import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

interface FollowedArtist {
  id: string;
  artist_id: string;
  artist_name: string;
  artist_image: string | null;
}

export function useFollowArtist(artistName: string) {
  const { user } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFollowState = useCallback(async () => {
    if (!artistName) return;

    // Get artist id from name
    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .ilike("name", artistName)
      .maybeSingle();

    if (!artist) { setLoading(false); return; }

    // Get followers count
    const { count } = await supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artist.id);

    setFollowersCount(count || 0);

    // Check if current user follows
    if (user) {
      const { data: follow } = await supabase
        .from("follows")
        .select("id")
        .eq("user_id", user.id)
        .eq("artist_id", artist.id)
        .maybeSingle();

      setIsFollowing(!!follow);
    }

    setLoading(false);
  }, [artistName, user]);

  useEffect(() => { loadFollowState(); }, [loadFollowState]);

  const toggleFollow = useCallback(async () => {
    if (!user || !artistName) return;

    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .ilike("name", artistName)
      .maybeSingle();

    if (!artist) return;

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("user_id", user.id)
        .eq("artist_id", artist.id);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from("follows")
        .insert({ user_id: user.id, artist_id: artist.id });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  }, [user, artistName, isFollowing]);

  return { isFollowing, followersCount, toggleFollow, loading };
}

export function useFollowedArtists() {
  const { user } = useAuthStore();
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) { setArtists([]); setLoading(false); return; }

      const { data: follows } = await supabase
        .from("follows")
        .select("id, artist_id")
        .eq("user_id", user.id);

      if (!follows || follows.length === 0) {
        setArtists([]);
        setLoading(false);
        return;
      }

      const artistIds = follows.map((f: any) => f.artist_id);
      const { data: artistsData } = await supabase
        .from("artists")
        .select("id, name, image_url")
        .in("id", artistIds);

      const result = (artistsData || []).map((a: any) => ({
        id: follows.find((f: any) => f.artist_id === a.id)?.id || a.id,
        artist_id: a.id,
        artist_name: a.name,
        artist_image: a.image_url,
      }));

      setArtists(result);
      setLoading(false);
    }
    load();
  }, [user]);

  return { artists, loading };
}
