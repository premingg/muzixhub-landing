-- Add featuring_artists to songs (array of artist names)
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS featuring_artists text[] NOT NULL DEFAULT '{}';
