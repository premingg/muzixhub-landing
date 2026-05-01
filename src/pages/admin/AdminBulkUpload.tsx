import { useState, useRef } from "react";
import jsmediatags from "jsmediatags";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Upload, Music, Loader2, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { parseArtists } from "@/lib/artistParsing";
import { FeaturingArtistsInput } from "@/components/admin/FeaturingArtistsInput";

type RowStatus = "pending" | "uploading" | "success" | "error";

interface Row {
  id: string;
  file: File;
  title: string;
  artist: string;
  featuring: string[];
  album: string;
  duration: number;
  status: RowStatus;
  error?: string;
}

function readTags(file: File): Promise<{ title?: string; artist?: string; album?: string }> {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const t = tag.tags || {};
        resolve({ title: t.title, artist: t.artist, album: t.album });
      },
      onError: () => resolve({}),
    });
  });
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    a.addEventListener("loadedmetadata", () => {
      const d = Math.round(a.duration || 0);
      URL.revokeObjectURL(url);
      resolve(isFinite(d) ? d : 0);
    });
    a.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });
  });
}

export default function AdminBulkUpload() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("audio") || /\.mp3$/i.test(f.name));
    if (arr.length === 0) {
      toast.error("No audio files selected");
      return;
    }
    setIsParsing(true);
    const parsed: Row[] = [];
    for (const file of arr) {
      const [tags, duration] = await Promise.all([readTags(file), readDuration(file)]);
      const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
      const rawArtist = tags.artist || "";
      const { main, featuring } = parseArtists(rawArtist);
      parsed.push({
        id: crypto.randomUUID(),
        file,
        title: (tags.title || fallbackTitle).trim(),
        artist: main || "Unknown Artist",
        featuring,
        album: (tags.album || "").trim(),
        duration,
        status: "pending",
      });
    }
    setRows((prev) => [...prev, ...parsed]);
    setIsParsing(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("border-primary");
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const uploadAudio = async (file: File, title: string, artist: string): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "audio");
    fd.append("title", title);
    fd.append("artist", artist);
    const { data, error } = await supabase.functions.invoke("telegram-upload", { body: fd });
    if (error || !data?.file_id) throw new Error(error?.message || data?.error || "Telegram upload failed");
    return data.file_id as string;
  };

  // Cache for created/found album IDs within this session: key = `${name.toLowerCase()}::${artist.toLowerCase()}`
  const ensureAlbum = async (
    cache: Map<string, string>,
    name: string,
    artist: string
  ): Promise<string | null> => {
    const cleanName = name.trim();
    const cleanArtist = artist.trim();
    if (!cleanName || !cleanArtist) return null;
    const key = `${cleanName.toLowerCase()}::${cleanArtist.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key)!;

    // Look up existing album (case-insensitive)
    const { data: existing } = await supabase
      .from("albums")
      .select("id, name, artist")
      .ilike("name", cleanName)
      .ilike("artist", cleanArtist)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      cache.set(key, existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("albums")
      .insert({ name: cleanName, artist: cleanArtist, created_by: user?.id ?? null } as any)
      .select("id")
      .single();
    if (error || !created) throw new Error(`Failed to create album "${cleanName}": ${error?.message || ""}`);
    cache.set(key, created.id);
    return created.id;
  };

  const handleConfirmUpload = async () => {
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    if (rows.length === 0) return;

    setIsUploading(true);
    setUploadIndex(0);
    const albumCache = new Map<string, string>();
    const streamBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-stream`;

    for (let i = 0; i < rows.length; i++) {
      setUploadIndex(i);
      const r = rows[i];
      if (r.status === "success") continue;
      updateRow(r.id, { status: "uploading", error: undefined });
      try {
        if (!r.title.trim() || !r.artist.trim()) throw new Error("Title and artist are required");

        const fileId = await uploadAudio(r.file, r.title, r.artist);
        const audioUrl = `${streamBase}?file_id=${encodeURIComponent(fileId)}`;
        const songId = crypto.randomUUID();

        const { error: dbErr } = await supabase
          .from("songs")
          .insert({
            id: songId,
            title: r.title.trim(),
            artist: r.artist.trim(),
            featuring_artists: r.featuring,
            album: r.album.trim() || null,
            audio_url: audioUrl,
            telegram_file_id: fileId,
            duration: r.duration || null,
            uploaded_by: user.id,
          } as any);
        if (dbErr) throw dbErr;

        // Auto-create / link album
        if (r.album.trim()) {
          try {
            const albumId = await ensureAlbum(albumCache, r.album, r.artist);
            if (albumId) {
              await supabase.from("album_songs").insert({ album_id: albumId, song_id: songId } as any);
            }
          } catch (albumErr) {
            console.warn("Album link failed:", albumErr);
          }
        }

        updateRow(r.id, { status: "success" });
      } catch (err: any) {
        updateRow(r.id, { status: "error", error: err?.message || "Upload failed" });
      }
    }

    setUploadIndex(rows.length);
    setIsUploading(false);

    const successCount = rows.filter((r) => r.status === "success").length;
    toast.success(`Bulk upload finished. Check the table for per-song status.`);
  };

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "success" || r.status === "error").length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Bulk Upload Songs</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Drag & drop multiple MP3 files. Metadata is auto-extracted. Edit any field before uploading.
      </p>

      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault();
          dropRef.current?.classList.add("border-primary");
        }}
        onDragLeave={() => dropRef.current?.classList.remove("border-primary")}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors p-10 text-center cursor-pointer mb-6"
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-foreground font-medium">Drop MP3 files here, or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">Multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {isParsing && (
        <div className="flex items-center gap-2 text-sm text-primary mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Parsing metadata...</span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {isUploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-foreground font-medium">
                  Uploading {Math.min(uploadIndex + 1, total)} of {total}...
                </span>
                <span className="text-muted-foreground">{progressPct}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full gradient-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Title</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Main Artist</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Featuring</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Album</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      {r.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                      {r.status === "uploading" && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                      {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {r.status === "error" && (
                        <span title={r.error}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[180px]">
                      <input
                        value={r.title}
                        onChange={(e) => updateRow(r.id, { title: e.target.value })}
                        disabled={isUploading}
                        className="w-full bg-secondary rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={r.file.name}>
                        <Music className="h-3 w-3 inline mr-1" />{r.file.name}
                      </p>
                    </td>
                    <td className="px-3 py-2 min-w-[150px]">
                      <input
                        value={r.artist}
                        onChange={(e) => updateRow(r.id, { artist: e.target.value })}
                        disabled={isUploading}
                        className="w-full bg-secondary rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      <FeaturingArtistsInput
                        value={r.featuring}
                        onChange={(next) => updateRow(r.id, { featuring: next })}
                        placeholder="Add featured artist"
                      />
                    </td>
                    <td className="px-3 py-2 min-w-[150px]">
                      <input
                        value={r.album}
                        onChange={(e) => updateRow(r.id, { album: e.target.value })}
                        disabled={isUploading}
                        className="w-full bg-secondary rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        placeholder="(none)"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(r.id)}
                        disabled={isUploading}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-muted-foreground">
              {rows.length} song{rows.length === 1 ? "" : "s"} ready
              {rows.filter((r) => r.status === "success").length > 0 &&
                ` · ${rows.filter((r) => r.status === "success").length} uploaded`}
              {rows.filter((r) => r.status === "error").length > 0 &&
                ` · ${rows.filter((r) => r.status === "error").length} failed`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRows([])}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 transition-colors disabled:opacity-40"
              >
                Clear
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={isUploading || rows.length === 0}
                className="gradient-primary text-primary-foreground font-medium py-2 px-5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploading ? "Uploading..." : `Upload ${rows.length} Song${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
