import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
}

interface HealthCheckResult {
  m3u_list_id: string;
  status: 'healthy' | 'error' | 'warning';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  channel_count?: number;
  last_checked_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[M3U Health Check] Iniciando verificação de saúde das listas M3U');

    // Buscar todas as listas M3U ativas
    const { data: lists, error: listError } = await supabase
      .from('m3u_lists')
      .select('id, name, file_url, status')
      .eq('status', 'active');

    if (listError) {
      console.error('[M3U Health Check] Erro ao buscar listas:', listError);
      throw listError;
    }

    if (!lists || lists.length === 0) {
      console.log('[M3U Health Check] Nenhuma lista M3U ativa encontrada');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma lista M3U ativa encontrada',
          stats: { total: 0, healthy: 0, error: 0, warning: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[M3U Health Check] Verificando ${lists.length} listas M3U`);

    const results: HealthCheckResult[] = [];
    let healthyCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    // Verificar cada lista M3U
    for (const list of lists as M3UList[]) {
      console.log(`[M3U Health Check] Verificando lista: ${list.name} (${list.id})`);
      
      const startTime = Date.now();
      let result: HealthCheckResult = {
        m3u_list_id: list.id,
        status: 'healthy',
        last_checked_at: new Date().toISOString(),
      };

      try {
        // Fazer requisição HEAD para verificar disponibilidade
        const response = await fetch(list.file_url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'SmartOne-M3U-Health-Checker/1.0',
          },
        });

        const responseTime = Date.now() - startTime;
        result.response_time_ms = responseTime;
        result.http_status_code = response.status;

        if (response.ok) {
          // Se resposta ok, fazer GET para contar canais
          try {
            const contentResponse = await fetch(list.file_url, {
              method: 'GET',
              headers: {
                'User-Agent': 'SmartOne-M3U-Health-Checker/1.0',
              },
            });

            if (contentResponse.ok) {
              const content = await contentResponse.text();
              const channelCount = (content.match(/#EXTINF/g) || []).length;
              result.channel_count = channelCount;

              if (channelCount === 0) {
                result.status = 'warning';
                result.error_message = 'Playlist vazia ou sem canais válidos';
                warningCount++;
              } else {
                result.status = 'healthy';
                healthyCount++;
              }
            }
          } catch (contentError) {
            console.error(`[M3U Health Check] Erro ao buscar conteúdo da lista ${list.name}:`, contentError);
            result.status = 'warning';
            result.error_message = 'URL acessível mas conteúdo não pôde ser lido';
            warningCount++;
          }
        } else {
          result.status = 'error';
          result.error_message = `HTTP ${response.status}: ${response.statusText}`;
          errorCount++;
          console.warn(`[M3U Health Check] Lista ${list.name} retornou status ${response.status}`);
        }
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        result.response_time_ms = responseTime;
        result.status = 'error';
        result.error_message = error.message || 'Erro ao acessar URL';
        errorCount++;
        console.error(`[M3U Health Check] Erro ao verificar lista ${list.name}:`, error);
      }

      results.push(result);

      // Salvar resultado no banco
      const { error: insertError } = await supabase
        .from('m3u_health_checks')
        .insert([result]);

      if (insertError) {
        console.error(`[M3U Health Check] Erro ao salvar resultado da lista ${list.name}:`, insertError);
      }

      // Se houver erro, criar evento de segurança para alertar admins
      if (result.status === 'error') {
        const { error: eventError } = await supabase
          .from('security_events')
          .insert([{
            event_type: 'm3u_health_check_failed',
            severity: 'warning',
            event_details: {
              m3u_list_id: list.id,
              m3u_list_name: list.name,
              error_message: result.error_message,
              http_status_code: result.http_status_code,
              timestamp: new Date().toISOString(),
            }
          }]);

        if (eventError) {
          console.error('[M3U Health Check] Erro ao criar evento de segurança:', eventError);
        }
      }
    }

    const stats = {
      total: lists.length,
      healthy: healthyCount,
      error: errorCount,
      warning: warningCount,
    };

    console.log('[M3U Health Check] Verificação concluída:', stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verificação concluída: ${lists.length} listas verificadas`,
        stats,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[M3U Health Check] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido ao executar health check' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
