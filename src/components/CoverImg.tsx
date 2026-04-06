import { useState, useEffect, ImgHTMLAttributes, memo } from 'react';
import { fetchTelegramBlob } from '@/lib/telegram';

const STREAM_PATH = '/functions/v1/telegram-stream';

function extractFileId(url: string): string | null {
  if (!url.includes(STREAM_PATH)) return null;
  try {
    const u = new URL(url);
    return u.searchParams.get('file_id');
  } catch {
    return null;
  }
}

interface CoverImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
}

/**
 * Drop-in replacement for <img> that auto-detects telegram-stream URLs
 * and fetches them with proper auth headers, returning blob URLs.
 * For non-telegram URLs, renders a normal <img>.
 */
export const CoverImg = memo(function CoverImg({ src, ...props }: CoverImgProps) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setResolved(null); return; }

    const fileId = extractFileId(src);
    if (!fileId) {
      setResolved(src);
      return;
    }

    let cancelled = false;
    fetchTelegramBlob(fileId).then((blob) => {
      if (!cancelled) setResolved(blob);
    }).catch(() => {
      if (!cancelled) setResolved(null);
    });

    return () => { cancelled = true; };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} {...props} />;
});
