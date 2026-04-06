import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { PageTransition } from "@/components/PageTransition";
import { Play, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const moodGradients: Record<string, string> = {
  Chill: "from-sky-500/30 to-teal-500/20",
  Workout: "from-red-500/30 to-orange-500/20",
  Focus: "from-indigo-500/30 to-blue-500/20",
  "Road Trip": "from-amber-500/30 to-yellow-500/20",
  "Late Night": "from-violet-500/30 to-purple-500/20",
  Party: "from-pink-500/30 to-fuchsia-500/20",
  Sad: "from-slate-500/30 to-blue-500/20",
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
} as const;

export default function MoodPlaylist() {
  const { moodId } = useParams<{ moodId: string }>();
  const navigate = useNavigate();
  const [mood, setMood] = useState<{ name: string; emoji: string } | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    async function load() {
      if (!moodId) return;

      const { data: moodData } = await supabase
        .from("moods")
        .select("name, emoji")
        .eq("id", moodId)
        .single();

      if (moodData) setMood(moodData);

      const { data: songMoods } = await supabase
        .from("song_moods")
        .select("song_id, songs(*)")
        .eq("mood_id", moodId);

      if (songMoods) {
        setSongs(songMoods.map((sm: any) => sm.songs).filter(Boolean) as Song[]);
      }

      setLoading(false);
    }
    load();
  }, [moodId]);

  const gradient = mood ? moodGradients[mood.name] || "from-primary/20 to-secondary/20" : "";

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 md:p-8 border border-border/30`}
        >
          <motion.button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors mb-4"
            whileHover={{ x: -4 }}
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{mood?.emoji}</span>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">{mood?.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">{songs.length} songs</p>
            </div>
          </div>
          {songs.length > 0 && (
            <motion.button
              onClick={() => usePlayerStore.getState().playSong(songs[0], songs)}
              className="mt-4 gradient-primary text-primary-foreground px-6 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" /> Play All
            </motion.button>
          )}
        </motion.div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No songs tagged with this mood yet.</p>
        ) : (
          <motion.div className="space-y-1" variants={stagger} initial="hidden" animate="show">
            {songs.map((s, i) => (
              <motion.div
                key={s.id}
                variants={fadeUp}
                whileHover={{ x: 4, backgroundColor: "hsl(var(--secondary) / 0.5)" }}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group"
                onClick={() => usePlayerStore.getState().playSong(s, songs)}
              >
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0 relative">
                  {s.cover_image_url ? (
                    <CoverImg src={s.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-30" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-3.5 w-3.5 text-white/70 ml-0.5" fill="currentColor" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDuration(s.duration)}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
