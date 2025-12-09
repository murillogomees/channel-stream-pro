-- Criar função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela para armazenar instâncias Supabase self-hosted
CREATE TABLE public.supabase_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  service_role_key_enc TEXT NOT NULL,
  anon_key_enc TEXT,
  pg_host TEXT,
  pg_port INTEGER DEFAULT 5432,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'inactive')),
  last_health_check TIMESTAMPTZ,
  last_backup TIMESTAMPTZ,
  db_size_bytes BIGINT,
  postgres_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de audit logs para operações
CREATE TABLE public.supabase_instance_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.supabase_instances(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES auth.users(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de backups
CREATE TABLE public.supabase_instance_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.supabase_instances(id) ON DELETE CASCADE,
  file_path TEXT,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.supabase_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_instance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_instance_backups ENABLE ROW LEVEL SECURITY;

-- Policies - apenas admin/master podem acessar
CREATE POLICY "Admin/Master can manage instances" ON public.supabase_instances
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/Master can view audit" ON public.supabase_instance_audit
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/Master can manage backups" ON public.supabase_instance_backups
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_supabase_instances_updated_at
  BEFORE UPDATE ON public.supabase_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_supabase_instances_status ON public.supabase_instances(status);
CREATE INDEX idx_supabase_instance_audit_instance ON public.supabase_instance_audit(instance_id);
CREATE INDEX idx_supabase_instance_backups_instance ON public.supabase_instance_backups(instance_id);