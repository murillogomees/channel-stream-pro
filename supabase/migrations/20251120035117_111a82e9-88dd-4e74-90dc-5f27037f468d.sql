-- Remove telegram column from clientes table
ALTER TABLE public.clientes DROP COLUMN IF EXISTS telegram;

-- Remove telegram_id and related columns from admin_phones table
ALTER TABLE public.admin_phones DROP COLUMN IF EXISTS telegram_id;

-- Update notification_channels default to remove telegram option
ALTER TABLE public.admin_phones 
ALTER COLUMN notification_channels SET DEFAULT '["whatsapp"]'::jsonb;