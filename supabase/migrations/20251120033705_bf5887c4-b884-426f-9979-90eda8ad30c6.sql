-- Adicionar coluna test_phone_number na tabela auto_notification_config
ALTER TABLE public.auto_notification_config
ADD COLUMN IF NOT EXISTS test_phone_number TEXT DEFAULT '';