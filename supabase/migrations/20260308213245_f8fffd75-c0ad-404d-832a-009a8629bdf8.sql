
-- Listening streak table
CREATE TABLE public.listening_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 1,
  longest_streak INTEGER NOT NULL DEFAULT 1,
  last_listen_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listening_streaks ENABLE ROW LEVEL SECURITY;

-- Each user has exactly one row
CREATE UNIQUE INDEX idx_listening_streaks_user ON public.listening_streaks(user_id);

CREATE POLICY "Users can view their own streak"
  ON public.listening_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
  ON public.listening_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
  ON public.listening_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Continue listening table
CREATE TABLE public.continue_listening (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  last_position_seconds REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE public.continue_listening ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own continue listening"
  ON public.continue_listening FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own continue listening"
  ON public.continue_listening FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own continue listening"
  ON public.continue_listening FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own continue listening"
  ON public.continue_listening FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
