
-- Moods table
CREATE TABLE public.moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL
);

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moods are viewable by everyone" ON public.moods
  FOR SELECT USING (true);

-- Song-mood junction table
CREATE TABLE public.song_moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  mood_id uuid NOT NULL REFERENCES public.moods(id) ON DELETE CASCADE,
  UNIQUE(song_id, mood_id)
);

ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Song moods are viewable by everyone" ON public.song_moods
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert song moods" ON public.song_moods
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete song moods" ON public.song_moods
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- User listening activity table
CREATE TABLE public.user_listening_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  minutes_listened real NOT NULL DEFAULT 0,
  songs_played integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE public.user_listening_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity" ON public.user_listening_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity" ON public.user_listening_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity" ON public.user_listening_activity
  FOR UPDATE USING (auth.uid() = user_id);
