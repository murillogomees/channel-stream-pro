-- Drop existing public policy and recreate with explicit anonymous access
DROP POLICY IF EXISTS "Planos ativos são públicos" ON public.subscription_plans;

-- Create policy that explicitly allows anonymous/public read access
CREATE POLICY "Anyone can view active subscription plans" 
ON public.subscription_plans 
FOR SELECT 
TO anon, authenticated
USING (is_active = true);