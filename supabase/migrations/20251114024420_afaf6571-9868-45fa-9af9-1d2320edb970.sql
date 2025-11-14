-- Criar trigger para sincronizar automaticamente quando MAC for atualizado
CREATE OR REPLACE FUNCTION public.sync_client_on_mac_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_data RECORD;
BEGIN
  -- Só executa se o MAC foi alterado e não é nulo
  IF NEW.mac_smart_one IS NOT NULL AND (OLD.mac_smart_one IS NULL OR NEW.mac_smart_one != OLD.mac_smart_one) THEN
    
    -- Buscar dados do perfil
    SELECT nome, telefone, email INTO profile_data
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Chamar edge function de forma assíncrona usando pg_net
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-new-client',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'cliente_id', NEW.id,
        'nome', profile_data.nome,
        'telefone', profile_data.telefone,
        'email', profile_data.email,
        'mac_smart_one', NEW.mac_smart_one,
        'usuario_m3u', NEW.usuario_m3u,
        'senha_m3u', NEW.senha_m3u
      )
    );
    
    -- Marcar como pendente
    NEW.smartone_status := 'pendente';
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sync_client_on_mac_update ON public.clientes;
CREATE TRIGGER trigger_sync_client_on_mac_update
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_on_mac_update();

-- Configurar variáveis de ambiente para o trigger (substituir com valores reais)
-- Isso precisa ser executado uma vez no banco
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://sdvyxdghxqmntyoweqbd.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'sua_anon_key';