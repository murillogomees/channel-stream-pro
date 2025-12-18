-- =====================================================
-- SCRIPT 15: CREATE AUTH TRIGGER
-- Supabase Cloud Project: sdvyxdghxqmntyoweqbd
-- =====================================================

-- Trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
