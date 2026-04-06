DROP TABLE IF EXISTS public.room_queue CASCADE;
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

CREATE TABLE public.pulse_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  current_song_data JSONB,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  current_position REAL NOT NULL DEFAULT 0,
  position_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  queue JSONB NOT NULL DEFAULT '[]',
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pulse_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pulse sessions"
  ON public.pulse_sessions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can create pulse sessions"
  ON public.pulse_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Anyone can update pulse sessions"
  ON public.pulse_sessions FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Creator can delete pulse session"
  ON public.pulse_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_sessions;
