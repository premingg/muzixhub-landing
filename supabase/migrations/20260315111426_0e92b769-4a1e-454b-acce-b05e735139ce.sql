
-- Create artists table for admin-managed artists
CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  image_url text,
  bio text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Everyone can view artists
CREATE POLICY "Artists are viewable by everyone" ON public.artists
  FOR SELECT TO public USING (true);

-- Admins can manage artists
CREATE POLICY "Admins can insert artists" ON public.artists
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update artists" ON public.artists
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete artists" ON public.artists
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));
