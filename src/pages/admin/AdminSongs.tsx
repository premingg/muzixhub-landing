import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Play, Pause, X, Loader2, Image, Music } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { getAudioBlobUrl } from "@/lib/telegram";
import { useSongCover, useTelegramImage } from "@/hooks/useTelegramImage";

const GENRES = ["Pop", "Hip Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Indie", "Country", "Latin", "Metal", "Folk", "Soul", "Reggae", "Blues", "Afrobeats", "K-Pop", "Lo-fi", "Phonk", "Other"];

type Song = Tables<"songs">;

function SongCoverCell({ song }: { song: Song }) {
  const coverUrl = useSongCover(song as any);
  return (
    <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full gradient-primary opacity-30" />
      )}
    </div>
  );
}

export default function AdminSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSong, setEditSong] = useState<Song | null>(null);
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({ title: "", artist: "", album: "", genre: "", description: "" });
  const [newCover, setNewCover] = useState<File | null>(null);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const fetchSongs = async () => {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    setSongs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const deleteSong = async (id: string) => {
    await supabase.from("songs").delete().eq("id", id);
    toast.success("Song deleted");
    fetchSongs();
  };

  const openEdit = (song: Song) => {
    setEditSong(song);
    setEditForm({
      title: song.title,
      artist: song.artist,
      album: song.album || "",
      genre: song.genre || "",
      description: song.description || "",
    });
    setCoverPreview(song.cover_image_url || null);
    setNewCover(null);
    setNewAudio(null);
  };

  const uploadToTelegram = async (file: File, type: "audio" | "photo", title?: string, artist?: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    if (title) formData.append("title", title);
    if (artist) formData.append("artist", artist);

    const { data, error } = await supabase.functions.invoke("telegram-upload", {
      body: formData,
    });

    if (error || !data?.file_id) throw new Error(error?.message || data?.error || "Upload to Telegram failed");
    return data.file_id;
  };

  const handleSave = async () => {
    if (!editSong) return;
    setSaving(true);

    try {
      const updateData: Record<string, any> = {
        title: editForm.title,
        artist: editForm.artist,
        album: editForm.album || null,
        genre: editForm.genre || null,
        description: editForm.description || null,
      };

      const streamBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-stream`;

      if (newCover) {
        const coverFileId = await uploadToTelegram(newCover, "photo");
        updateData.cover_telegram_file_id = coverFileId;
        updateData.cover_image_url = `${streamBase}?file_id=${encodeURIComponent(coverFileId)}`;
      }

      if (newAudio) {
        const audioFileId = await uploadToTelegram(newAudio, "audio", editForm.title, editForm.artist);
        updateData.telegram_file_id = audioFileId;
        updateData.audio_url = `${streamBase}?file_id=${encodeURIComponent(audioFileId)}`;
      }

      const { error } = await supabase.from("songs").update(updateData).eq("id", editSong.id);

      if (error) throw error;
      toast.success("Song updated");
      setEditSong(null);
      fetchSongs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePlay = async (song: Song) => {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const src = await getAudioBlobUrl(song as any);
      if (!src) return;
      const audio = new Audio(src);
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(song.id);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Manage Songs</h1>

      {songs.length === 0 ? (
        <p className="text-muted-foreground">No songs uploaded yet.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Song</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">Genre</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden md:table-cell">Plays</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => (
                  <tr key={song.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SongCoverCell song={song} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{song.genre || "—"}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{song.plays}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {(song.audio_url || song.telegram_file_id) && (
                          <button onClick={() => togglePlay(song)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {playingId === song.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                        )}
                        <button onClick={() => openEdit(song)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ id: song.id, title: song.title })} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editSong && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-foreground">Edit Song</h2>
              <button onClick={() => setEditSong(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cover preview */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="h-24 w-24 rounded-lg bg-secondary border border-dashed border-border flex items-center justify-center overflow-hidden flex-shrink-0 hover:border-primary/50 transition-colors"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Image className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 transition-colors flex items-center gap-2"
                >
                  <Music className="h-4 w-4" />
                  {newAudio ? newAudio.name : "Replace audio file"}
                </button>
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setNewCover(f); setCoverPreview(URL.createObjectURL(f)); }
              }} />
              <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setNewAudio(f);
              }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Title</label>
                <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Artist</label>
                <input value={editForm.artist} onChange={(e) => setEditForm((f) => ({ ...f, artist: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Album</label>
                <input value={editForm.album} onChange={(e) => setEditForm((f) => ({ ...f, album: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Genre</label>
                <Select value={editForm.genre} onValueChange={(v) => setEditForm((f) => ({ ...f, genre: v }))}>
                  <SelectTrigger className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50 text-sm">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>


            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditSong(null)} className="flex-1 bg-secondary text-foreground font-medium py-2.5 rounded-lg hover:bg-secondary/80 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 gradient-primary text-primary-foreground font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Song</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) deleteSong(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
