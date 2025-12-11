-- Tabela de contatos de teste para WhatsApp
CREATE TABLE IF NOT EXISTS public.test_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para busca por telefone
CREATE INDEX idx_test_contacts_phone ON public.test_contacts(phone);

-- Enable RLS
ALTER TABLE public.test_contacts ENABLE ROW LEVEL SECURITY;

-- Policies: Admins podem gerenciar
CREATE POLICY "Admins can manage test contacts"
  ON public.test_contacts
  FOR ALL
  USING (is_admin_or_master());

-- Trigger para updated_at
CREATE TRIGGER update_test_contacts_updated_at
  BEFORE UPDATE ON public.test_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();