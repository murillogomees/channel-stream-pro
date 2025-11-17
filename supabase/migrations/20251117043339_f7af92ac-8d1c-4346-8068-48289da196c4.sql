-- Adicionar coluna de snooze na tabela playlist_health_checks
ALTER TABLE public.playlist_health_checks
ADD COLUMN IF NOT EXISTS snoozed_until timestamp with time zone DEFAULT NULL;

-- Criar índice para otimizar consultas de playlists não snoozeadas
CREATE INDEX IF NOT EXISTS idx_playlist_health_snoozed 
ON public.playlist_health_checks(snoozed_until) 
WHERE snoozed_until IS NOT NULL;