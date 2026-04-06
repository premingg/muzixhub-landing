import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { ArrowLeft, Play, Shuffle, Heart, Clock, Plus, MoreHorizontal, Share2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export default function AlbumView() {
  const { albumName } = useParams<{ albumName: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [albumInfo, setAlbumInfo] = useState<{ name: string; artist: string; cover_image_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const { isLiked, toggleLike } = useLikedSongs();
  const { addToQueue } = usePlayerStore();

  const decodedAlbum = decodeURIComponent(albumName || "");

  useEffect(() => {
    async function load() {
      // Try to find album by ID first (new system), then fall back to song.album field (legacy)
      const { data: albumData } = await supabase
        .from("albums")
        .select("*")
        .eq("id", decodedAlbum)
        .maybeSingle();

      if (albumData) {
        setAlbumInfo({ name: albumData.name, artist: albumData.artist, cover_image_url: albumData.cover_image_url });
        // Load songs from album_songs junction
        const { data: asSongs } = await supabase
          .from("album_songs")
          .select("songs(*)")
          .eq("album_id", albumData.id)
          .order("position");
        const loadedSongs = (asSongs || []).map((d) => d.songs as unknown as Song);
        setSongs(loadedSongs);
      } else {
        // Fallback: legacy album name match
        const { data } = await supabase
          .from("songs")
          .select("*")
          .eq("album", decodedAlbum)
          .order("created_at", { ascending: true });
        const loadedSongs: Song[] = data || [];
        setSongs(loadedSongs);
        if (loadedSongs.length > 0) {
          setAlbumInfo({ name: decodedAlbum, artist: loadedSongs[0].artist, cover_image_url: loadedSongs[0].cover_image_url });
        }
      }

      // Auto-detect and backfill missing durations
      songs.forEach((song) => {
        if ((!song.duration || song.duration === 0) && song.audio_url) {
          const audio = new Audio();
          audio.src = song.audio_url;
          audio.addEventListener("loadedmetadata", () => {
            const dur = Math.round(audio.duration);
            if (dur > 0) {
              setSongs((prev) =>
                prev.map((s) => (s.id === song.id ? { ...s, duration: dur } : s))
              );
              supabase.from("songs").update({ duration: dur }).eq("id", song.id).then();
            }
          });
        }
      });

      if (user) {
        const { data: pl } = await supabase
          .from("playlists")
          .select("id, name")
          .eq("user_id", user.id);
        setPlaylists(pl || []);
      }
      setLoading(false);
    }
    load();
  }, [decodedAlbum, user]);

  const coverImage = albumInfo?.cover_image_url || songs.find((s) => s.cover_image_url)?.cover_image_url;

  const playAll = (startIndex = 0) => {
    if (songs.length > 0) {
      usePlayerStore.getState().playSong(songs[startIndex], songs);
    }
  };

  const shufflePlay = () => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      usePlayerStore.getState().playSong(shuffled[0], shuffled);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>

      <div className="flex items-end gap-6 mb-8">
        <div className="h-40 w-40 md:h-52 md:w-52 rounded-xl bg-secondary overflow-hidden flex-shrink-0 shadow-lg">
          {coverImage ? (
            <CoverImg src={coverImage} alt={albumInfo?.name || decodedAlbum} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full gradient-primary opacity-40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Album</p>
          <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground truncate">{albumInfo?.name || decodedAlbum}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {albumInfo?.artist || songs[0]?.artist} • {songs.length} song{songs.length !== 1 ? "s" : ""}
            {(() => {
              const total = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
              if (total === 0) return "";
              const hours = Math.floor(total / 3600);
              const mins = Math.floor((total % 3600) / 60);
              return ` • ${hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}`;
            })()}
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => playAll()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Play className="h-4 w-4 ml-0.5" />
              Play
            </button>
            <button
              onClick={shufflePlay}
              className="flex items-center gap-2 bg-secondary text-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Shuffle className="h-4 w-4" />
              Shuffle
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/album/${decodedAlbum}`;
                navigator.clipboard.writeText(url);
                toast.success("Album link copied to clipboard");
              }}
              className="flex items-center gap-2 bg-secondary text-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Song list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No songs found in this album.</p>
      ) : (
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[2rem_1fr_3.5rem_auto] md:grid-cols-[2rem_1fr_1fr_3.5rem_auto] gap-4 px-3 py-2 text-xs text-muted-foreground border-b border-border">
            <span>#</span>
            <span>Title</span>
            <span className="hidden md:block">Artist</span>
            <Clock className="h-3.5 w-3.5 justify-self-center -ml-4" />
            <span></span>
          </div>

          {songs.map((s, i) => (
            <div
              key={s.id}
              className="group grid grid-cols-[2rem_1fr_3.5rem_auto] md:grid-cols-[2rem_1fr_1fr_3.5rem_auto] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-colors"
              onClick={() => playAll(i)}
            >
              <span className="text-sm text-muted-foreground group-hover:hidden">{i + 1}</span>
              <Play className="h-3.5 w-3.5 text-foreground hidden group-hover:block" />

              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                  {s.cover_image_url ? (
                    <CoverImg src={s.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate md:hidden">{s.artist}</p>
                </div>
              </div>

              <span className="hidden md:block text-sm text-muted-foreground truncate">{s.artist}</span>

              <span className="text-xs text-muted-foreground text-center">{formatDuration(s.duration ?? undefined)}</span>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const liked = isLiked(s.id);
                    toggleLike(s.id);
                    toast.success(liked ? "Removed from liked songs" : "Added to liked songs");
                  }}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                    isLiked(s.id) ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${isLiked(s.id) ? "fill-primary" : ""}`} />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      addToQueue(s);
                      toast.success(`"${s.title}" added to queue`);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Queue
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${s.title} by ${s.artist}`);
                      toast.success("Song info copied to clipboard");
                    }}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    {playlists.length > 0 && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                          <ListPlus className="h-4 w-4 mr-2" />
                          Add to Playlist
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {playlists.map((pl) => (
                            <DropdownMenuItem
                              key={pl.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { error } = await supabase.from("playlist_songs").insert({ playlist_id: pl.id, song_id: s.id });
                                if (error) toast.error("Failed to add to playlist");
                                else toast.success("Added to playlist");
                              }}
                            >
                              {pl.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
