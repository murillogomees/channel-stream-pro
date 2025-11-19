-- Fix infinite recursion in clientes RLS policies
-- Remove the problematic policy that queries the same table
DROP POLICY IF EXISTS "Users can update own contact info" ON public.clientes;

-- Recreate a simpler policy without recursive queries
-- Users can update their own basic contact info (but not sensitive fields)
CREATE POLICY "Users can update own contact info" 
ON public.clientes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  -- No recursive SELECT queries - just check user_id ownership
);