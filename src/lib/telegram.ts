// Helper to construct Telegram streaming URLs via our edge function
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cache blob URLs to avoid re-fetching
const blobCache = new Map<string, string>();

/**
 * Fetches a file from telegram-stream with proper auth and returns a blob URL.
 * Caches results so the same file_id is only fetched once.
 */
export async function fetchTelegramBlob(fileId: string): Promise<string> {
  const cached = blobCache.get(fileId);
  if (cached) return cached;

  const url = `${SUPABASE_URL}/functions/v1/telegram-stream?file_id=${encodeURIComponent(fileId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch telegram file: ${res.status}`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobCache.set(fileId, blobUrl);
  return blobUrl;
}

/** Constructs the raw edge function URL (for use with fetch + auth headers) */
export function getTelegramStreamUrl(fileId: string): string {
  return `${SUPABASE_URL}/functions/v1/telegram-stream?file_id=${encodeURIComponent(fileId)}`;
}

export function getTelegramImageUrl(fileId: string): string {
  return `${SUPABASE_URL}/functions/v1/telegram-stream?file_id=${encodeURIComponent(fileId)}`;
}

/**
 * Resolves the playable audio URL for a song.
 * Prefers telegram_file_id if available, falls back to audio_url.
 */
export function getAudioUrl(song: { telegram_file_id?: string | null; audio_url?: string | null }): string | null {
  if (song.telegram_file_id) return getTelegramStreamUrl(song.telegram_file_id);
  return song.audio_url || null;
}

/**
 * Resolves the cover image URL for a song.
 * Prefers cover_telegram_file_id if available, falls back to cover_image_url.
 */
export function getCoverUrl(song: { cover_telegram_file_id?: string | null; cover_image_url?: string | null }): string | null {
  if (song.cover_telegram_file_id) return getTelegramImageUrl(song.cover_telegram_file_id);
  return song.cover_image_url || null;
}

/**
 * Async version that returns a blob URL for audio playback.
 * Falls back to audio_url if no telegram_file_id.
 */
export async function getAudioBlobUrl(song: { telegram_file_id?: string | null; audio_url?: string | null }): Promise<string | null> {
  if (song.telegram_file_id) {
    try {
      return await fetchTelegramBlob(song.telegram_file_id);
    } catch {
      // Fall back to audio_url
      return song.audio_url || null;
    }
  }
  return song.audio_url || null;
}

/**
 * Async version that returns a blob URL for cover images.
 * Falls back to cover_image_url if no cover_telegram_file_id.
 */
export async function getCoverBlobUrl(song: { cover_telegram_file_id?: string | null; cover_image_url?: string | null }): Promise<string | null> {
  if (song.cover_telegram_file_id) {
    try {
      return await fetchTelegramBlob(song.cover_telegram_file_id);
    } catch {
      return song.cover_image_url || null;
    }
  }
  return song.cover_image_url || null;
}
