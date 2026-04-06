import { useState, useEffect } from 'react';
import { fetchTelegramBlob } from '@/lib/telegram';

/**
 * Hook that resolves a Telegram cover image to a blob URL with auth.
 * Falls back to the provided fallback URL (e.g. cover_image_url).
 */
export function useTelegramImage(
  telegramFileId: string | null | undefined,
  fallbackUrl: string | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(fallbackUrl || null);

  useEffect(() => {
    if (!telegramFileId) {
      setUrl(fallbackUrl || null);
      return;
    }

    let cancelled = false;
    fetchTelegramBlob(telegramFileId)
      .then((blobUrl) => {
        if (!cancelled) setUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(fallbackUrl || null);
      });

    return () => { cancelled = true; };
  }, [telegramFileId, fallbackUrl]);

  return url;
}

/**
 * Convenience: pass a song-like object and get the resolved cover URL.
 */
export function useSongCover(song: {
  cover_telegram_file_id?: string | null;
  cover_image_url?: string | null;
} | null | undefined): string | null {
  return useTelegramImage(
    song?.cover_telegram_file_id,
    song?.cover_image_url
  );
}
