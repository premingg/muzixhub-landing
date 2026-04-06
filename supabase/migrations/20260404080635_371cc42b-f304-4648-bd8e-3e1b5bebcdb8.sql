ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS last_action_user TEXT,
  ADD COLUMN IF NOT EXISTS last_action_type TEXT,
  ADD COLUMN IF NOT EXISTS last_action_song TEXT;

DROP POLICY IF EXISTS "Hosts can update their rooms" ON public.rooms;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rooms' 
    AND policyname = 'Room members can update rooms'
  ) THEN
    CREATE POLICY "Room members can update rooms" ON public.rooms
      FOR UPDATE TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.room_members 
          WHERE room_id = rooms.id 
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'room_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_queue;
  END IF;
END $$;