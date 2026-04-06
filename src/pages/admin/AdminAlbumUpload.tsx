import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Upload, Image, Music, Loader2, X, Edit2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GENRES = ["Pop", "Hip Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Indie", "Country", "Latin", "Metal", "Folk", "Soul", "Reggae", "Blues", "Afrobeats", "K-Pop", "Lo-fi", "Phonk", "Other"];

interface Mood { id: string; name: string; emoji: string; }
interface Artist { id: string; name: string; image_url: string | null; }
interface TrackEntry {
  file: File;
  title: string;
  genre: string;
  selectedMoods: string[];
  editing: boolean;
}

export default function AdminAlbumUpload() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistSearch, setArtistSearch] = useState("");
  const [artistDropdownOpen, setArtistDropdownOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);

  const [albumName, setAlbumName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [tracks, setTracks] = useState<TrackEntry[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("moods").select("*"),
      supabase.from("artists").select("*").order("name"),
    ]).then(([moodsRes, artistsRes]) => {
      if (moodsRes.data) setMoods(moodsRes.data as Mood[]);
      if (artistsRes.data) setArtists(artistsRes.data as Artist[]);
    });
  }, []);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handleAudioFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTracks: TrackEntry[] = files.map((f) => ({
      file: f,
      title: f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      genre: "",
      selectedMoods: [],
      editing: false,
    }));
    setTracks((prev) => [...prev, ...newTracks]);
  };

  const updateTrack = (index: number, updates: Partial<TrackEntry>) => {
    setTracks((prev) => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const removeTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTrackMood = (index: number, moodId: string) => {
    setTracks((prev) => prev.map((t, i) => {
      if (i !== index) return t;
      const moods = t.selectedMoods.includes(moodId)
        ? t.selectedMoods.filter((id) => id !== moodId)
        : [...t.selectedMoods, moodId];
      return { ...t, selectedMoods: moods };
    }));
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
    if (error || !data?.file_id) throw new Error(error?.message || data?.error || "Upload failed");
    return data.file_id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || tracks.length === 0) { toast.error("Please add audio files"); return; }
    if (!albumName.trim() || !artistName.trim()) { toast.error("Album name and artist are required"); return; }

    setLoading(true);
    try {
      // Upload cover once
      let coverTelegramFileId: string | null = null;
      const streamBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-stream`;
      let coverUrl: string | null = null;

      if (coverFile) {
        setUploadProgress("Uploading album cover...");
        coverTelegramFileId = await uploadToTelegram(coverFile, "photo");
        coverUrl = `${streamBase}?file_id=${encodeURIComponent(coverTelegramFileId)}`;
      }

      // Create album
      setUploadProgress("Creating album...");
      const { data: albumData, error: albumError } = await supabase.from("albums").insert({
        name: albumName,
        artist: artistName,
        cover_image_url: coverUrl,
        description: albumDescription || null,
        created_by: user.id,
      } as any).select("id").single();
      if (albumError) throw albumError;

      // Upload each track
      const songIds: string[] = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        setCurrentTrackIndex(i);
        setUploadProgress(`Uploading track ${i + 1}/${tracks.length}: ${track.title}`);

        const audioFileId = await uploadToTelegram(track.file, "audio", track.title, artistName);
        const audioUrl = `${streamBase}?file_id=${encodeURIComponent(audioFileId)}`;

        // Get duration
        const duration = await new Promise<number>((resolve) => {
          const audio = new Audio(URL.createObjectURL(track.file));
          audio.addEventListener("loadedmetadata", () => { resolve(Math.round(audio.duration)); URL.revokeObjectURL(audio.src); });
          audio.addEventListener("error", () => resolve(0));
        });

        const { data: songData, error: songError } = await supabase.from("songs").insert({
          title: track.title,
          artist: artistName,
          album: albumName,
          genre: track.genre || null,
          cover_image_url: coverUrl,
          audio_url: audioUrl,
          telegram_file_id: audioFileId,
          cover_telegram_file_id: coverTelegramFileId,
          duration,
          uploaded_by: user.id,
        } as any).select("id").single();

        if (songError) throw songError;
        songIds.push(songData.id);

        // Add moods
        if (track.selectedMoods.length > 0) {
          await supabase.from("song_moods").insert(
            track.selectedMoods.map((moodId) => ({ song_id: songData.id, mood_id: moodId })) as any
          );
        }
      }

      // Link songs to album
      setUploadProgress("Linking songs to album...");
      await supabase.from("album_songs").insert(
        songIds.map((sid, i) => ({ album_id: albumData.id, song_id: sid, position: i + 1 })) as any
      );

      toast.success(`Album "${albumName}" uploaded with ${tracks.length} tracks!`);
      navigate("/admin/albums");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLoading(false);
      setUploadProgress("");
      setCurrentTrackIndex(-1);
    }
  };

  const filteredArtists = artists.filter((a) => a.name.toLowerCase().includes((artistSearch || artistName).toLowerCase()));

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Upload Album</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover & Album Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Album Art</label>
            <button type="button" onClick={() => coverRef.current?.click()} className="w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden">
              {coverPreview ? <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" /> : <><Image className="h-8 w-8 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click to upload</span></>}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </div>
          <div className="sm:col-span-2 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Album Name *</label>
              <input type="text" required value={albumName} onChange={(e) => setAlbumName(e.target.value)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Album name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Artist *</label>
              <div className="relative">
                <input type="text" required value={artistName} onChange={(e) => { setArtistName(e.target.value); setArtistSearch(e.target.value); setArtistDropdownOpen(true); }} onFocus={() => setArtistDropdownOpen(true)} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Search or select artist" />
                {artistDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setArtistDropdownOpen(false)} />
                    <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                      {filteredArtists.map((a) => (
                        <button key={a.id} type="button" onClick={() => { setArtistName(a.name); setArtistSearch(""); setArtistDropdownOpen(false); }} className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary/60 transition-colors text-left ${artistName === a.name ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                          {a.image_url && <img src={a.image_url} alt="" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />}
                          <span>{a.name}</span>
                        </button>
                      ))}
                      {filteredArtists.length === 0 && <p className="px-4 py-2 text-xs text-muted-foreground">No artists found.</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <textarea value={albumDescription} onChange={(e) => setAlbumDescription(e.target.value)} rows={2} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="Album description..." />
            </div>
          </div>
        </div>

        {/* Add Audio Files */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Songs *</label>
          <button type="button" onClick={() => audioRef.current?.click()} className="w-full bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-4 flex items-center justify-center gap-2">
            <Music className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to add audio files (select multiple)</span>
          </button>
          <input ref={audioRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleAudioFiles} />
        </div>

        {/* Track List */}
        {tracks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{tracks.length} track{tracks.length > 1 ? "s" : ""}</h3>
            {tracks.map((track, i) => (
              <div key={i} className={`bg-card border border-border rounded-lg p-3 space-y-2 ${loading && currentTrackIndex === i ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-center">{i + 1}</span>
                  {track.editing ? (
                    <input autoFocus type="text" value={track.title} onChange={(e) => updateTrack(i, { title: e.target.value })} onBlur={() => updateTrack(i, { editing: false })} onKeyDown={(e) => e.key === "Enter" && updateTrack(i, { editing: false })} className="flex-1 bg-secondary rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  ) : (
                    <span className="flex-1 text-sm text-foreground truncate">{track.title}</span>
                  )}
                  <button type="button" onClick={() => updateTrack(i, { editing: !track.editing })} className="text-muted-foreground hover:text-foreground">
                    {track.editing ? <Check className="h-4 w-4" /> : <Edit2 className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => removeTrack(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2 ml-9">
                  <Select value={track.genre} onValueChange={(v) => updateTrack(i, { genre: v })}>
                    <SelectTrigger className="h-8 text-xs bg-secondary border-none w-32"><SelectValue placeholder="Genre" /></SelectTrigger>
                    <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1">
                    {moods.slice(0, 6).map((mood) => (
                      <button key={mood.id} type="button" onClick={() => toggleTrackMood(i, mood.id)} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${track.selectedMoods.includes(mood.id) ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                        {mood.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground ml-9 truncate">{track.file.name}</p>
              </div>
            ))}
          </div>
        )}

        {uploadProgress && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{uploadProgress}</span>
            {tracks.length > 1 && currentTrackIndex >= 0 && (
              <span className="text-xs text-muted-foreground ml-auto">{currentTrackIndex + 1}/{tracks.length}</span>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || tracks.length === 0} className="gradient-primary text-primary-foreground font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "Uploading..." : `Upload Album (${tracks.length} tracks)`}
        </button>
      </form>
    </div>
  );
}
