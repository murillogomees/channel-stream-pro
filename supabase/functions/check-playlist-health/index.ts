import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaylistHealthCheck {
  client_id: string;
  playlist_id: string;
  m3u_url: string;
  status: 'pending' | 'active' | 'inactive' | 'error';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
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

    // Verificar autenticação (apenas para chamadas manuais)
    const authHeader = req.headers.get('Authorization');
    const isCronJob = req.headers.get('x-cron-job') === 'true';
    
    if (!isCronJob && !authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Iniciando verificação de saúde das playlists...');

    // Buscar todos os clientes com playlists ativas no SmartOne
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, smartone_playlist_id, usuario_m3u, senha_m3u')
      .eq('smartone_status', 'criado')
      .not('smartone_playlist_id', 'is', null);

    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar clientes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clientes || clientes.length === 0) {
      console.log('Nenhum cliente com playlist ativa encontrado');
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum cliente com playlist ativa', 
          checked: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${clientes.length} clientes com playlists`);

    const results: PlaylistHealthCheck[] = [];
    const smartoneBaseUrl = Deno.env.get('SMARTONE_API_BASE_URL');

    // Verificar cada playlist
    for (const cliente of clientes) {
      // Construir URL M3U do SmartOne
      const m3uUrl = `${smartoneBaseUrl}/get.php?username=${cliente.usuario_m3u}&password=${cliente.senha_m3u}&type=m3u_plus&output=ts`;
      
      console.log(`Verificando playlist do cliente ${cliente.nome} (${cliente.id})`);

      const startTime = Date.now();
      let status: 'active' | 'inactive' | 'error' = 'error';
      let httpStatusCode: number | undefined;
      let errorMessage: string | undefined;

      try {
        // Fazer requisição HEAD para verificar se a URL está ativa
        const response = await fetch(m3uUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000), // 10 segundos timeout
        });

        const responseTime = Date.now() - startTime;
        httpStatusCode = response.status;

        if (response.ok) {
          status = 'active';
          console.log(`✓ Playlist ativa (${responseTime}ms)`);
        } else {
          status = 'inactive';
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          console.log(`✗ Playlist inativa: ${errorMessage}`);
        }

        results.push({
          client_id: cliente.id,
          playlist_id: cliente.smartone_playlist_id,
          m3u_url: m3uUrl,
          status,
          response_time_ms: responseTime,
          http_status_code: httpStatusCode,
          error_message: errorMessage,
        });

      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        status = 'error';
        errorMessage = error.message || 'Erro desconhecido';
        
        console.log(`✗ Erro ao verificar playlist: ${errorMessage}`);

        results.push({
          client_id: cliente.id,
          playlist_id: cliente.smartone_playlist_id,
          m3u_url: m3uUrl,
          status: 'error',
          response_time_ms: responseTime,
          error_message: errorMessage,
        });
      }
    }

    // Salvar resultados no banco
    console.log('Salvando resultados no banco de dados...');
    
    const { error: insertError } = await supabase
      .from('playlist_health_checks')
      .insert(results);

    if (insertError) {
      console.error('Erro ao salvar health checks:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao salvar resultados',
          details: insertError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular estatísticas
    const stats = {
      total: results.length,
      active: results.filter(r => r.status === 'active').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      error: results.filter(r => r.status === 'error').length,
      avgResponseTime: Math.round(
        results
          .filter(r => r.response_time_ms)
          .reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / results.length
      ),
    };

    console.log('Verificação concluída:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verificação de saúde concluída',
        stats,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na função de health check:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao executar verificação de saúde',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
