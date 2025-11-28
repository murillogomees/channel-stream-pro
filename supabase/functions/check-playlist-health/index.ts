import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlaylistHealthCheck {
  m3u_list_id: string;
  list_name: string;
  m3u_url: string;
  status: 'active' | 'inactive' | 'error';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  channel_count?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Iniciando verificação de saúde das listas M3U...');

    // Buscar todas as listas M3U ativas
    const { data: m3uLists, error: listsError } = await supabase
      .from('m3u_lists')
      .select('id, name, file_url, status')
      .eq('status', 'active');

    if (listsError) {
      console.error('❌ Erro ao buscar listas M3U:', listsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar listas M3U' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!m3uLists || m3uLists.length === 0) {
      console.log('⚠️ Nenhuma lista M3U ativa encontrada');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Nenhuma lista M3U ativa encontrada', 
          stats: { total: 0, active: 0, inactive: 0, error: 0, avgResponseTime: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontradas ${m3uLists.length} listas M3U para verificar`);

    const results: PlaylistHealthCheck[] = [];

    // Verificar cada lista M3U
    for (const list of m3uLists) {
      console.log(`\n🔄 Verificando lista: ${list.name}`);
      console.log(`   URL: ${list.file_url}`);

      const startTime = Date.now();
      let status: 'active' | 'inactive' | 'error' = 'error';
      let httpStatusCode: number | undefined;
      let errorMessage: string | undefined;
      let channelCount: number | undefined;

      try {
        // Primeiro fazer HEAD request para verificar se URL está acessível
        const headResponse = await fetch(list.file_url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(15000), // 15 segundos timeout
        });

        httpStatusCode = headResponse.status;

        if (headResponse.ok) {
          // Se HEAD ok, fazer GET para contar canais
          try {
            const getResponse = await fetch(list.file_url, {
              method: 'GET',
              signal: AbortSignal.timeout(30000), // 30 segundos timeout para GET
            });

            if (getResponse.ok) {
              const content = await getResponse.text();
              // Contar linhas #EXTINF para saber quantos canais
              const extinfMatches = content.match(/#EXTINF/gi);
              channelCount = extinfMatches ? extinfMatches.length : 0;
              
              status = 'active';
              console.log(`   ✅ Lista ativa - ${channelCount} canais encontrados`);
            } else {
              status = 'inactive';
              errorMessage = `GET falhou: HTTP ${getResponse.status}`;
              console.log(`   ⚠️ Lista inativa: ${errorMessage}`);
            }
          } catch (getError: any) {
            // HEAD ok mas GET falhou - ainda consideramos ativa mas sem contagem
            status = 'active';
            channelCount = undefined;
            console.log(`   ✅ Lista acessível (não foi possível contar canais)`);
          }
        } else {
          status = 'inactive';
          errorMessage = `HTTP ${headResponse.status}: ${headResponse.statusText}`;
          console.log(`   ⚠️ Lista inativa: ${errorMessage}`);
        }

      } catch (error: any) {
        status = 'error';
        errorMessage = error.message || 'Erro desconhecido';
        
        if (error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
          errorMessage = 'Timeout ao conectar';
        } else if (errorMessage.includes('fetch')) {
          errorMessage = 'Erro de conexão';
        }
        
        console.log(`   ❌ Erro: ${errorMessage}`);
      }

      const responseTime = Date.now() - startTime;

      results.push({
        m3u_list_id: list.id,
        list_name: list.name,
        m3u_url: list.file_url,
        status,
        response_time_ms: responseTime,
        http_status_code: httpStatusCode,
        error_message: errorMessage,
        channel_count: channelCount,
      });
    }

    // Salvar resultados no banco - primeiro limpar verificações antigas desta execução
    console.log('\n💾 Salvando resultados no banco de dados...');
    
    // Inserir novos resultados na tabela playlist_health_checks
    const healthChecks = results.map(r => ({
      client_id: r.m3u_list_id, // Usando client_id para armazenar m3u_list_id
      playlist_id: r.m3u_list_id,
      m3u_url: r.m3u_url,
      status: r.status,
      response_time_ms: r.response_time_ms,
      http_status_code: r.http_status_code,
      error_message: r.error_message,
      last_checked_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('playlist_health_checks')
      .insert(healthChecks);

    if (insertError) {
      console.error('❌ Erro ao salvar health checks:', insertError);
      // Continua mesmo com erro, retorna os resultados
    } else {
      console.log('✅ Resultados salvos com sucesso');
    }

    // Calcular estatísticas
    const stats = {
      total: results.length,
      active: results.filter(r => r.status === 'active').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      error: results.filter(r => r.status === 'error').length,
      avgResponseTime: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / results.length)
        : 0,
      totalChannels: results.reduce((sum, r) => sum + (r.channel_count || 0), 0),
    };

    console.log('\n📊 Estatísticas da verificação:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Ativas: ${stats.active}`);
    console.log(`   Inativas: ${stats.inactive}`);
    console.log(`   Com erro: ${stats.error}`);
    console.log(`   Tempo médio: ${stats.avgResponseTime}ms`);
    console.log(`   Total de canais: ${stats.totalChannels}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída: ${stats.active}/${stats.total} listas ativas`,
        stats,
        results: results.map(r => ({
          name: r.list_name,
          status: r.status,
          responseTime: r.response_time_ms,
          channels: r.channel_count,
          error: r.error_message,
        })),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na função de health check:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro ao executar verificação de saúde',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
