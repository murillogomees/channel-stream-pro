-- Fix RLS policies for user_profiles to allow admin access and proper queries
DROP POLICY IF EXISTS "Users can view own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profiles" ON user_profiles;

-- Users can view their own profiles
CREATE POLICY "Users can view own profiles" 
ON user_profiles 
FOR SELECT 
USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()));

-- Users can create their own profiles
CREATE POLICY "Users can create own profiles" 
ON user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR is_admin_or_master(auth.uid()));

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles" 
ON user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()));

-- Users can delete their own profiles
CREATE POLICY "Users can delete own profiles" 
ON user_profiles 
FOR DELETE 
USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()));