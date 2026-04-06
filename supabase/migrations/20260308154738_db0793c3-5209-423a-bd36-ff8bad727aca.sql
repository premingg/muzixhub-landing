
-- Liked songs table
CREATE TABLE public.liked_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own liked songs" ON public.liked_songs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can like songs" ON public.liked_songs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike songs" ON public.liked_songs
  FOR DELETE USING (auth.uid() = user_id);

-- Room queue table for shared queue
CREATE TABLE public.room_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  added_by UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view room queue" ON public.room_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Room members can add to queue" ON public.room_queue
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_queue.room_id AND user_id = auth.uid())
  );

CREATE POLICY "Room members can remove from queue" ON public.room_queue
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = room_queue.room_id AND user_id = auth.uid())
  );

-- Allow any room member to update the room (not just host)
DROP POLICY "Hosts can update their rooms" ON public.rooms;
CREATE POLICY "Room members can update rooms" ON public.rooms
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = rooms.id AND user_id = auth.uid())
  );

-- Enable realtime for room_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_queue;
