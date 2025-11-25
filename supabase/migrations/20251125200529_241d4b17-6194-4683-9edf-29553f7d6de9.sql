-- Adicionar coluna days_to_notify na tabela auto_notification_config
ALTER TABLE auto_notification_config
ADD COLUMN IF NOT EXISTS days_to_notify INTEGER[] DEFAULT '{0,3,7}';

COMMENT ON COLUMN auto_notification_config.days_to_notify IS 'Dias antes do vencimento para enviar notificações automáticas';