-- CORRIGIR FUNÇÃO handle_client_plan_change - REMOVER REFERÊNCIAS SMARTONE
-- Data: 2025-12-02
-- Descrição: Remove referências SmartOne da trigger function que gerencia mudança de plano

-- Recriar função sem referências ao SmartOne
CREATE OR REPLACE FUNCTION public.handle_client_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_plan_type text;
  new_plan_type text;
BEGIN
  -- Determinar tipo de plano antigo
  IF OLD.situacao IN ('Testando', 'Lead') THEN
    old_plan_type := 'teste';
  ELSIF OLD.plano IN ('Semestral', 'Anual') THEN
    old_plan_type := 'premium';
  ELSE
    old_plan_type := 'basico';
  END IF;

  -- Determinar tipo de plano novo
  IF NEW.situacao IN ('Testando', 'Lead') THEN
    new_plan_type := 'teste';
  ELSIF NEW.plano IN ('Semestral', 'Anual') THEN
    new_plan_type := 'premium';
  ELSE
    new_plan_type := 'basico';
  END IF;

  -- Log da mudança
  IF old_plan_type != new_plan_type THEN
    RAISE NOTICE 'Cliente % mudou de plano % para %.', 
      NEW.id, old_plan_type, new_plan_type;
  END IF;

  RETURN NEW;
END;
$function$;