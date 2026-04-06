import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlbumCarousel3D } from "@/components/AlbumCarousel3D";
import { PageTransition } from "@/components/PageTransition";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { SongContextMenu } from "@/components/SongContextMenu";
import { TrendingUp, Sparkles, Music, Disc3, Play, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const genres = [
  "Pop", "Hip Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Indie",
  "Country", "Latin", "Metal", "Folk", "Soul", "Reggae", "Blues", "Afrobeats",
  "K-Pop", "Lo-fi", "Phonk", "Other",
];

const genreColors = [
  "from-rose-500/50 to-pink-600/50", "from-violet-500/50 to-purple-600/50",
  "from-blue-500/50 to-indigo-600/50", "from-cyan-500/50 to-teal-600/50",
  "from-red-500/50 to-orange-600/50", "from-amber-500/50 to-yellow-600/50",
  "from-emerald-500/50 to-green-600/50", "from-sky-500/50 to-blue-600/50",
  "from-orange-500/50 to-red-600/50", "from-lime-500/50 to-emerald-600/50",
  "from-slate-500/50 to-zinc-600/50", "from-teal-500/50 to-cyan-600/50",
  "from-fuchsia-500/50 to-pink-600/50", "from-green-500/50 to-lime-600/50",
  "from-indigo-500/50 to-blue-600/50", "from-yellow-500/50 to-orange-600/50",
  "from-pink-500/50 to-rose-600/50", "from-purple-400/50 to-indigo-500/50",
  "from-red-600/50 to-rose-700/50", "from-zinc-500/50 to-slate-600/50",
];

interface Album { id: string; name: string; cover_image_url: string | null; songCount: number; }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const flipIn = { hidden: { opacity: 0, rotateX: -45, y: 10 }, show: { opacity: 1, rotateX: 0, y: 0, transition: { type: "spring" as const, stiffness: 200, damping: 22 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } } as const;
const popIn = { hidden: { opacity: 0, scale: 0.8, y: 15 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } } } as const;

function SongCardWithMenu({ song, allSongs }: { song: Song; allSongs: Song[] }) {
  const navigate = useNavigate();
  return (
    <motion.div variants={popIn} whileHover={{ y: -6, scale: 1.03 }} whileTap={{ scale: 0.97 }} className="group relative bg-card hover:bg-secondary/80 rounded-xl p-3 cursor-pointer" onClick={() => usePlayerStore.getState().playSong(song, allSongs)}>
      <div className="relative aspect-square rounded-lg bg-secondary overflow-hidden mb-3">
        {song.cover_image_url ? <CoverImg src={song.cover_image_url} alt={song.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30 group-hover:opacity-50 transition-opacity" />}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }} className="h-9 w-9 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/25 transition-colors opacity-80">
            <Play className="h-4 w-4 text-white/30 ml-0.5" />
          </motion.button>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-7 w-7 rounded-full bg-secondary/90 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition-colors">
            <SongContextMenu song={song} />
          </div>
        </div>
      </div>
      <h3 className="text-sm font-medium truncate text-foreground">{song.title}</h3>
      <p className="text-xs text-muted-foreground truncate mt-0.5 hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(song.artist)}`); }}>{song.artist}</p>
    </motion.div>
  );
}

function SongGridSkeleton({ count = 8 }: { count?: number }) {
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

function HScrollSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-36">
          <Skeleton className="h-20 w-20 rounded-lg mx-auto" />
          <Skeleton className="h-3 w-28 mt-2" />
          <Skeleton className="h-2.5 w-20 mt-1" />
        </div>
      ))}
    </div>
  );
}

