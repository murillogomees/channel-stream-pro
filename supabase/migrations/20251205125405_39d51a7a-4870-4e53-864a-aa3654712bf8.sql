-- RLS policy para permitir clientes lerem dados de streaming de m3u_channels
-- Apenas colunas necessárias para playback (stream_url, r2_url, cf_stream_url, name)

-- Drop existing client policy if exists
DROP POLICY IF EXISTS "Clients can read stream data" ON public.m3u_channels;

-- Criar policy para clientes autenticados lerem dados de streaming
CREATE POLICY "Authenticated users can read stream data"
ON public.m3u_channels
FOR SELECT
TO authenticated
USING (true);

-- NOTA: Esta policy permite SELECT para usuários autenticados.
-- A restrição de colunas é feita via queries no frontend (select apenas o necessário).
-- Não há dados sensíveis expostos - apenas URLs de streaming.