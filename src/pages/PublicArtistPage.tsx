import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { PageTransition } from "@/components/PageTransition";
import { SongContextMenu } from "@/components/SongContextMenu";
import { Play, Share2, Music2, UserPlus, UserCheck, Users, ChevronRight, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useFollowArtist } from "@/hooks/useFollowArtist";
import { useSongCover } from "@/hooks/useTelegramImage";
import { Skeleton } from "@/components/ui/skeleton";

interface Album {
  id: string;
  name: string;
  cover_image_url: string | null;
  created_at: string;
  song_count: number;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
} as const;

const popUp = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 250, damping: 20 } },
} as const;

type FilterTab = "all" | "singles" | "albums";

export default function PublicArtistPage() {
  const { id: artistName } = useParams<{ id: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumSongIds, setAlbumSongIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [artistInfo, setArtistInfo] = useState<{ image_url: string | null; bio: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showAllPopular, setShowAllPopular] = useState(false);
  const navigate = useNavigate();

  const decodedName = decodeURIComponent(artistName || "");
  const { isFollowing, followersCount, toggleFollow, loading: followLoading } = useFollowArtist(decodedName);

  useEffect(() => {
    async function load() {
      if (!decodedName) return;
      const [songsRes, artistRes, albumsRes] = await Promise.all([
        supabase.from("songs").select("*").ilike("artist", decodedName).order("plays", { ascending: false }),
        supabase.from("artists").select("image_url, bio").ilike("name", decodedName).maybeSingle(),
        supabase.from("albums").select("*").ilike("artist", decodedName).order("created_at", { ascending: false }),
      ]);
      setSongs(songsRes.data as Song[] || []);
      if (artistRes.data) setArtistInfo(artistRes.data);

      // Load albums with song counts and track which songs belong to albums
      if (albumsRes.data && albumsRes.data.length > 0) {
        const albumIds = albumsRes.data.map((a) => a.id);
        const { data: albumSongsData } = await supabase
          .from("album_songs")
          .select("album_id, song_id")
          .in("album_id", albumIds);

        const songIdsInAlbums = new Set((albumSongsData || []).map((as: any) => as.song_id));
        setAlbumSongIds(songIdsInAlbums);

        const countMap: Record<string, number> = {};
        (albumSongsData || []).forEach((as: any) => {
          countMap[as.album_id] = (countMap[as.album_id] || 0) + 1;
        });

        setAlbums(albumsRes.data.map((a) => ({
          id: a.id,
          name: a.name,
          cover_image_url: a.cover_image_url,
          created_at: a.created_at,
          song_count: countMap[a.id] || 0,
        })));
      }

      setLoading(false);
    }
    load();
  }, [decodedName]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      usePlayerStore.getState().playSong(songs[0], songs);
    }
  };

  const totalPlays = songs.reduce((acc, s) => acc + (s.plays || 0), 0);
  const singles = songs.filter((s) => !albumSongIds.has(s.id));
  const popularSongs = songs.slice(0, showAllPopular ? songs.length : 5);
  const allSongsByDate = [...songs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const genres = [...new Set(songs.map((s) => s.genre).filter(Boolean))];

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "singles", label: "Singles" },
    { key: "albums", label: "Albums" },
  ];

  if (loading) {
    return (
      <PageTransition>
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-28 w-28 md:h-40 md:w-40 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (songs.length === 0) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Music2 className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-display font-bold text-foreground">Artist not found</h1>
          <p className="text-muted-foreground">No songs found for this artist.</p>
        </div>
      </PageTransition>
    );
  }

  const artistImage = artistInfo?.image_url || songs.find((s) => s.cover_image_url)?.cover_image_url;
  const artistBio = artistInfo?.bio;

  return (
    <PageTransition>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <motion.div className="flex flex-col items-center md:flex-row md:items-center gap-4 md:gap-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          {/* Avatar */}
          <div className="relative">
            <div className="h-28 w-28 md:h-40 md:w-40 rounded-full bg-secondary overflow-hidden shadow-2xl ring-2 ring-primary/30 flex-shrink-0">
              {artistImage ? (
                <img src={artistImage} alt={decodedName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                  <Music2 className="h-10 w-10 md:h-12 md:w-12 text-primary-foreground/50" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1.5">
            <p className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground font-medium">Artist</p>
            <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground">{decodedName}</h1>
            <div className="flex items-center gap-2 justify-center md:justify-start text-xs md:text-sm text-muted-foreground flex-wrap">
              <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
              <span>•</span>
              <span>{totalPlays.toLocaleString()} streams</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {followersCount}</span>
            </div>
            {artistBio && <p className="text-xs md:text-sm text-muted-foreground mt-1">{artistBio}</p>}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div className="flex items-center gap-2 md:gap-3 justify-center md:justify-start" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <motion.button onClick={handlePlayAll} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 rounded-full gradient-primary text-primary-foreground font-semibold glow-shadow text-sm">
            <Play className="h-4 w-4 md:h-5 md:w-5 ml-0.5" fill="currentColor" /> Play All
          </motion.button>

          <motion.button
            onClick={toggleFollow}
            disabled={followLoading}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-full font-semibold transition-colors text-sm ${
              isFollowing
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
            }`}
          >
            {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isFollowing ? "Following" : "Follow"}
          </motion.button>

          <motion.button onClick={handleShare} whileTap={{ scale: 0.92 }} className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <Share2 className="h-4 w-4 text-foreground" />
          </motion.button>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Popular Songs — visible on All and Singles */}
        {activeTab !== "albums" && (
          <section>
            <h2 className="text-lg font-display font-bold text-foreground mb-3">Popular</h2>
            <div className="space-y-0.5">
              {popularSongs.map((song, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-2 md:p-2.5 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer group min-h-[52px]"
                  onClick={() => usePlayerStore.getState().playSong(song, songs)}
                >
                  <span className="text-sm font-display font-bold text-muted-foreground w-6 text-right">{i + 1}</span>
                  <div className="relative h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {song.cover_image_url ? (
                      <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full gradient-primary opacity-30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground">{song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : ''}</p>
                  </div>
                  <span className="text-xs text-muted-foreground hidden md:inline">{song.plays?.toLocaleString()} streams</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <SongContextMenu song={song} />
                  </div>
                </motion.div>
              ))}
            </div>
            {songs.length > 5 && !showAllPopular && (
              <button onClick={() => setShowAllPopular(true)} className="text-sm text-primary hover:underline mt-2">See all {songs.length} songs</button>
            )}
          </section>
        )}

        {/* Albums — visible on All and Albums */}
        {(activeTab === "all" || activeTab === "albums") && (
          <section>
            <h2 className="text-lg font-display font-bold text-foreground mb-3">Albums</h2>
            {albums.length > 0 ? (
              <div className="space-y-1">
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer min-h-[56px]"
                    onClick={() => navigate(`/album/${encodeURIComponent(album.name)}`)}
                  >
                    <div className="h-14 w-14 rounded-xl bg-secondary overflow-hidden flex-shrink-0">
                      {album.cover_image_url ? (
                        <CoverImg src={album.cover_image_url} alt={album.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full gradient-primary opacity-30 flex items-center justify-center"><Disc3 className="h-6 w-6 text-primary-foreground/50" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{album.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(album.created_at).getFullYear()} • {album.song_count} song{album.song_count !== 1 ? "s" : ""}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Music2 className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No albums yet</p>
              </div>
            )}
          </section>
        )}

        {/* Singles — visible on All and Singles */}
        {(activeTab === "all" || activeTab === "singles") && (
          <section>
            <h2 className="text-lg font-display font-bold text-foreground mb-3">Singles</h2>
            {singles.length > 0 ? (
              <div className="space-y-0.5">
                {singles.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 md:p-2.5 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer group min-h-[52px]"
                    onClick={() => usePlayerStore.getState().playSong(song, songs)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                      {song.cover_image_url ? (
                        <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full gradient-primary opacity-30" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(song.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <SongContextMenu song={song} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Music2 className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No singles yet</p>
              </div>
            )}
          </section>
        )}

        {/* All Songs by date — visible on All tab, below Popular */}
        {activeTab === "all" && songs.length > 5 && !showAllPopular && (
          <section>
            <h2 className="text-lg font-display font-bold text-foreground mb-3">All Songs</h2>
            <div className="space-y-0.5">
              {allSongsByDate.slice(5).map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-2 md:p-2.5 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer group min-h-[52px]"
                  onClick={() => usePlayerStore.getState().playSong(song, songs)}
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {song.cover_image_url ? (
                      <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full gradient-primary opacity-30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(song.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <SongContextMenu song={song} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
