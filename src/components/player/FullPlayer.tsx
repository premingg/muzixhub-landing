import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, Volume1, VolumeX, ChevronDown, LayoutList, Heart
} from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useSongCover } from "@/hooks/useTelegramImage";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { useDraggableSlider } from "@/hooks/useDraggableSlider";
import { SongContextMenu } from "@/components/SongContextMenu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function formatTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function FullPlayer() {
  const {
    currentSong, isPlaying, progress, duration, volume,
    shuffle, repeat, showFullPlayer,
    togglePlay, nextSong, prevSong, setVolume, seekTo,
    toggleShuffle, toggleRepeat, toggleFullPlayer, toggleQueue,
  } = usePlayerStore();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const coverUrl = useSongCover(currentSong);
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const volumePercent = volume * 100;

  const progressSlider = useDraggableSlider((pct) => { if (duration) seekTo(pct * duration); });
  const desktopProgressSlider = useDraggableSlider((pct) => { if (duration) seekTo(pct * duration); });
  const desktopVolumeSlider = useDraggableSlider((pct) => setVolume(pct));

  const rotateControls = useAnimation();

  useEffect(() => {
    if (isPlaying) {
      rotateControls.start({ rotate: 360, transition: { duration: 20, repeat: Infinity, ease: "linear" } });
    } else {
      rotateControls.stop();
    }
  }, [isPlaying, rotateControls]);

  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const isDraggingPanel = useRef(false);

  const onPanelPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-slider]") || target.closest("button")) return;
    isDraggingPanel.current = true;
    dragStartY.current = e.clientY;
  };
  const onPanelPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPanel.current) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    setDragY(dy);
  };
  const onPanelPointerUp = () => {
    if (!isDraggingPanel.current) return;
    isDraggingPanel.current = false;
    if (dragY > 120) toggleFullPlayer();
    setDragY(0);
  };

  const handleGoToArtist = () => {
    if (currentSong?.artist) {
      toggleFullPlayer();
      navigate(`/artist/${encodeURIComponent(currentSong.artist)}`);
    }
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <AnimatePresence>
      {showFullPlayer && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {coverUrl && (
            <div className="absolute inset-0 z-0">
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ backdropFilter: "blur(60px)", WebkitBackdropFilter: "blur(60px)", background: "rgba(0,0,0,0.75)" }} />
            </div>
          )}
          {!coverUrl && <div className="absolute inset-0 z-0 bg-background" />}

          {/* ─── MOBILE ─── */}
          <div
            className="md:hidden relative z-10 flex flex-col h-full touch-none"
            style={{ transform: `translateY(${dragY}px)`, transition: dragY === 0 ? "transform 0.3s cubic-bezier(0.32,0.72,0,1)" : "none" }}
            onPointerDown={onPanelPointerDown}
            onPointerMove={onPanelPointerMove}
            onPointerUp={onPanelPointerUp}
          >
            <div className="absolute inset-0 z-0">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full gradient-primary opacity-60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60" />
            </div>

            <div className="relative z-10 flex items-center justify-between p-4">
              <motion.button whileTap={{ scale: 0.88 }} onClick={toggleFullPlayer} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 active:text-white">
                <ChevronDown className="h-6 w-6" />
              </motion.button>
              <span className="text-[10px] font-medium text-white/50 uppercase tracking-[0.2em]">Now Playing</span>
              <motion.button whileTap={{ scale: 0.88 }} onClick={toggleQueue} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 active:text-white">
                <LayoutList className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="flex-1" />

            <div className="relative z-10 px-8 pb-10">
              <div className="mb-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-white truncate">{currentSong?.title || "No song"}</h2>
                    <p className="text-white/60 mt-0.5 text-sm cursor-pointer active:text-primary" onClick={handleGoToArtist}>{currentSong?.artist}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {currentSong && (
                      <motion.button
                        whileTap={{ scale: 1.4 }}
                        onClick={() => { toggleLike(currentSong.id); toast.success(isLiked(currentSong.id) ? "Removed from liked songs" : "Added to liked songs"); }}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center ${isLiked(currentSong.id) ? "text-primary" : "text-white/60"}`}
                      >
                        <Heart className={`h-6 w-6 ${isLiked(currentSong.id) ? "fill-primary" : ""}`} />
                      </motion.button>
                    )}
                    {currentSong && (
                      <div className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60">
                        <SongContextMenu song={currentSong} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-5" data-slider>
                <div
                  ref={progressSlider.ref}
                  className="relative h-2 bg-white/20 rounded-full cursor-pointer touch-none"
                  onPointerDown={progressSlider.onPointerDown}
                >
                  <div className="absolute inset-y-0 left-0 gradient-primary rounded-full" style={{ width: `${progressPercent}%` }} />
                  <div
                    className="absolute top-1/2 h-4 w-4 rounded-full bg-white shadow-lg"
                    style={{ left: `${progressPercent}%`, transform: "translateX(-50%) translateY(-50%)", boxShadow: "0 0 8px hsl(var(--primary) / 0.6)" }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-white/40 font-mono tabular-nums">{formatTime(progress)}</span>
                  <span className="text-[11px] text-white/40 font-mono tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleShuffle} className={`min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-200 ${shuffle ? "text-primary" : "text-white/50"}`}>
                  <Shuffle className="h-5 w-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={prevSong} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white active:text-primary">
                  <SkipBack className="h-7 w-7" fill="currentColor" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }} onClick={togglePlay} className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center" style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.4)" }}>
                  {isPlaying ? <Pause className="h-7 w-7 text-primary-foreground" fill="currentColor" /> : <Play className="h-7 w-7 text-primary-foreground ml-1" fill="currentColor" />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={nextSong} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white active:text-primary">
                  <SkipForward className="h-7 w-7" fill="currentColor" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleRepeat} className={`min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-200 ${repeat !== "off" ? "text-primary" : "text-white/50"}`}>
                  {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                </motion.button>
              </div>
            </div>
          </div>

          {/* ─── DESKTOP ─── */}
          <div className="hidden md:flex relative z-10 flex-col h-full items-center justify-center">
            <div className="w-full max-w-lg bg-[#0D0D0D] rounded-3xl p-8 flex flex-col items-center" style={{ border: "2px solid hsl(var(--primary))", boxShadow: "0 0 40px hsl(var(--primary) / 0.15)" }}>
              <div className="w-full flex items-center justify-between mb-6">
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleFullPlayer} className="text-white/50 hover:text-white transition-colors">
                  <ChevronDown className="h-5 w-5" />
                </motion.button>
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.2em]">Now Playing</span>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleQueue} className="text-white/50 hover:text-white transition-colors">
                  <LayoutList className="h-5 w-5" />
                </motion.button>
              </div>

              <motion.div animate={rotateControls} className="w-64 h-64 rounded-full overflow-hidden mb-6 flex-shrink-0" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}>
                {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-60" />}
              </motion.div>

              <div className="w-full flex items-center justify-between mb-5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-white truncate">{currentSong?.title || "No song"}</h2>
                  <p className="text-white/50 text-sm cursor-pointer hover:text-primary transition-colors" onClick={handleGoToArtist}>{currentSong?.artist}</p>
                </div>
                <div className="flex items-center gap-1">
                  {currentSong && (
                    <motion.button
                      whileHover={{ scale: 1.25 }}
                      whileTap={{ scale: 1.4 }}
                      onClick={() => { toggleLike(currentSong.id); toast.success(isLiked(currentSong.id) ? "Removed" : "Added to liked songs"); }}
                      className={`p-2 transition-colors duration-200 ${isLiked(currentSong.id) ? "text-primary" : "text-white/50 hover:text-primary"}`}
                    >
                      <Heart className={`h-5 w-5 ${isLiked(currentSong.id) ? "fill-primary" : ""}`} />
                    </motion.button>
                  )}
                  {currentSong && <div className="text-white/50"><SongContextMenu song={currentSong} /></div>}
                </div>
              </div>

              <div className="w-full mb-4" data-slider>
                <div
                  ref={desktopProgressSlider.ref}
                  className="relative h-1.5 bg-white/15 rounded-full cursor-pointer group touch-none"
                  onPointerDown={desktopProgressSlider.onPointerDown}
                >
                  <div className="absolute inset-y-0 left-0 gradient-primary rounded-full" style={{ width: `${progressPercent}%` }} />
                  <div
                    className="absolute top-1/2 h-3 w-3 rounded-full bg-white shadow-lg scale-0 group-hover:scale-100 transition-transform duration-200"
                    style={{ left: `${progressPercent}%`, transform: "translateX(-50%) translateY(-50%)", boxShadow: "0 0 8px hsl(var(--primary) / 0.6)" }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/30 font-mono tabular-nums">{formatTime(progress)}</span>
                  <span className="text-[10px] text-white/30 font-mono tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="w-full flex items-center justify-between px-4 mb-5">
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleShuffle} className={`p-2 transition-colors duration-200 ${shuffle ? "text-primary" : "text-white/40 hover:text-white"}`}>
                  <Shuffle className="h-5 w-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={prevSong} className="p-2 text-white/80 hover:text-white transition-colors">
                  <SkipBack className="h-6 w-6" fill="currentColor" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }} onClick={togglePlay} className="h-14 w-14 rounded-full gradient-primary flex items-center justify-center" style={{ boxShadow: "0 0 25px hsl(var(--primary) / 0.4)" }}>
                  {isPlaying ? <Pause className="h-6 w-6 text-primary-foreground" fill="currentColor" /> : <Play className="h-6 w-6 text-primary-foreground ml-0.5" fill="currentColor" />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={nextSong} className="p-2 text-white/80 hover:text-white transition-colors">
                  <SkipForward className="h-6 w-6" fill="currentColor" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={toggleRepeat} className={`p-2 transition-colors duration-200 ${repeat !== "off" ? "text-primary" : "text-white/40 hover:text-white"}`}>
                  {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                </motion.button>
              </div>

              <div className="w-full flex items-center gap-3" data-slider>
                <motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-white/40 hover:text-white transition-colors">
                  <VolumeIcon className="h-4 w-4" />
                </motion.button>
                <div
                  ref={desktopVolumeSlider.ref}
                  className="flex-1 relative h-1 bg-white/15 rounded-full cursor-pointer touch-none group/vol"
                  onPointerDown={desktopVolumeSlider.onPointerDown}
                >
                  <div className="absolute inset-y-0 left-0 gradient-primary rounded-full" style={{ width: `${volumePercent}%` }} />
                  <div
                    className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-white opacity-0 group-hover/vol:opacity-100 transition-opacity shadow-[0_0_6px_hsl(var(--primary))]"
                    style={{ left: `${volumePercent}%`, transform: "translateX(-50%) translateY(-50%)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
