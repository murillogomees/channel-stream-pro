-- Create IPTV import jobs table for background imports
CREATE TABLE IF NOT EXISTS public.iptv_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  source_url TEXT,
  source_name TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  parsed_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_iptv_import_jobs_created_by_created_at
  ON public.iptv_import_jobs (created_by, created_at DESC);

ALTER TABLE public.iptv_import_jobs ENABLE ROW LEVEL SECURITY;

-- Recreate policies (Postgres doesn't support CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS "Admins can view IPTV import jobs" ON public.iptv_import_jobs;
DROP POLICY IF EXISTS "Admins can create IPTV import jobs" ON public.iptv_import_jobs;

CREATE POLICY "Admins can view IPTV import jobs"
ON public.iptv_import_jobs
FOR SELECT
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','master')
  )
);

CREATE POLICY "Admins can create IPTV import jobs"
ON public.iptv_import_jobs
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','master')
  )
);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_iptv_import_jobs_updated_at ON public.iptv_import_jobs;
CREATE TRIGGER update_iptv_import_jobs_updated_at
BEFORE UPDATE ON public.iptv_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();