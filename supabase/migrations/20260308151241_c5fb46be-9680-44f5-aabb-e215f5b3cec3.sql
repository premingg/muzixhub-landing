-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: admins can read all roles, users can read their own
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  description TEXT,
  cover_image_url TEXT,
  audio_url TEXT,
  plays INTEGER NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Everyone can read songs
CREATE POLICY "Songs are viewable by everyone"
  ON public.songs FOR SELECT USING (true);

-- Only admins can insert songs
CREATE POLICY "Admins can insert songs"
  ON public.songs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update songs
CREATE POLICY "Admins can update songs"
  ON public.songs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete songs
CREATE POLICY "Admins can delete songs"
  ON public.songs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage buckets for songs and covers
INSERT INTO storage.buckets (id, name, public) VALUES ('songs', 'songs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);

-- Storage policies for songs bucket
CREATE POLICY "Song files are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'songs');

CREATE POLICY "Admins can upload songs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update song files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete song files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for covers bucket
CREATE POLICY "Cover images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Admins can upload covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));