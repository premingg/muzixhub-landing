import {
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX,
  Heart, ChevronUp, LayoutList, Shuffle, Repeat, Repeat1, X
} from "lucide-react";
import { motion } from "framer-motion";
import { usePlayerStore } from "@/store/playerStore";
import { useSongCover } from "@/hooks/useTelegramImage";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { useDraggableSlider } from "@/hooks/useDraggableSlider";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function formatTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, duration, volume,
    shuffle, repeat,
    togglePlay, nextSong, prevSong, setVolume, seekTo,
    toggleFullPlayer, toggleQueue, toggleShuffle, toggleRepeat, closePlayer,
  } = usePlayerStore();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const coverUrl = useSongCover(currentSong);

  const trackSlider = useDraggableSlider((pct) => { if (duration) seekTo(pct * duration); });
  const volumeSlider = useDraggableSlider((pct) => setVolume(pct));

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const volumePercent = volume * 100;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* ─── MOBILE ─── */}
      <div className="md:hidden">
        <div className="h-[2px] w-full bg-white/10 relative">
          <div className="absolute inset-y-0 left-0 gradient-primary" style={{ width: `${progressPercent}%` }} />
        </div>
        <div
          className="h-16 backdrop-blur-2xl bg-black/70 border-t border-white/5 flex items-center px-3 gap-3"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest("button")) toggleFullPlayer();
          }}
        >
          <div className="h-11 w-11 rounded-lg bg-secondary flex-shrink-0 overflow-hidden">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full gradient-primary opacity-50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentSong.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); prevSong(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground active:text-foreground">
              <SkipBack className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center">
                {isPlaying ? <Pause className="h-4 w-4 text-primary-foreground" fill="currentColor" /> : <Play className="h-4 w-4 text-primary-foreground ml-0.5" fill="currentColor" />}
              </div>
            </button>
            <button onClick={(e) => { e.stopPropagation(); nextSong(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground active:text-foreground">
              <SkipForward className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); closePlayer(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground active:text-foreground" aria-label="Close mini player">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP ─── */}
      <div className="hidden md:flex h-[72px] backdrop-blur-2xl bg-black/70 items-center px-6" style={{ borderTop: "1px solid hsl(var(--primary) / 0.3)", boxShadow: "0 -4px 20px hsl(var(--primary) / 0.08)" }}>
        {/* Left: art + info + heart */}
        <div className="flex items-center gap-3 w-[30%] min-w-0 cursor-pointer group" onClick={toggleFullPlayer}>
          <motion.div whileHover={{ scale: 1.08, rotate: 3 }} whileTap={{ scale: 0.95 }} className="h-12 w-12 rounded-lg bg-secondary flex-shrink-0 overflow-hidden shadow-lg relative">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full gradient-primary opacity-50" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="flex items-end gap-[2px] h-3">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-[3px] bg-white/80 rounded-full" animate={{ height: ["4px", "12px", "4px"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors duration-200">{currentSong.title}</p>
            <p
              className="text-xs text-muted-foreground truncate hover:text-primary hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); if (currentSong.artist) navigate(`/artist/${encodeURIComponent(currentSong.artist)}`); }}
            >
              {currentSong.artist}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 1.4 }}
            onClick={(e) => { e.stopPropagation(); toggleLike(currentSong.id); toast.success(isLiked(currentSong.id) ? "Removed from liked songs" : "Added to liked songs"); }}
            className={`flex-shrink-0 transition-colors duration-200 ${isLiked(currentSong.id) ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <Heart className={`h-4 w-4 ${isLiked(currentSong.id) ? "fill-primary" : ""}`} />
          </motion.button>
        </div>

        {/* Center: controls + progress */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleShuffle} className={`transition-colors duration-200 ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={prevSong} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }} onClick={togglePlay} className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center" style={{ boxShadow: "0 0 16px hsl(var(--primary) / 0.35)" }}>
              {isPlaying ? <Pause className="h-5 w-5 text-primary-foreground" fill="currentColor" /> : <Play className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={nextSong} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleRepeat} className={`transition-colors duration-200 ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {repeat === "one" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            </motion.button>
          </div>
          <div className="w-full max-w-md flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/70 w-9 text-right font-mono tabular-nums">{formatTime(progress)}</span>
            <div
              ref={trackSlider.ref}
              className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative group/slider touch-none"
              onPointerDown={trackSlider.onPointerDown}
            >
              <div className="absolute inset-y-0 left-0 gradient-primary rounded-full" style={{ width: `${progressPercent}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] scale-0 group-hover/slider:scale-100 transition-transform"
                style={{ left: `${progressPercent}%`, transform: `translateX(-50%) translateY(-50%)` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/70 w-9 font-mono tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: queue, expand, volume */}
        <div className="flex items-center gap-3 w-[20%] justify-end">
          <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={closePlayer} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close mini player">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleQueue} className="text-muted-foreground hover:text-foreground transition-colors">
            <LayoutList className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleFullPlayer} className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-muted-foreground hover:text-foreground transition-colors">
            <VolumeIcon className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
          <div
            ref={volumeSlider.ref}
            className="w-24 h-1 bg-white/10 rounded-full cursor-pointer relative group/vol touch-none"
            onPointerDown={volumeSlider.onPointerDown}
          >
            <div className="absolute inset-y-0 left-0 bg-primary/70 rounded-full" style={{ width: `${volumePercent}%` }} />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-primary opacity-0 group-hover/vol:opacity-100 transition-opacity shadow-[0_0_6px_hsl(var(--primary))]"
              style={{ left: `${volumePercent}%`, transform: `translateX(-50%) translateY(-50%)` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
