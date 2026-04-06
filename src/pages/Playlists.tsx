import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { Plus, Music2, Play, Trash2, X, Search, Shuffle, Heart, Share2, MoreVertical, ListPlus, Pin, PinOff, ImagePlus, User, Users } from "lucide-react";
import { SongContextMenu } from "@/components/SongContextMenu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useFollowedArtists } from "@/hooks/useFollowArtist";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  is_pinned: boolean;
  song_count?: number;
}

interface PlaylistWithSongs extends Playlist {
  songs: Song[];
}

const formatDuration = (seconds?: number) => {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatTotalDuration = (songs: Song[]) => {
  const total = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  if (total === 0) return "";
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

export default function Playlists() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { artists: followedArtists } = useFollowedArtists();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithSongs | null>(null);
  const [showAddSong, setShowAddSong] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  // Liked songs as virtual playlist
  const [showLiked, setShowLiked] = useState(false);
  const [likedSongsList, setLikedSongsList] = useState<Song[]>([]);
  const [likedSearchQuery, setLikedSearchQuery] = useState("");
  const { likeCount, loading: likesLoading, refresh: refreshLikes } = useLikedSongs();
  const [likedCount, setLikedCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "playlist" | "song"; id: string; name: string } | null>(null);

  // Load liked count directly for accurate display
  useEffect(() => {
    if (!user) return;
    supabase
      .from("liked_songs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setLikedCount(count || 0));
  }, [user, likeCount]);

  const loadPlaylists = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("playlists")
      .select("*, playlist_songs(count)")
      .eq("user_id", user.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    const mapped = (data || []).map((p: any) => ({
      ...p,
      is_pinned: p.is_pinned ?? false,
      song_count: p.playlist_songs?.[0]?.count ?? 0,
      playlist_songs: undefined,
    }));
    setPlaylists(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const loadLikedSongs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("liked_songs")
      .select("song_id, liked_at, songs(*)")
      .eq("user_id", user.id)
      .order("liked_at", { ascending: false });
    if (data) {
      setLikedSongsList(
        data.filter((l) => l.songs).map((l) => l.songs as unknown as Song)
      );
    }
    setShowLiked(true);
  };

  const loadPlaylistSongs = async (playlist: Playlist) => {
    const { data } = await supabase
      .from("playlist_songs")
      .select("song_id, position, songs(*)")
      .eq("playlist_id", playlist.id)
      .order("position", { ascending: true });

    const songs: Song[] = (data || [])
      .filter((ps) => ps.songs)
      .map((ps) => ps.songs as unknown as Song);

    setSelectedPlaylist({ ...playlist, songs });
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const { error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Playlist created!");
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    loadPlaylists();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Playlist deleted");
    if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
    loadPlaylists();
  };

  const sharePlaylist = (playlistId: string, name: string) => {
    const url = `${window.location.origin}/playlist/${playlistId}`;
    navigator.clipboard.writeText(url);
    toast.success(`Link to "${name}" copied to clipboard`);
  };

  const openAddSong = async () => {
    const { data } = await supabase.from("songs").select("*").order("title");
    setAllSongs(data || []);
    setShowAddSong(true);
  };

  const addSongToPlaylist = async (song: Song) => {
    if (!selectedPlaylist) return;
    const { error } = await supabase.from("playlist_songs").insert({
      playlist_id: selectedPlaylist.id,
      song_id: song.id,
      position: selectedPlaylist.songs.length,
    });
    if (error) {
      if (error.code === "23505") toast.info("Song already in playlist");
      else toast.error(error.message);
      return;
    }
    toast.success(`Added "${song.title}"`);
    loadPlaylistSongs(selectedPlaylist);
  };

  const removeSongFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    await supabase
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", selectedPlaylist.id)
      .eq("song_id", songId);
    toast.success("Removed from playlist");
    loadPlaylistSongs(selectedPlaylist);
  };

  const playPlaylist = (songs: Song[], startIndex = 0) => {
    if (songs.length === 0) return;
    usePlayerStore.getState().playSong(songs[startIndex], songs);
  };

  const addAllToQueue = async (playlistId: string, playlistName: string) => {
    const { data } = await supabase
      .from("playlist_songs")
      .select("songs(*)")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });
    const songs = (data || []).filter((ps) => ps.songs).map((ps) => ps.songs as unknown as Song);
    if (songs.length === 0) { toast.info("No songs in this playlist"); return; }
    const { addToQueue } = usePlayerStore.getState();
    songs.forEach((s) => addToQueue(s));
    toast.success(`Added ${songs.length} songs from "${playlistName}" to queue`);
  };

  const shufflePlay = (songs: Song[]) => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    usePlayerStore.getState().playSong(shuffled[0], shuffled);
    toast.success("Shuffling playlist");
  };

  const coverUploadRef = useRef<HTMLInputElement>(null);

  const togglePin = async (playlistId: string, currentlyPinned: boolean) => {
    await supabase.from("playlists").update({ is_pinned: !currentlyPinned } as any).eq("id", playlistId);
    toast.success(currentlyPinned ? "Unpinned playlist" : "Pinned playlist to top");
    loadPlaylists();
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist((prev) => prev ? { ...prev, is_pinned: !currentlyPinned } as any : null);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;
    const ext = file.name.split(".").pop();
    const path = `${selectedPlaylist.id}/cover.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); return; }
    const url = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    await supabase.from("playlists").update({ cover_image_url: url } as any).eq("id", selectedPlaylist.id);
    setSelectedPlaylist((prev) => prev ? { ...prev, cover_image_url: url } : null);
    toast.success("Cover updated!");
    loadPlaylists();
  };
  const filteredSongs = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ===== LIKED SONGS VIEW =====
  if (showLiked) {
    const filteredLiked = likedSearchQuery
      ? likedSongsList.filter(
          (s) =>
            s.title.toLowerCase().includes(likedSearchQuery.toLowerCase()) ||
            s.artist.toLowerCase().includes(likedSearchQuery.toLowerCase())
        )
      : likedSongsList;

    return (
      <div className="p-4 md:p-6 space-y-6">
        <button
          onClick={() => { setShowLiked(false); setLikedSearchQuery(""); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to playlists
        </button>

        <div className="flex items-center gap-4">
          <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center flex-shrink-0">
            <Heart className="h-10 w-10 text-primary-foreground fill-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-bold text-foreground">Liked Songs</h2>
            <p className="text-xs text-muted-foreground mt-1">{likedSongsList.length} songs</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {likedSongsList.length > 0 && (
            <>
              <button
                onClick={() => playPlaylist(likedSongsList)}
                className="gradient-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Play className="h-4 w-4" /> Play All
              </button>
              <button
                onClick={() => shufflePlay(likedSongsList)}
                className="bg-secondary text-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <Shuffle className="h-4 w-4" /> Shuffle
              </button>
            </>
          )}
        </div>

        {/* Search within liked */}
        {likedSongsList.length > 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={likedSearchQuery}
              onChange={(e) => setLikedSearchQuery(e.target.value)}
              placeholder="Search liked songs..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {filteredLiked.length > 0 ? (
          <div className="space-y-1">
            {filteredLiked.map((song, i) => (
              <div
                key={song.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors group cursor-pointer"
                onClick={() => playPlaylist(filteredLiked, i)}
              >
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                  {song.cover_image_url ? (
                    <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration ?? undefined)}</span>
                <SongContextMenu song={song} triggerClassName="opacity-0 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {likedSearchQuery ? "No matching songs found." : "No liked songs yet. Heart a song to save it here!"}
          </p>
        )}
      </div>
    );
  }

  // ===== PLAYLIST DETAIL VIEW =====
  if (selectedPlaylist) {
    const filteredPlaylistSongs = playlistSearchQuery
      ? selectedPlaylist.songs.filter(
          (s) =>
            s.title.toLowerCase().includes(playlistSearchQuery.toLowerCase()) ||
            s.artist.toLowerCase().includes(playlistSearchQuery.toLowerCase())
        )
      : selectedPlaylist.songs;

    return (
      <div className="p-4 md:p-6 space-y-6">
        <button
          onClick={() => { setSelectedPlaylist(null); setPlaylistSearchQuery(""); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to playlists
        </button>

        <div className="flex items-center gap-4">
          <div
            className="h-24 w-24 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden relative group/cover cursor-pointer"
            onClick={() => coverUploadRef.current?.click()}
          >
            {selectedPlaylist.cover_image_url ? (
              <CoverImg src={selectedPlaylist.cover_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Music2 className="h-10 w-10 text-muted-foreground" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <ImagePlus className="h-5 w-5 text-white" />
            </div>
            <input ref={coverUploadRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-bold text-foreground truncate">{selectedPlaylist.name}</h2>
            {selectedPlaylist.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{selectedPlaylist.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {selectedPlaylist.songs.length} songs{formatTotalDuration(selectedPlaylist.songs) ? ` • ${formatTotalDuration(selectedPlaylist.songs)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedPlaylist.songs.length > 0 && (
            <>
              <button
                onClick={() => playPlaylist(selectedPlaylist.songs)}
                className="gradient-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Play className="h-4 w-4" /> Play All
              </button>
              <button
                onClick={() => shufflePlay(selectedPlaylist.songs)}
                className="bg-secondary text-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <Shuffle className="h-4 w-4" /> Shuffle
              </button>
            </>
          )}
          <button
            onClick={openAddSong}
            className="bg-secondary text-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-secondary/80 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Songs
          </button>
          <button
            onClick={() => sharePlaylist(selectedPlaylist.id, selectedPlaylist.name)}
            className="bg-secondary text-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-secondary/80 transition-colors flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Search within playlist */}
        {selectedPlaylist.songs.length > 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={playlistSearchQuery}
              onChange={(e) => setPlaylistSearchQuery(e.target.value)}
              placeholder="Search in playlist..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Song list */}
        {filteredPlaylistSongs.length > 0 ? (
          <div className="space-y-1">
            {filteredPlaylistSongs.map((song, i) => (
              <div
                key={song.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors group cursor-pointer"
                onClick={() => playPlaylist(filteredPlaylistSongs, i)}
              >
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                  {song.cover_image_url ? (
                    <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration ?? undefined)}</span>
                <SongContextMenu song={song} triggerClassName="opacity-0 group-hover:opacity-100" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({ type: "song", id: song.id, name: song.title });
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {playlistSearchQuery ? "No matching songs found." : 'No songs yet. Click "Add Songs" to get started.'}
          </p>
        )}

        {/* Add song modal */}
        <AnimatePresence>
          {showAddSong && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => { setShowAddSong(false); setSearchQuery(""); }}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-xl p-5 w-full max-w-md max-h-[70vh] flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-semibold text-foreground">Add Songs</h3>
                  <button onClick={() => { setShowAddSong(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search songs..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {filteredSongs.length > 0 ? filteredSongs.map((song) => {
                    const alreadyAdded = selectedPlaylist.songs.some((s) => s.id === song.id);
                    return (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer"
                        onClick={() => !alreadyAdded && addSongToPlaylist(song)}
                      >
                        <div className="h-9 w-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                          {song.cover_image_url ? (
                            <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full gradient-primary opacity-30" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                        {alreadyAdded ? (
                          <span className="text-xs text-muted-foreground">Added</span>
                        ) : (
                          <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No songs found.</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground">Library</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="gradient-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Playlist
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-card border border-border rounded-xl p-5 max-w-md space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-foreground">New Playlist</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleCreate}
              className="w-full gradient-primary text-primary-foreground text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Create Playlist
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liked Songs card - always first */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="group relative bg-gradient-to-br from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 rounded-xl p-3 transition-colors cursor-pointer bounce-card"
          onClick={loadLikedSongs}
        >
          <div className="relative aspect-square rounded-lg bg-gradient-to-br from-primary/40 to-accent/40 overflow-hidden mb-3 flex items-center justify-center">
            <Heart className="h-10 w-10 text-primary-foreground fill-primary-foreground" />
            <motion.button
              className="absolute bottom-2 right-2 h-10 w-10 rounded-full gradient-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity glow-shadow"
            >
              <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
            </motion.button>
          </div>
          <h3 className="text-sm font-medium truncate text-foreground">Liked Songs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{likedCount} songs</p>
        </motion.div>

        {/* User playlists */}
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-3 animate-pulse">
                <div className="aspect-square rounded-lg bg-secondary mb-3" />
                <div className="h-4 bg-secondary rounded w-2/3" />
              </div>
            ))
          : playlists.map((p) => (
              <motion.div
                key={p.id}
                whileHover={{ scale: 1.02 }}
                className="group relative bg-card hover:bg-secondary/80 rounded-xl p-3 transition-colors cursor-pointer bounce-card"
                onClick={() => loadPlaylistSongs(p)}
              >
                <div className="relative aspect-square rounded-lg bg-secondary overflow-hidden mb-3 flex items-center justify-center">
                  {p.cover_image_url ? (
                    <CoverImg src={p.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Music2 className="h-10 w-10 text-muted-foreground/50" />
                  )}
                  {p.is_pinned && (
                    <div className="absolute top-1.5 left-1.5 bg-primary/80 rounded-full p-1">
                      <Pin className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadPlaylistSongs(p);
                    }}
                    className="absolute bottom-2 right-2 h-10 w-10 rounded-full gradient-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity glow-shadow"
                  >
                    <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
                  </motion.button>
                </div>
                <h3 className="text-sm font-medium truncate text-foreground">{p.name}</h3>
                {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{p.song_count ?? 0} songs</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1 rounded-full hover:bg-secondary">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => togglePin(p.id, p.is_pinned)}>
                      {p.is_pinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                      {p.is_pinned ? "Unpin" : "Pin to Top"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => sharePlaylist(p.id, p.name)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addAllToQueue(p.id, p.name)}>
                      <ListPlus className="h-4 w-4 mr-2" />
                      Add All to Queue
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteConfirm({ type: "playlist", id: p.id, name: p.name })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
      </div>

      {!loading && playlists.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Create a playlist to start organizing your music.</p>
      )}

      {/* Followed Artists */}
      {loading ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-display font-bold text-foreground">Artists You Follow</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 w-24">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </section>
      ) : followedArtists.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-display font-bold text-foreground">Artists You Follow</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {followedArtists.map((artist) => (
              <div
                key={artist.artist_id}
                className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 w-24 active:scale-95 transition-transform"
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.artist_name)}`)}
              >
                <div className="h-20 w-20 rounded-full bg-secondary overflow-hidden">
                  {artist.artist_image ? (
                    <img src={artist.artist_image} alt={artist.artist_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary-foreground/50" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground text-center truncate w-full">{artist.artist_name}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === "playlist" ? "Delete Playlist" : "Remove Song"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "playlist"
                ? `Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`
                : `Are you sure you want to remove "${deleteConfirm?.name}" from this playlist?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm?.type === "playlist") {
                  handleDelete(deleteConfirm.id);
                } else if (deleteConfirm) {
                  removeSongFromPlaylist(deleteConfirm.id);
                }
                setDeleteConfirm(null);
              }}
            >
              {deleteConfirm?.type === "playlist" ? "Delete" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
