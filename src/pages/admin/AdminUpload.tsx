import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Upload, Image, Music, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GENRES = ["Pop", "Hip Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Indie", "Country", "Latin", "Metal", "Folk", "Soul", "Reggae", "Blues", "Afrobeats", "K-Pop", "Lo-fi", "Phonk", "Other"];

interface Mood { id: string; name: string; emoji: string; }
interface Artist { id: string; name: string; image_url: string | null; }

export default function AdminUpload() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [moodDropdownOpen, setMoodDropdownOpen] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistSearch, setArtistSearch] = useState("");
  const [artistDropdownOpen, setArtistDropdownOpen] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState("");

  const [form, setForm] = useState({
    title: "", artist: "", album: "", genre: "", description: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("moods").select("*"),
      supabase.from("artists").select("*").order("name"),
    ]).then(([moodsRes, artistsRes]) => {
      if (moodsRes.data) setMoods(moodsRes.data as Mood[]);
      if (artistsRes.data) setArtists(artistsRes.data as Artist[]);
    });
  }, []);

  const updateForm = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const toggleMood = (moodId: string) => setSelectedMoods((prev) => prev.includes(moodId) ? prev.filter((id) => id !== moodId) : [...prev, moodId]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.addEventListener("loadedmetadata", () => {
        setAudioDuration(Math.round(audio.duration));
        URL.revokeObjectURL(audio.src);
      });
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !audioFile) { toast.error("Please select an audio file"); return; }

    setLoading(true);
    const songId = crypto.randomUUID();

    try {
      let coverTelegramFileId: string | null = null;
      let audioTelegramFileId: string | null = null;

      // Upload cover to Telegram
      if (coverFile) {
        setUploadProgress("Uploading cover to Telegram...");
        coverTelegramFileId = await uploadToTelegram(coverFile, "photo");
      }

      // Upload audio to Telegram
      setUploadProgress("Uploading audio to Telegram...");
      audioTelegramFileId = await uploadToTelegram(audioFile, "audio", form.title, form.artist);

      setUploadProgress("Saving to database...");

      // Build stream URLs for backward compat
      const streamBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-stream`;
      const audioUrl = `${streamBase}?file_id=${encodeURIComponent(audioTelegramFileId)}`;
      const coverUrl = coverTelegramFileId ? `${streamBase}?file_id=${encodeURIComponent(coverTelegramFileId)}` : null;

      const { data: songData, error: dbError } = await supabase.from("songs").insert({
        id: songId,
        title: form.title,
        artist: form.artist,
        album: form.album || null,
        genre: form.genre || null,
        description: form.description || null,
        cover_image_url: coverUrl,
        audio_url: audioUrl,
        telegram_file_id: audioTelegramFileId,
        cover_telegram_file_id: coverTelegramFileId,
        duration: audioDuration || null,
        uploaded_by: user.id,
      } as any).select("id").single();

      if (dbError) throw dbError;

      if (selectedMoods.length > 0 && songData) {
        const moodRows = selectedMoods.map((moodId) => ({ song_id: songData.id, mood_id: moodId }));
        await supabase.from("song_moods").insert(moodRows as any);
      }

      toast.success("Song uploaded via Telegram successfully!");
      navigate("/admin/songs");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLoading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Upload Song</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Cover Image</label>
            <button type="button" onClick={() => coverRef.current?.click()} className="w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden">
              {coverPreview ? <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" /> : <><Image className="h-8 w-8 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click to upload</span></>}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Audio File *</label>
            <button type="button" onClick={() => audioRef.current?.click()} className="w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2">
              <Music className="h-8 w-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{audioFile ? audioFile.name : "Click to upload"}</span>
            </button>
            <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Title *</label>
            <input type="text" required value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Song title" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Artist *</label>
            <div className="relative">
              <input type="text" required value={form.artist} onChange={(e) => { updateForm("artist", e.target.value); setArtistSearch(e.target.value); setArtistDropdownOpen(true); }} onFocus={() => setArtistDropdownOpen(true)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Search or select artist" />
              {artistDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                  {artists.filter((a) => a.name.toLowerCase().includes((artistSearch || form.artist).toLowerCase())).map((a) => (
                    <button key={a.id} type="button" onClick={() => { updateForm("artist", a.name); setArtistSearch(""); setArtistDropdownOpen(false); }} className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors text-left ${form.artist === a.name ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                      {a.image_url && <img src={a.image_url} alt="" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />}
                      <span>{a.name}</span>
                    </button>
                  ))}
                  {artists.filter((a) => a.name.toLowerCase().includes((artistSearch || form.artist).toLowerCase())).length === 0 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground">No artists found. Add one in Manage Artists.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Album</label>
            <input type="text" value={form.album} onChange={(e) => updateForm("album", e.target.value)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Album name" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Genre</label>
            <Select value={form.genre} onValueChange={(v) => updateForm("genre", v)}>
              <SelectTrigger className="w-full bg-secondary border-none focus:ring-2 focus:ring-primary/50"><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Moods */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Moods (optional)</label>
          <div className="relative">
            <button type="button" onClick={() => setMoodDropdownOpen(!moodDropdownOpen)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between">
              <span className={selectedMoods.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                {selectedMoods.length === 0 ? "Select moods..." : `${selectedMoods.length} mood${selectedMoods.length > 1 ? "s" : ""} selected`}
              </span>
            </button>
            {moodDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoodDropdownOpen(false)} />
                <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                  {moods.map((mood) => (
                    <button key={mood.id} type="button" onClick={() => toggleMood(mood.id)} className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors ${selectedMoods.includes(mood.id) ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                      <span className="w-5 h-5 rounded border border-border flex items-center justify-center text-xs flex-shrink-0">{selectedMoods.includes(mood.id) ? "✓" : ""}</span>
                      <span>{mood.emoji} {mood.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {selectedMoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedMoods.map((id) => { const mood = moods.find((m) => m.id === id); return mood ? (
                <span key={id} className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                  {mood.emoji} {mood.name}
                  <button type="button" onClick={() => toggleMood(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ) : null; })}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={3} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="Brief description of the song..." />
        </div>

        {uploadProgress && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="gradient-primary text-primary-foreground font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "Uploading..." : "Upload Song"}
        </button>
      </form>
    </div>
  );
}
