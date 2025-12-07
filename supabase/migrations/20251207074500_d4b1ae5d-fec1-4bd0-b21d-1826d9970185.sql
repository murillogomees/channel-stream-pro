-- Enable realtime for rls_audit_resolutions
ALTER TABLE public.rls_audit_resolutions REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rls_audit_resolutions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rls_audit_resolutions;
  END IF;
END $$;