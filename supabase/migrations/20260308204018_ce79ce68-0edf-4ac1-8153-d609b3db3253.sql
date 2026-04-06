
-- Create albums table
CREATE TABLE public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_image_url TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create album_songs junction table
CREATE TABLE public.album_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(album_id, song_id)
);

-- Enable RLS
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_songs ENABLE ROW LEVEL SECURITY;

-- Albums are viewable by everyone
CREATE POLICY "Albums are viewable by everyone"
  ON public.albums FOR SELECT
  USING (true);

-- Only admins can manage albums
CREATE POLICY "Admins can insert albums"
  ON public.albums FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update albums"
  ON public.albums FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete albums"
  ON public.albums FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Album songs viewable by everyone
CREATE POLICY "Album songs are viewable by everyone"
  ON public.album_songs FOR SELECT
  USING (true);

-- Only admins can manage album songs
CREATE POLICY "Admins can insert album songs"
  ON public.album_songs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete album songs"
  ON public.album_songs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
