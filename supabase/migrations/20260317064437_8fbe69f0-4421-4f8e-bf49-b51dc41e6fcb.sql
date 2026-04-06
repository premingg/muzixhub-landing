-- Add Telegram file ID columns to songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS telegram_file_id text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS cover_telegram_file_id text;

-- Create follows table
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, artist_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follows" ON public.follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can follow artists" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow artists" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anyone can count follows" ON public.follows
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_follows_user_id ON public.follows(user_id);
CREATE INDEX idx_follows_artist_id ON public.follows(artist_id);