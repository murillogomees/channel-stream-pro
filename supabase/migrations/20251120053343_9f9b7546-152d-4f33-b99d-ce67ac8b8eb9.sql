-- Create import changes history table
CREATE TABLE IF NOT EXISTS public.m3u_import_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.m3u_import_sessions(id) ON DELETE CASCADE,
  custom_list_id uuid REFERENCES public.m3u_custom_lists(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('added', 'removed', 'modified')),
  entity_type text NOT NULL CHECK (entity_type IN ('category', 'channel')),
  entity_id uuid,
  entity_name text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast queries
CREATE INDEX idx_m3u_import_changes_session ON public.m3u_import_changes(session_id);
CREATE INDEX idx_m3u_import_changes_list ON public.m3u_import_changes(custom_list_id);
CREATE INDEX idx_m3u_import_changes_type ON public.m3u_import_changes(change_type);

-- Add conflict resolution fields to import sessions
ALTER TABLE public.m3u_import_sessions
ADD COLUMN IF NOT EXISTS conflict_resolution_mode text CHECK (conflict_resolution_mode IN ('merge', 'replace', 'manual')) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS conflicts_detected integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS conflicts_resolved integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_resolved boolean DEFAULT false;

-- RLS policies
ALTER TABLE public.m3u_import_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins têm acesso total a import changes"
ON public.m3u_import_changes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.m3u_import_changes IS 'Histórico detalhado de mudanças detectadas durante reimportações de playlists M3U';