export default function Explore() {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [songsRes, albumsRes] = await Promise.all([
        supabase.from("songs").select("*").order("created_at", { ascending: false }),
        supabase.from("albums").select("*").order("created_at", { ascending: false }),
      ]);
      const songs = songsRes.data || [];
      setAllSongs(songs);

      if (albumsRes.data) {
        const withCounts = await Promise.all(
          albumsRes.data.map(async (a) => {
            const { count } = await supabase.from("album_songs").select("*", { count: "exact", head: true }).eq("album_id", a.id);
            return { id: a.id, name: a.name, cover_image_url: a.cover_image_url, songCount: count || 0 };
          })
        );
        setAlbums(withCounts);
      }
      setLoading(false);
    }
    load();
  }, []);

  const trendingSongs = [...allSongs].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 8);
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const newReleases = allSongs.filter((s) => new Date(s.created_at) >= fortyEightHoursAgo);
  const filteredByGenre = selectedGenre ? allSongs.filter((s) => s.genre?.toLowerCase() === selectedGenre.toLowerCase()) : [];

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-8 md:space-y-10">

        {/* Mobile search bar at top */}
        <div className="md:hidden">
          <div
            className="flex items-center gap-3 bg-secondary rounded-full px-4 py-3 cursor-pointer active:bg-secondary/80 transition-colors"
            onClick={() => navigate("/search")}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Search songs, artists, albums...</span>
          </div>
        </div>

        {/* Trending */}
        {loading ? (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Trending</h2>
            </div>
            <div className="md:hidden"><HScrollSkeleton /></div>
            <div className="hidden md:block"><SongGridSkeleton /></div>
          </section>
        ) : trendingSongs.length > 0 ? (
          <section className="md:chroma-section md:rounded-xl md:p-4 md:-m-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Trending</h2>
            </div>
            {/* Mobile: horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:hidden">
              {trendingSongs.map((s) => (
                <div
                  key={s.id}
                  className="flex-shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => usePlayerStore.getState().playSong(s, trendingSongs)}
                >
                  <div className="h-20 w-20 rounded-lg bg-secondary overflow-hidden mx-auto">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30" />}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate mt-2 text-center">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate text-center">{s.artist}</p>
                </div>
              ))}
            </div>
            {/* Desktop: grid */}
            <motion.div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" variants={stagger} initial="hidden" animate="show">
              {trendingSongs.map((s) => <SongCardWithMenu key={s.id} song={s} allSongs={trendingSongs} />)}
            </motion.div>
          </section>
        ) : null}

        {/* New Releases */}
        {newReleases.length > 0 && (
          <section className="md:chroma-section md:rounded-xl md:p-4 md:-m-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">New Releases</h2>
              <span className="text-xs text-muted-foreground ml-1">Last 48h</span>
            </div>
            {/* Mobile: horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:hidden">
              {newReleases.map((s) => (
                <div
                  key={s.id}
                  className="flex-shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => usePlayerStore.getState().playSong(s, newReleases)}
                >
                  <div className="h-20 w-20 rounded-lg bg-secondary overflow-hidden mx-auto">
                    {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30" />}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate mt-2 text-center">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate text-center">{s.artist}</p>
                </div>
              ))}
            </div>
            {/* Desktop: grid */}
            <motion.div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" variants={stagger} initial="hidden" animate="show">
              {newReleases.map((s) => <SongCardWithMenu key={s.id} song={s} allSongs={newReleases} />)}
            </motion.div>
          </section>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="md:chroma-section md:rounded-xl md:p-4 md:-m-4">
            <div className="flex items-center gap-2 mb-4">
              <Disc3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Browse Albums</h2>
            </div>
            <AlbumCarousel3D albums={albums} />
          </motion.section>
        )}

        {/* Browse Genres — moved to bottom */}
        <motion.section initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <Music className="h-5 w-5 text-primary" />
            <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Browse Genres</h2>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3" style={{ perspective: "800px" }}>
            {genres.map((g, i) => (
              <motion.div
                key={g}
                variants={flipIn}
                onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
                whileTap={{ scale: 0.95 }}
                className={`bg-gradient-to-br ${genreColors[i % genreColors.length]} rounded-xl px-3 py-3 md:p-4 cursor-pointer transition-shadow border border-border/30 min-h-[48px] flex items-center ${selectedGenre === g ? "ring-2 ring-primary shadow-lg" : ""} md:hover:scale-105 active:scale-95`}
              >
                <span className="text-xs md:text-sm font-display font-bold text-foreground">{g}</span>
              </motion.div>
            ))}
          </div>
          {selectedGenre && (
            <motion.div className="mt-4" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-display font-semibold text-foreground">{selectedGenre} Songs</h3>
                <button onClick={() => setSelectedGenre(null)} className="text-sm text-primary active:underline">Clear filter</button>
              </div>
              {filteredByGenre.length > 0 ? (
                <>
                  {/* Mobile list */}
                  <div className="md:hidden space-y-0.5">
                    {filteredByGenre.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-2 rounded-lg active:bg-secondary/60 cursor-pointer min-h-[56px]"
                        onClick={() => usePlayerStore.getState().playSong(s, filteredByGenre)}
                      >
                        <div className="h-12 w-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                          {s.cover_image_url ? <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-primary opacity-30" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}><SongContextMenu song={s} /></div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop grid */}
                  <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredByGenre.map((s) => <SongCardWithMenu key={s.id} song={s} allSongs={filteredByGenre} />)}
                  </div>
                </>
              ) : <p className="text-muted-foreground text-sm">No songs found for {selectedGenre}.</p>}
            </motion.div>
          )}
        </motion.section>
      </div>
    </PageTransition>
  );
}
