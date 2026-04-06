import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Plus, X, Trash2, Image, Search, Music, Disc3, Loader2, GripVertical, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";
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

type Song = Tables<"songs">;

interface Album {
  id: string;
  name: string;
  artist: string;
  cover_image_url: string | null;
  description: string | null;
  created_at: string;
  song_count?: number;
}

interface AlbumSong {
  id: string;
  song_id: string;
  position: number;
  song?: Song;
}

export default function AdminAlbums() {
  const { user } = useAuthStore();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumSongs, setAlbumSongs] = useState<AlbumSong[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const editCoverRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "album" | "song"; id: string; name: string } | null>(null);

  // Edit album state
  const [editingAlbum, setEditingAlbum] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", artist: "", description: "" });
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [artists, setArtists] = useState<{ id: string; name: string; image_url: string | null }[]>([]);
  const [createArtistDropdown, setCreateArtistDropdown] = useState(false);
  const [editArtistDropdown, setEditArtistDropdown] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "",
    artist: "",
    description: "",
  });

  useEffect(() => {
    supabase.from("artists").select("*").order("name").then(({ data }) => {
      if (data) setArtists(data);
    });
  }, []);

  const fetchAlbums = async () => {
    const { data } = await supabase.from("albums").select("*").order("created_at", { ascending: false });
    if (data) {
      // Get song counts
      const withCounts = await Promise.all(
        data.map(async (a) => {
          const { count } = await supabase
            .from("album_songs")
            .select("*", { count: "exact", head: true })
            .eq("album_id", a.id);
          return { ...a, song_count: count || 0 };
        })
      );
      setAlbums(withCounts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  const handleCreate = async () => {
    if (!user || !createForm.name.trim() || !createForm.artist.trim()) {
      toast.error("Name and artist are required");
      return;
    }
    setCreating(true);
    try {
      let coverUrl: string | null = null;
      const albumId = crypto.randomUUID();

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${albumId}/cover.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, coverFile);
        if (error) throw error;
        coverUrl = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("albums").insert({
        id: albumId,
        name: createForm.name.trim(),
        artist: createForm.artist.trim(),
        description: createForm.description.trim() || null,
        cover_image_url: coverUrl,
        created_by: user.id,
      });
      if (error) throw error;

      toast.success("Album created!");
      setShowCreate(false);
      setCreateForm({ name: "", artist: "", description: "" });
      setCoverFile(null);
      setCoverPreview(null);
      fetchAlbums();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteAlbum = async (albumId: string) => {
    await supabase.from("albums").delete().eq("id", albumId);
    toast.success("Album deleted");
    if (selectedAlbum?.id === albumId) setSelectedAlbum(null);
    fetchAlbums();
  };

  const openAlbum = async (album: Album) => {
    setSelectedAlbum(album);
    setEditingAlbum(false);
    const { data } = await supabase
      .from("album_songs")
      .select("*, songs(*)")
      .eq("album_id", album.id)
      .order("position");
    if (data) {
      setAlbumSongs(data.map((d) => ({ ...d, song: d.songs as unknown as Song })));
    }
  };

  const startEditAlbum = () => {
    if (!selectedAlbum) return;
    setEditForm({
      name: selectedAlbum.name,
      artist: selectedAlbum.artist,
      description: selectedAlbum.description || "",
    });
    setEditCoverPreview(selectedAlbum.cover_image_url);
    setEditCoverFile(null);
    setEditingAlbum(true);
  };

  const saveAlbumEdit = async () => {
    if (!selectedAlbum || !editForm.name.trim() || !editForm.artist.trim()) {
      toast.error("Name and artist are required");
      return;
    }
    setSavingEdit(true);
    try {
      let coverUrl = selectedAlbum.cover_image_url;

      if (editCoverFile) {
        const ext = editCoverFile.name.split(".").pop();
        const path = `${selectedAlbum.id}/cover.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, editCoverFile, { upsert: true });
        if (error) throw error;
        coverUrl = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("albums").update({
        name: editForm.name.trim(),
        artist: editForm.artist.trim(),
        description: editForm.description.trim() || null,
        cover_image_url: coverUrl,
      }).eq("id", selectedAlbum.id);

      if (error) throw error;

      const updatedAlbum = { ...selectedAlbum, name: editForm.name.trim(), artist: editForm.artist.trim(), description: editForm.description.trim() || null, cover_image_url: coverUrl };
      setSelectedAlbum(updatedAlbum);
      setEditingAlbum(false);
      toast.success("Album updated!");
      fetchAlbums();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const loadAllSongs = async () => {
    const { data } = await supabase.from("songs").select("*").order("title");
    setAllSongs(data || []);
  };

  const addSongToAlbum = async (song: Song) => {
    if (!selectedAlbum) return;
    const { error } = await supabase.from("album_songs").insert({
      album_id: selectedAlbum.id,
      song_id: song.id,
      position: albumSongs.length,
    });
    if (error) {
      if (error.code === "23505") toast.error("Song already in this album");
      else toast.error(error.message);
      return;
    }
    toast.success(`Added "${song.title}"`);
    openAlbum(selectedAlbum);
    fetchAlbums();
  };

  const removeSongFromAlbum = async (albumSongId: string) => {
    await supabase.from("album_songs").delete().eq("id", albumSongId);
    if (selectedAlbum) openAlbum(selectedAlbum);
    fetchAlbums();
    toast.success("Song removed from album");
  };

  const filteredSongs = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const existingSongIds = new Set(albumSongs.map((as) => as.song_id));

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Manage Albums</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="gradient-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Album
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Album List */}
        <div className="space-y-2">
          {albums.length === 0 ? (
            <div className="text-center py-12">
              <Disc3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No albums yet. Create one!</p>
            </div>
          ) : (
            albums.map((album) => (
              <div
                key={album.id}
                onClick={() => selectedAlbum?.id === album.id ? setSelectedAlbum(null) : openAlbum(album)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  selectedAlbum?.id === album.id
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border hover:border-primary/20"
                }`}
              >
                <div className="h-14 w-14 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                  {album.cover_image_url ? (
                    <CoverImg src={album.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary opacity-30 flex items-center justify-center">
                      <Disc3 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{album.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                  <p className="text-xs text-muted-foreground">{album.song_count} songs</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "album", id: album.id, name: album.name }); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Album Detail / Songs */}
        <div className="bg-card border border-border rounded-xl p-5">
          {selectedAlbum ? (
            <>
              {editingAlbum ? (
                /* Edit Album Form */
                <div className="space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-display font-bold text-foreground">Edit Album</h3>
                    <button onClick={() => setEditingAlbum(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => editCoverRef.current?.click()}
                      className="h-20 w-20 rounded-lg bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      {editCoverPreview ? (
                        <img src={editCoverPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Image className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                    <input ref={editCoverRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setEditCoverFile(f); setEditCoverPreview(URL.createObjectURL(f)); }
                    }} />
                    <div className="flex-1 space-y-2">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Album name *"
                        className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="relative">
                        <input
                          value={editForm.artist}
                          onChange={(e) => { setEditForm((f) => ({ ...f, artist: e.target.value })); setEditArtistDropdown(true); }}
                          onFocus={() => setEditArtistDropdown(true)}
                          placeholder="Artist *"
                          className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        {editArtistDropdown && (
                          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 max-h-40 overflow-y-auto">
                            {artists.filter((a) => a.name.toLowerCase().includes(editForm.artist.toLowerCase())).map((a) => (
                              <button key={a.id} type="button" onClick={() => { setEditForm((f) => ({ ...f, artist: a.name })); setEditArtistDropdown(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors text-left ${editForm.artist === a.name ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                                {a.image_url && <img src={a.image_url} alt="" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />}
                                <span>{a.name}</span>
                              </button>
                            ))}
                            {artists.filter((a) => a.name.toLowerCase().includes(editForm.artist.toLowerCase())).length === 0 && (
                              <p className="px-3 py-1.5 text-xs text-muted-foreground">No artists found</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setEditingAlbum(false)} className="flex-1 bg-secondary text-foreground font-medium py-2 rounded-lg hover:bg-secondary/80 transition-colors text-sm">
                      Cancel
                    </button>
                    <button onClick={saveAlbumEdit} disabled={savingEdit} className="flex-1 gradient-primary text-primary-foreground font-medium py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                      {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Album Header (view mode) */
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-16 w-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {selectedAlbum.cover_image_url ? (
                      <CoverImg src={selectedAlbum.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full gradient-primary opacity-30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-display font-bold text-foreground">{selectedAlbum.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedAlbum.artist}</p>
                  </div>
                  <button
                    onClick={startEditAlbum}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit album"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}

              <button
                onClick={() => { loadAllSongs(); setShowSongPicker(true); }}
                className="w-full mb-4 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Songs
              </button>

              {albumSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No songs in this album yet.</p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {albumSongs.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/60 transition-colors group">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="h-9 w-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                        {item.song?.cover_image_url ? (
                          <CoverImg src={item.song?.cover_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-primary opacity-30" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.song?.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.song?.artist}</p>
                      </div>
                      <button
                        onClick={() => removeSongFromAlbum(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Disc3 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Select an album to manage its songs</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Album Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display font-semibold text-foreground">Create Album</h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="h-24 w-24 rounded-lg bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden flex-shrink-0"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Image className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>
                <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }
                }} />
                <div className="flex-1 space-y-3">
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Album name *"
                    className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="relative">
                    <input
                      value={createForm.artist}
                      onChange={(e) => { setCreateForm((f) => ({ ...f, artist: e.target.value })); setCreateArtistDropdown(true); }}
                      onFocus={() => setCreateArtistDropdown(true)}
                      placeholder="Artist *"
                      className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {createArtistDropdown && (
                      <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 max-h-40 overflow-y-auto">
                        {artists.filter((a) => a.name.toLowerCase().includes(createForm.artist.toLowerCase())).map((a) => (
                          <button key={a.id} type="button" onClick={() => { setCreateForm((f) => ({ ...f, artist: a.name })); setCreateArtistDropdown(false); }} className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors text-left ${createForm.artist === a.name ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                            {a.image_url && <img src={a.image_url} alt="" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />}
                            <span>{a.name}</span>
                          </button>
                        ))}
                        {artists.filter((a) => a.name.toLowerCase().includes(createForm.artist.toLowerCase())).length === 0 && (
                          <p className="px-3 py-1.5 text-xs text-muted-foreground">No artists found</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full gradient-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {creating ? "Creating..." : "Create Album"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Song Picker Modal */}
      <AnimatePresence>
        {showSongPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setShowSongPicker(false); setSearchQuery(""); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-5 w-full max-w-md max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-foreground">Add Songs to Album</h3>
                <button onClick={() => { setShowSongPicker(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
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
                {filteredSongs.map((song) => {
                  const alreadyAdded = existingSongIds.has(song.id);
                  return (
                    <div key={song.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${alreadyAdded ? "opacity-40" : "hover:bg-secondary/60 cursor-pointer"}`}>
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
                        <button
                          onClick={() => addSongToAlbum(song)}
                          className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === "album" ? "Delete Album" : "Remove Song"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "album"
                ? `Are you sure you want to delete "${deleteConfirm.name}"? Songs won't be deleted.`
                : `Remove "${deleteConfirm?.name}" from this album?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm?.type === "album") {
                  deleteAlbum(deleteConfirm.id);
                } else if (deleteConfirm) {
                  removeSongFromAlbum(deleteConfirm.id);
                }
                setDeleteConfirm(null);
              }}
            >
              {deleteConfirm?.type === "album" ? "Delete" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
