-- Add theme preference column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'sepia', 'high-contrast'));

-- Add comment to the column
COMMENT ON COLUMN public.profiles.theme IS 'User preferred theme: dark, light, sepia, or high-contrast';

-- Create index for faster theme lookups
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON public.profiles(theme);