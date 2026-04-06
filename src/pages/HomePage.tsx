import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState, useMemo, useCallback } from "react";
import { PageTransition } from "@/components/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { Play, Clock, X, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SongContextMenu } from "@/components/SongContextMenu";
import { Skeleton } from "@/components/ui/skeleton";

const CACHE_KEY = "muzixhub_home_cache";
const CACHE_TTL = 5 * 60 * 1000;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}

function saveCache(songs: Song[], moods: any[], recentSongs: Song[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ songs, moods, recentSongs, ts: Date.now() }));
  } catch {}
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const popIn = { hidden: { opacity: 0, scale: 0.9, y: 10 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } } } as const;

function RecentSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-28 md:w-auto md:flex md:items-center md:gap-2.5 md:rounded-lg md:px-3 md:py-2">
          <Skeleton className="h-28 w-28 md:h-11 md:w-11 rounded-lg" />
          <div className="mt-2 md:mt-0 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SongListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SongGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl p-3">
          <Skeleton className="aspect-square rounded-lg mb-3" />
          <Skeleton className="h-3 w-3/4 mb-2" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user, profile } = useAuthStore();
  const cached = useMemo(() => loadCache(), []);
  const [songs, setSongs] = useState<Song[]>(cached?.songs || []);
  const [recentSongs, setRecentSongs] = useState<Song[]>(cached?.recentSongs || []);
  const [moods, setMoods] = useState<{ id: string; name: string; emoji: string }[]>(cached?.moods || []);
  const [loading, setLoading] = useState(!cached);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [showArtistFilter, setShowArtistFilter] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const navigate = useNavigate();

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const uniqueArtists = useMemo(() => {
    const artists = new Set(songs.map((s) => s.artist));
    return Array.from(artists).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const filteredArtistList = useMemo(() => {
    if (!artistSearch.trim()) return uniqueArtists;
    const q = artistSearch.toLowerCase();
    return uniqueArtists.filter((a) => a.toLowerCase().includes(q));
  }, [uniqueArtists, artistSearch]);

  const filteredSongs = useMemo(() => {
    if (selectedArtists.size === 0) return songs;
    return songs.filter((s) => selectedArtists.has(s.artist));
  }, [songs, selectedArtists]);

  const toggleArtist = (artist: string) => {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  };

  const clearArtistFilter = () => { setSelectedArtists(new Set()); setArtistSearch(""); };

  useEffect(() => {
    async function load() {
      const [songsRes, moodsRes] = await Promise.all([
        supabase.from("songs").select("*").order("created_at", { ascending: false }),
        supabase.from("moods").select("*"),
      ]);
      const newSongs = songsRes.data || [];
      const newMoods = (moodsRes.data as any[]) || [];
      setSongs(newSongs);
      setMoods(newMoods);

      let newRecent: Song[] = [];
      if (user) {
        const { data: recentRes } = await supabase
          .from("recently_played")
          .select("song_id, played_at, songs(*)")
          .eq("user_id", user.id)
          .order("played_at", { ascending: false })
          .limit(10);
        if (recentRes) {
          const uniqueSongsArr: Song[] = [];
          const seen = new Set<string>();
          for (const r of recentRes) {
            if (r.songs && !seen.has(r.song_id)) {
              seen.add(r.song_id);
              uniqueSongsArr.push(r.songs as unknown as Song);
            }
          }
          newRecent = uniqueSongsArr;
          setRecentSongs(newRecent);
        }
      }
      saveCache(newSongs, newMoods, newRecent);
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6 md:space-y-8">

        {loading ? (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recently Played</h2>
            </div>
            <RecentSkeleton />
          </section>
        ) : recentSongs.length > 0 ? (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recently Played</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:hidden">
              {recentSongs.map((s) => (
                <div key={s.id} className="flex-shrink-0 w-28 cursor-pointer active:scale-95 transition-transform" onClick={() => usePlayerStore.getState().playSong(s, recentSongs)}>
                  <div className="h-28 w-28 rounded-lg bg-secondary overflow-hidden">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-50" />}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate mt-1.5">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.artist}</p>
                </div>
              ))}
            </div>
            <motion.div className="hidden md:flex gap-2 overflow-x-auto pb-2 scrollbar-hide" variants={stagger} initial="hidden" animate="show">
              {recentSongs.map((s) => (
                <motion.div key={s.id} variants={popIn} whileHover={{ y: -4, scale: 1.04 }} whileTap={{ scale: 0.96 }} className="flex items-center gap-2.5 bg-card/80 hover:bg-secondary/80 rounded-lg px-3 py-2 cursor-pointer transition-colors group flex-shrink-0 min-w-0" onClick={() => usePlayerStore.getState().playSong(s, recentSongs)}>
                  <div className="h-11 w-11 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-50" />}
                  </div>
                  <div className="min-w-0 max-w-[140px]">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(s.artist)}`); }}>{s.artist}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        ) : null}

        {moods.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }} className="md:chroma-section md:rounded-xl md:p-4 md:-m-4">
            <h2 className="text-lg md:text-xl font-display font-bold text-foreground mb-3 md:mb-4">Discover by Mood</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
              {moods.map((mood, i) => {
                const gradients = [
                  "from-sky-500/40 to-teal-500/20", "from-red-500/40 to-orange-500/20",
                  "from-indigo-500/40 to-blue-500/20", "from-amber-500/40 to-yellow-500/20",
                  "from-violet-500/40 to-purple-500/20", "from-pink-500/40 to-fuchsia-500/20",
                  "from-slate-500/40 to-blue-500/20",
                ];
                return (
                  <div key={mood.id} className={`bg-gradient-to-br ${gradients[i % gradients.length]} rounded-xl px-3 py-3 md:p-4 cursor-pointer border border-border/30 flex items-center gap-2 md:gap-3 active:scale-95 md:hover:scale-105 transition-transform min-h-[48px] chroma-grid`} onClick={() => navigate(`/mood/${mood.id}`)}>
                    <span className="text-base md:text-xl">{mood.emoji}</span>
                    <span className="text-xs md:text-sm font-display font-bold text-foreground">{mood.name}</span>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {loading ? (
          <section>
            <h2 className="text-lg md:text-xl font-display font-bold text-foreground mb-3 md:mb-4">All Songs</h2>
            <div className="md:hidden"><SongListSkeleton /></div>
            <div className="hidden md:block"><SongGridSkeleton /></div>
          </section>
        ) : songs.length > 0 ? (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }} className="md:chroma-section md:rounded-xl md:p-4 md:-m-4">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">All Songs</h2>
              <button
                onClick={() => setShowArtistFilter(!showArtistFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                  selectedArtists.size > 0
                    ? "gradient-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground active:bg-secondary/80 md:hover:bg-secondary/80"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                {selectedArtists.size > 0 ? `${selectedArtists.size} artist${selectedArtists.size > 1 ? "s" : ""}` : "Filter"}
              </button>
            </div>

            {showArtistFilter && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Filter by artist</span>
                  {selectedArtists.size > 0 && (
                    <button onClick={clearArtistFilter} className="text-xs text-primary active:opacity-70 flex items-center gap-1">
                      <X className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    placeholder="Search artists..."
                    className="w-full bg-secondary rounded-lg pl-8 pr-8 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                  />
                  {artistSearch && (
                    <button onClick={() => setArtistSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {filteredArtistList.map((artist) => (
                    <button
                      key={artist}
                      onClick={() => toggleArtist(artist)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
                        selectedArtists.has(artist)
                          ? "gradient-primary text-primary-foreground"
                          : "bg-secondary text-foreground active:bg-secondary/80 md:hover:bg-secondary/80"
                      }`}
                    >
                      {artist}
                    </button>
                  ))}
                  {filteredArtistList.length === 0 && (
                    <span className="text-xs text-muted-foreground py-2">No artists match "{artistSearch}"</span>
                  )}
                </div>
              </div>
            )}

            <div className="md:hidden space-y-0.5">
              {filteredSongs.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg active:bg-secondary/60 transition-colors cursor-pointer min-h-[56px]" onClick={() => usePlayerStore.getState().playSong(s, filteredSongs)}>
                  <div className="h-12 w-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted-foreground truncate" onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(s.artist)}`); }}>{s.artist}</p>
                      {s.duration ? <span className="text-xs text-muted-foreground/60">• {formatDuration(s.duration)}</span> : null}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <SongContextMenu song={s} />
                  </div>
                </div>
              ))}
              {filteredSongs.length === 0 && selectedArtists.size > 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No songs found for selected artists</div>
              )}
            </div>
            <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredSongs.map((s) => (
                <motion.div key={s.id} variants={popIn} initial="hidden" animate="show" className="group relative bg-card hover:bg-secondary/80 rounded-xl p-3 cursor-pointer chroma-grid" onClick={() => usePlayerStore.getState().playSong(s, filteredSongs)}>
                  <div className="relative aspect-square rounded-lg bg-secondary overflow-hidden mb-3">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30 group-hover:opacity-50 transition-opacity" />}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }} className="h-9 w-9 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/25 transition-colors opacity-80">
                        <Play className="h-4 w-4 text-white/30 ml-0.5" />
                      </motion.button>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="h-7 w-7 rounded-full bg-secondary/90 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition-colors">
                        <SongContextMenu song={s} />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium truncate text-foreground">{s.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(s.artist)}`); }}>{s.artist}</p>
                    {s.duration ? <span className="text-xs text-muted-foreground/60">• {formatDuration(s.duration)}</span> : null}
                  </div>
                </motion.div>
              ))}
              {filteredSongs.length === 0 && selectedArtists.size > 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No songs found for selected artists</div>
              )}
            </div>
          </motion.section>
        ) : null}
      </div>
    </PageTransition>
  );
}
