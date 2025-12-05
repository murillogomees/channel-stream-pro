-- First: Create viewer_profiles which is the parent table
CREATE TABLE IF NOT EXISTS public.viewer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  avatar_url TEXT,
  avatar_color VARCHAR(7) DEFAULT '#6366f1',
  is_kids BOOLEAN DEFAULT false,
  pin_code VARCHAR(4),
  language VARCHAR(10) DEFAULT 'pt-BR',
  maturity_rating VARCHAR(20) DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_viewer_profiles_user ON viewer_profiles(user_id);

ALTER TABLE viewer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profiles" ON viewer_profiles;
CREATE POLICY "Users manage own profiles" ON viewer_profiles FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all profiles" ON viewer_profiles;
CREATE POLICY "Admins manage all profiles" ON viewer_profiles FOR ALL USING (is_admin_or_master(auth.uid()));