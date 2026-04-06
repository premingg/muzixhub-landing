import { ImgHTMLAttributes } from 'react';
import { useSongCover, useTelegramImage } from '@/hooks/useTelegramImage';

interface SongCoverImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  song: {
    cover_telegram_file_id?: string | null;
    cover_image_url?: string | null;
  } | null | undefined;
  fallback?: React.ReactNode;
}

/**
 * Drop-in image component for song cover art.
 * Automatically handles Telegram file resolution with auth.
 */
export function SongCoverImg({ song, fallback, ...props }: SongCoverImgProps) {
  const url = useSongCover(song);
  if (!url) return fallback ? <>{fallback}</> : null;
  return <img src={url} {...props} />;
}

interface TelegramImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  telegramFileId?: string | null;
  fallbackUrl?: string | null;
  fallback?: React.ReactNode;
}

/**
 * Generic image component for any Telegram-stored image.
 */
export function TelegramImg({ telegramFileId, fallbackUrl, fallback, ...props }: TelegramImgProps) {
  const url = useTelegramImage(telegramFileId, fallbackUrl);
  if (!url) return fallback ? <>{fallback}</> : null;
  return <img src={url} {...props} />;
}
