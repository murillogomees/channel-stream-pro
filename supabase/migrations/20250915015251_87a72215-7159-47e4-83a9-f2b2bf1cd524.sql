-- Clean up any duplicate admins and ensure murilloggomes@gmail.com is the main admin
DELETE FROM admins WHERE email = 'murilloggomes@gmail.com' AND id != (
  SELECT id FROM admins WHERE email = 'murilloggomes@gmail.com' ORDER BY created_at ASC LIMIT 1
);

-- Update the admin to have super admin role with full access
UPDATE admins 
SET 
  role = 'super_admin',
  name = 'Murillo Gomes - Super Admin',
  updated_at = now()
WHERE email = 'murilloggomes@gmail.com';

-- Create super admin role policy for M3U lists
DROP POLICY IF EXISTS "Super admins can manage M3U lists" ON m3u_lists;
CREATE POLICY "Super admins can manage M3U lists" 
ON m3u_lists 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM admins WHERE role = 'super_admin'
  )
);

-- Create super admin policy for affiliates
DROP POLICY IF EXISTS "Super admins can manage affiliates" ON affiliates;
CREATE POLICY "Super admins can manage affiliates" 
ON affiliates 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM admins WHERE role = 'super_admin'
  )
);

-- Create super admin policy for affiliate sales
DROP POLICY IF EXISTS "Super admins can manage all affiliate sales" ON affiliate_sales;
CREATE POLICY "Super admins can manage all affiliate sales" 
ON affiliate_sales 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM admins WHERE role = 'super_admin'
  )
);

-- Create super admin policy for recommended players
DROP POLICY IF EXISTS "Super admins can manage all players" ON recommended_players;
CREATE POLICY "Super admins can manage all players" 
ON recommended_players 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM admins WHERE role = 'super_admin'
  )
);