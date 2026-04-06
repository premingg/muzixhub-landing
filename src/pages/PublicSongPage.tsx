import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { PageTransition } from "@/components/PageTransition";
import { Play, Share2, ListPlus, Music2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function PublicSongPage() {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase.from("songs").select("*").eq("id", id).maybeSingle();
      setSong(data as Song | null);
      setLoading(false);
    }
    load();
  }, [id]);

  const handlePlay = () => {
    if (song?.audio_url) {
      usePlayerStore.getState().playSong(song, [song]);
    } else {
      toast.error("No audio available");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
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

  if (!song) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Music2 className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-display font-bold text-foreground">Song not found</h1>
          <p className="text-muted-foreground">This song may have been removed or doesn't exist.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-8">
        {/* Hero */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="h-48 w-48 sm:h-56 sm:w-56 rounded-2xl bg-secondary overflow-hidden shadow-2xl flex-shrink-0"
            whileHover={{ scale: 1.03 }}
          >
            {song.cover_image_url ? (
              <CoverImg src={song.cover_image_url} alt={song.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                <Music2 className="h-16 w-16 text-primary-foreground/50" />
              </div>
            )}
          </motion.div>

          <div className="flex-1 text-center sm:text-left space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Song</p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-tight">{song.title}</h1>
            <p className="text-lg text-muted-foreground">{song.artist}</p>
            {song.album && <p className="text-sm text-muted-foreground/70">Album: {song.album}</p>}
            <div className="flex items-center gap-2 justify-center sm:justify-start text-sm text-muted-foreground">
              <Play className="h-3.5 w-3.5" />
              <span>{song.plays?.toLocaleString() || 0} plays</span>
              {song.genre && (
                <>
                  <span>•</span>
                  <span>{song.genre}</span>
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
            onClick={handlePlay}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-6 py-3 rounded-full gradient-primary text-primary-foreground font-semibold glow-shadow"
          >
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            Play
          </motion.button>

          <motion.button
            onClick={handleShare}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="h-11 w-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
            title="Share"
          >
            <Share2 className="h-4.5 w-4.5 text-foreground" />
          </motion.button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
