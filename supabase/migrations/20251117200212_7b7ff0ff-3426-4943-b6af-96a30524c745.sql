-- Remover bucket de storage m3u-files (não é mais necessário)
DELETE FROM storage.objects WHERE bucket_id IN ('m3u-files', 'm3U Files');
DELETE FROM storage.buckets WHERE id IN ('m3u-files', 'm3U Files');

-- Adicionar comentário na coluna file_url para esclarecer que agora aceita URLs diretas
COMMENT ON COLUMN public.m3u_lists.file_url IS 'URL direta da lista M3U (não é mais upload de arquivo)';