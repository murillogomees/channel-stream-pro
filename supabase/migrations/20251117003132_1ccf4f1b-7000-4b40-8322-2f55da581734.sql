-- Adicionar campos de canais alternativos e horários de plantão
ALTER TABLE public.admin_phones
ADD COLUMN telegram_id text,
ADD COLUMN phone_sms text,
ADD COLUMN notification_channels jsonb DEFAULT '["whatsapp"]'::jsonb,
ADD COLUMN schedule_enabled boolean DEFAULT false,
ADD COLUMN schedule_config jsonb DEFAULT '{
  "monday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "tuesday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "wednesday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "thursday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "friday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "saturday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "sunday": {"enabled": true, "start": "00:00", "end": "23:59"}
}'::jsonb;

-- Adicionar índice para melhor performance
CREATE INDEX idx_admin_phones_active_schedule ON public.admin_phones(active, schedule_enabled);

-- Comentários para documentação
COMMENT ON COLUMN public.admin_phones.telegram_id IS 'ID do Telegram para notificações alternativas';
COMMENT ON COLUMN public.admin_phones.phone_sms IS 'Telefone para SMS (formato E.164)';
COMMENT ON COLUMN public.admin_phones.notification_channels IS 'Array de canais: ["whatsapp", "telegram", "sms"]';
COMMENT ON COLUMN public.admin_phones.schedule_enabled IS 'Se true, só recebe alertas nos horários configurados';
COMMENT ON COLUMN public.admin_phones.schedule_config IS 'Configuração de horários por dia da semana';