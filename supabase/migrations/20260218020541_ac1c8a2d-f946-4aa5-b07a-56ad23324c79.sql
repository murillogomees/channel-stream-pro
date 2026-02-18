-- Add unique constraint on sigma_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS sigma_blaze_clients_sigma_id_unique ON public.sigma_blaze_clients (sigma_id) WHERE sigma_id IS NOT NULL;