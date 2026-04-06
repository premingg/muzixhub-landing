// Streams files from Telegram – no JWT required (verify_jwt=false in config.toml)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_API = "https://api.telegram.org";

// Simple in-memory cache for file paths (they expire after ~1 hour from Telegram)
const filePathCache = new Map<string, { path: string; expires: number }>();
const CACHE_TTL = 50 * 60 * 1000; // 50 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");
    const mode = url.searchParams.get("mode") || "proxy"; // "proxy" or "url"

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing file_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache
    let filePath: string | undefined;
    const cached = filePathCache.get(fileId);
    if (cached && cached.expires > Date.now()) {
      filePath = cached.path;
    }

    // Fetch file path from Telegram if not cached
    if (!filePath) {
      const getFileRes = await fetch(
        `${TELEGRAM_API}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
      );
      const getFileData = await getFileRes.json();

      if (!getFileRes.ok || !getFileData.ok) {
        throw new Error(`Telegram getFile error: ${JSON.stringify(getFileData)}`);
      }

      filePath = getFileData.result.file_path;
      if (filePath) {
        filePathCache.set(fileId, { path: filePath, expires: Date.now() + CACHE_TTL });
      }
    }

    if (!filePath) {
      return new Response(JSON.stringify({ error: "Could not resolve file path" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downloadUrl = `${TELEGRAM_API}/file/bot${BOT_TOKEN}/${filePath}`;

    // If mode=url, just return the URL (client will fetch directly — note: URL expires)
    if (mode === "url") {
      return new Response(JSON.stringify({ url: downloadUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy mode: stream the file through our edge function
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download file from Telegram: ${fileRes.status}`);
    }

    // Determine content type from file path
    let contentType = "application/octet-stream";
    if (filePath.endsWith(".mp3")) contentType = "audio/mpeg";
    else if (filePath.endsWith(".wav")) contentType = "audio/wav";
    else if (filePath.endsWith(".ogg")) contentType = "audio/ogg";
    else if (filePath.endsWith(".m4a")) contentType = "audio/mp4";
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (filePath.endsWith(".png")) contentType = "image/png";
    else if (filePath.endsWith(".webp")) contentType = "image/webp";

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=3600");
    if (fileRes.headers.get("content-length")) {
      headers.set("Content-Length", fileRes.headers.get("content-length")!);
    }

    return new Response(fileRes.body, { status: 200, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Telegram stream error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
