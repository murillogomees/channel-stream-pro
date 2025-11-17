-- Recriar políticas de Storage usando função totalmente qualificada
DO $$
BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins podem visualizar arquivos M3U'
  ) THEN
    DROP POLICY "Admins podem visualizar arquivos M3U" ON storage.objects;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins podem fazer upload de arquivos M3U'
  ) THEN
    DROP POLICY "Admins podem fazer upload de arquivos M3U" ON storage.objects;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins podem atualizar arquivos M3U'
  ) THEN
    DROP POLICY "Admins podem atualizar arquivos M3U" ON storage.objects;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins podem deletar arquivos M3U'
  ) THEN
    DROP POLICY "Admins podem deletar arquivos M3U" ON storage.objects;
  END IF;
END $$;

-- Create policies referencing public.has_role explicitly
CREATE POLICY "Admins podem visualizar arquivos M3U"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem fazer upload de arquivos M3U"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'm3u-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem atualizar arquivos M3U"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'm3u-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins podem deletar arquivos M3U"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'm3u-files' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('m3u-files', 'm3u-files', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;