-- Criar políticas RLS para o bucket m3u-files

-- Permitir que admins vejam arquivos M3U
CREATE POLICY "Admins podem visualizar arquivos M3U"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir que admins façam upload de arquivos M3U
CREATE POLICY "Admins podem fazer upload de arquivos M3U"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'm3u-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir que admins atualizem arquivos M3U
CREATE POLICY "Admins podem atualizar arquivos M3U"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'm3u-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir que admins deletem arquivos M3U
CREATE POLICY "Admins podem deletar arquivos M3U"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Verificar se o bucket existe e é público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'm3u-files';

-- Se o bucket não existir, criá-lo
INSERT INTO storage.buckets (id, name, public)
VALUES ('m3u-files', 'm3U Files', true)
ON CONFLICT (id) DO NOTHING;