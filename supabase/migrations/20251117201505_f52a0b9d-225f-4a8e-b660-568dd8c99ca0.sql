-- Adicionar campo de observações/descrição nas listas M3U
ALTER TABLE public.m3u_lists ADD COLUMN description text;

-- Adicionar campos para rastreamento de quem criou/atualizou
ALTER TABLE public.m3u_lists ADD COLUMN created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.m3u_lists ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- Criar tabela de histórico de alterações das listas M3U
CREATE TABLE public.m3u_lists_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  m3u_list_id uuid NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  change_type text NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.m3u_lists_audit ENABLE ROW LEVEL SECURITY;

-- Política para admins visualizarem histórico
CREATE POLICY "Admins podem visualizar histórico de M3U"
ON public.m3u_lists_audit FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política para sistema inserir no histórico
CREATE POLICY "Sistema pode inserir histórico de M3U"
ON public.m3u_lists_audit FOR INSERT
WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX idx_m3u_lists_audit_list_id ON public.m3u_lists_audit(m3u_list_id);
CREATE INDEX idx_m3u_lists_audit_created_at ON public.m3u_lists_audit(created_at DESC);

-- Função para automaticamente registrar alterações
CREATE OR REPLACE FUNCTION log_m3u_list_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.m3u_lists_audit (
      m3u_list_id,
      changed_by,
      change_type,
      new_values
    ) VALUES (
      NEW.id,
      COALESCE(NEW.created_by, auth.uid()),
      'created',
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.m3u_lists_audit (
      m3u_list_id,
      changed_by,
      change_type,
      old_values,
      new_values
    ) VALUES (
      NEW.id,
      COALESCE(NEW.updated_by, auth.uid()),
      'updated',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.m3u_lists_audit (
      m3u_list_id,
      changed_by,
      change_type,
      old_values
    ) VALUES (
      OLD.id,
      auth.uid(),
      'deleted',
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para registrar alterações automaticamente
CREATE TRIGGER m3u_lists_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.m3u_lists
FOR EACH ROW EXECUTE FUNCTION log_m3u_list_changes();