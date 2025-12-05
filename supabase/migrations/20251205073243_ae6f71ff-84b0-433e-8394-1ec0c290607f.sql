-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.viewer_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS favorites_profile_content_idx 
  ON public.favorites(profile_id, content_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS favorites_profile_idx ON public.favorites(profile_id);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins and masters
CREATE POLICY "Admins and masters full access favorites"
  ON public.favorites
  FOR ALL
  USING (is_admin_or_master(auth.uid()));

-- RLS policy for users to manage their own favorites
CREATE POLICY "Users can manage their own favorites"
  ON public.favorites
  FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM public.viewer_profiles WHERE user_id = auth.uid()
    )
  );
