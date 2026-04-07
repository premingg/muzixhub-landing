import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { LogOut, Heart, Clock, BarChart3, Disc3, Play, Flame, Trophy, Activity, Camera, User, Crown } from "lucide-react";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { PageTransition } from "@/components/PageTransition";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { motion } from "framer-motion";
import { useListeningStreak } from "@/hooks/useListeningStreak";
import { ListeningHeatmap } from "@/components/ListeningHeatmap";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
} as const;

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 200, damping: 20 } },
} as const;

const slideInLeft = {
  hidden: { opacity: 0, x: -30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
} as const;

const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
} as const;

const popIn = {
  hidden: { opacity: 0, scale: 0.8, y: 15 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } },
} as const;

interface TopArtist { name: string; image_url: string | null; totalPlays: number; }

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl p-4 border border-border/50">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function ArtistsSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 w-32">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { profile, user, logout, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [topGenre, setTopGenre] = useState("—");
  const [mostPlayed, setMostPlayed] = useState<(Song & { playCount: number })[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const { likeCount } = useLikedSongs();
  const { currentStreak, longestStreak, loading: streakLoading } = useListeningStreak();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  

  const medalColors = ["text-amber-400", "text-slate-400", "text-orange-600"];

  useEffect(() => {
    async function load() {
      if (!user) return;

      // Get minutes from user_listening_activity (accurate source)
      const { data: activityData } = await supabase
        .from("user_listening_activity")
        .select("minutes_listened")
        .eq("user_id", user.id);
      
      if (activityData && activityData.length > 0) {
        const total = (activityData as any[]).reduce((sum, a) => sum + (a.minutes_listened || 0), 0);
        setTotalMinutes(Math.round(total));
      }

      const { data: recentData } = await supabase
        .from("recently_played")
        .select("song_id, played_at, songs(*)")
        .eq("user_id", user.id)
        .order("played_at", { ascending: false });

      if (recentData && recentData.length > 0) {
        const genreCount: Record<string, number> = {};
        const songPlayCount: Record<string, { song: Song; count: number }> = {};
        const artistPlays: Record<string, number> = {};

        for (const r of recentData) {
          const song = r.songs as unknown as Song;
          if (song) {
            if (song.genre) genreCount[song.genre] = (genreCount[song.genre] || 0) + 1;
            if (!songPlayCount[song.id]) songPlayCount[song.id] = { song, count: 0 };
            songPlayCount[song.id].count++;
            artistPlays[song.artist] = (artistPlays[song.artist] || 0) + 1;
          }
        }

        const topG = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];
        if (topG) setTopGenre(topG[0]);

        const topSongs = Object.values(songPlayCount)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((item) => ({ ...item.song, playCount: item.count }));
        setMostPlayed(topSongs);

        // Top artists
        const sortedArtists = Object.entries(artistPlays)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sortedArtists.length > 0) {
          const artistNames = sortedArtists.map(([name]) => name);
          const { data: artistsData } = await supabase
            .from("artists")
            .select("name, image_url");

          const imageMap = new Map<string, string | null>();
          if (artistsData) {
            for (const a of artistsData) {
              for (const artistName of artistNames) {
                if (a.name.toLowerCase() === artistName.toLowerCase()) {
                  imageMap.set(artistName, a.image_url);
                }
              }
            }
          }
          setTopArtists(
            sortedArtists.map(([name, plays]) => ({
              name,
              image_url: imageMap.get(name) || null,
              totalPlays: plays,
            }))
          );
        }
      }

      setLoading(false);
    }
    load();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ profile_image: publicUrl }).eq("user_id", user.id);
      if (updateError) throw updateError;
      await fetchProfile(user.id);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          {profile?.profile_image ? (
            <div className="relative group/avatar">
              <motion.img src={profile.profile_image} alt={profile.username} className="h-28 w-28 rounded-full object-cover glow-shadow" whileHover={{ scale: 1.08, rotate: 3 }} transition={{ type: "spring", stiffness: 300 }} />
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer" disabled={uploadingAvatar}>
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
          ) : (
            <div className="relative group/avatar">
              <motion.div className="h-28 w-28 rounded-full gradient-primary flex items-center justify-center text-4xl font-display font-bold text-primary-foreground glow-shadow" whileHover={{ scale: 1.08, rotate: 3 }} transition={{ type: "spring", stiffness: 300 }}>
                {profile?.username?.[0]?.toUpperCase() || "U"}
              </motion.div>
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer" disabled={uploadingAvatar}>
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-display font-bold text-foreground">{profile?.username || "User"}</h1>
            <p className="text-muted-foreground mt-1">{profile?.email}</p>
            <motion.button onClick={handleLogout} className="mt-3 flex items-center gap-2 text-sm text-destructive hover:opacity-80 transition-opacity mx-auto sm:mx-0" whileHover={{ x: 4 }} whileTap={{ scale: 0.95 }}>
              <LogOut className="h-4 w-4" /> Sign out
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        {loading ? <StatsSkeleton /> : (
          <motion.div className="grid grid-cols-2 md:grid-cols-3 gap-3" variants={staggerContainer} initial="hidden" animate="show">
            {[
              { label: "Liked Songs", value: likeCount.toString(), icon: Heart, color: "from-rose-500/20 to-rose-500/5" },
              { label: "Minutes Listened", value: totalMinutes.toString(), icon: Clock, color: "from-accent/20 to-accent/5" },
              { label: "Top Genre", value: topGenre, icon: BarChart3, color: "from-emerald-500/20 to-emerald-500/5" },
            ].map((s) => (
              <motion.div key={s.label} variants={scaleIn} whileHover={{ scale: 1.06, y: -4 }} whileTap={{ scale: 0.97 }} className={`bg-gradient-to-br ${s.color} rounded-xl p-4 border border-border/50 cursor-default group`}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                  <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">{s.label}</p>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Top Artists */}
        {loading ? (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-display font-bold text-foreground">Your Top Artists</h2>
            </div>
            <ArtistsSkeleton />
          </section>
        ) : topArtists.length > 0 ? (
          <motion.section initial="hidden" animate="show" variants={staggerContainer}>
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-display font-bold text-foreground">Your Top Artists</h2>
            </motion.div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {topArtists.map((artist, i) => (
                <motion.div
                  key={artist.name}
                  variants={popIn}
                  whileHover={{ y: -6, scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 w-32"
                  onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                >
                  <div className="relative">
                    <div className={`h-24 w-24 rounded-full bg-secondary overflow-hidden ${i < 3 ? "ring-2 ring-amber-500/30" : ""}`}>
                      {artist.image_url ? (
                        <img src={artist.image_url} alt={artist.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                          <User className="h-8 w-8 text-primary-foreground/50" />
                        </div>
                      )}
                    </div>
                    {i < 3 ? (
                      <div className={`absolute -top-1 -right-1 ${medalColors[i]}`}>
                        <Crown className="h-5 w-5 fill-current" />
                      </div>
                    ) : (
                      <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground text-center truncate w-full">{artist.name}</p>
                  <p className="text-xs text-muted-foreground">{artist.totalPlays} plays</p>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {/* Listening Streak */}
        {!streakLoading && currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
            className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-yellow-500/15 rounded-xl p-5 border border-orange-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Listening Streak</p>
                  <p className="text-3xl font-display font-bold text-foreground">
                    {currentStreak} <span className="text-base font-normal text-muted-foreground">day{currentStreak !== 1 ? "s" : ""}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-card/50 rounded-lg px-3 py-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Best</p>
                  <p className="text-sm font-bold text-foreground">{longestStreak} day{longestStreak !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Listening Activity Heatmap */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-display font-bold text-foreground">Listening Activity</h2>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border/50">
            <ListeningHeatmap />
          </div>
        </motion.section>

        {/* Most Played Songs */}
        {mostPlayed.length > 0 && (
          <motion.section initial="hidden" animate="show" variants={staggerContainer}>
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
              <Disc3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-display font-bold text-foreground">Most Played</h2>
            </motion.div>
            <div className="space-y-1">
              {mostPlayed.map((song, i) => (
                <motion.div
                  key={song.id}
                  variants={i % 2 === 0 ? slideInLeft : slideInRight}
                  whileHover={{ x: 6, backgroundColor: "hsl(var(--secondary) / 0.6)" }}
                  className="flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer"
                  onClick={() => usePlayerStore.getState().playSong(song, mostPlayed)}
                >
                  <span className="text-sm font-display font-bold text-muted-foreground w-6 text-right">{i + 1}</span>
                  <div className="relative h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0 group/art">
                    {song.cover_image_url ? <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30" />}
                    <motion.button onClick={(e) => { e.stopPropagation(); usePlayerStore.getState().playSong(song, mostPlayed); }} className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/art:opacity-100 transition-opacity cursor-pointer" whileTap={{ scale: 0.85 }}>
                      <Play className="h-3.5 w-3.5 text-white/70 ml-0.5" fill="currentColor" />
                    </motion.button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{song.playCount} plays</span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

      </div>
    </PageTransition>
  );
}