import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { PageTransition } from "@/components/PageTransition";
import { Play, Share2, ListMusic, Music2, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  user_id: string;
  created_at: string;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
} as const;

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35 } },
} as const;

export default function PublicPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [creatorName, setCreatorName] = useState("");
  const [loading, setLoading] = useState(true);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data: pl } = await supabase.from("playlists").select("*").eq("id", id).maybeSingle();
      if (!pl) { setLoading(false); return; }
      setPlaylist(pl as PlaylistData);

      const [songsRes, profileRes] = await Promise.all([
        supabase
          .from("playlist_songs")
          .select("songs(*)")
          .eq("playlist_id", id)
          .order("position", { ascending: true }),
        supabase.from("profiles").select("username").eq("user_id", pl.user_id).maybeSingle(),
      ]);

      if (songsRes.data) {
        setSongs(songsRes.data.map((r) => r.songs as unknown as Song).filter(Boolean));
      }
      setCreatorName(profileRes.data?.username || "Unknown");
      setLoading(false);
    }
    load();
  }, [id]);

  const handlePlayAll = () => {
    if (songs.length > 0 && songs[0].audio_url) {
      usePlayerStore.getState().playSong(songs[0], songs);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (!playlist) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ListMusic className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-display font-bold text-foreground">Playlist not found</h1>
          <p className="text-muted-foreground">This playlist may have been removed or doesn't exist.</p>
        </div>
      </PageTransition>
    );
  }

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0);

  return (
    <PageTransition>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="h-48 w-48 rounded-2xl bg-secondary overflow-hidden shadow-2xl flex-shrink-0"
            whileHover={{ rotate: 2, scale: 1.03 }}
          >
            {playlist.cover_image_url ? (
              <CoverImg src={playlist.cover_image_url} alt={playlist.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                <ListMusic className="h-16 w-16 text-primary-foreground/50" />
              </div>
            )}
          </motion.div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Playlist</p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-tight">{playlist.name}</h1>
            {playlist.description && <p className="text-muted-foreground">{playlist.description}</p>}
            <p className="text-sm text-muted-foreground">
              Created by <span className="text-foreground font-medium">{creatorName}</span>
            </p>
            <div className="flex items-center gap-2 justify-center sm:justify-start text-sm text-muted-foreground">
              <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
              {totalDuration > 0 && (
                <>
                  <span>•</span>
                  <span>{Math.floor(totalDuration / 60)} min</span>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex items-center gap-3 justify-center sm:justify-start"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={handlePlayAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-6 py-3 rounded-full gradient-primary text-primary-foreground font-semibold glow-shadow"
            disabled={songs.length === 0}
          >
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            Play All
          </motion.button>

          <motion.button
            onClick={handleShare}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="h-11 w-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
          >
            <Share2 className="h-4.5 w-4.5 text-foreground" />
          </motion.button>
        </motion.div>

        {/* Song List */}
        {songs.length > 0 && (
          <motion.div className="space-y-1" variants={stagger} initial="hidden" animate="show">
            {songs.map((song, i) => (
              <motion.div
                key={song.id}
                variants={slideIn}
                whileHover={{ x: 4, backgroundColor: "hsl(var(--secondary) / 0.5)" }}
                className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors group"
                onClick={() => usePlayerStore.getState().playSong(song, songs)}
              >
                <span className="text-sm text-muted-foreground w-6 text-right font-mono">{i + 1}</span>
                <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0 relative group/art">
                  {song.cover_image_url ? (
                    <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-30" />
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity">
                    <Play className="h-3.5 w-3.5 text-white" fill="currentColor" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDuration(song.duration)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
