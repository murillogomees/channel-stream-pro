import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Iniciando regeneração diária de listas M3U...');

    // Buscar todas as listas ativas
    const { data: activeLists, error: listsError } = await supabase
      .from('m3u_custom_lists')
      .select('id, name, slug')
      .eq('status', 'active');

    if (listsError) {
      throw new Error(`Erro ao buscar listas: ${listsError.message}`);
    }

    if (!activeLists || activeLists.length === 0) {
      console.log('ℹ️ Nenhuma lista ativa encontrada');
      return new Response(
        JSON.stringify({ message: 'Nenhuma lista ativa para regenerar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 ${activeLists.length} lista(s) ativa(s) encontrada(s)`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Regenerar cada lista
    for (const list of activeLists) {
      try {
        console.log(`⚙️ Processando: ${list.name} (${list.slug})`);

        // Chamar função de geração
        const { data, error } = await supabase.functions.invoke('generate-m3u-file', {
          body: { customListId: list.id }
        });

        if (error) {
          throw new Error(error.message);
        }

        console.log(`✅ ${list.name}: ${data.channelsCount} canais, ${data.fileSize} bytes`);
        
        results.push({
          listId: list.id,
          listName: list.name,
          status: 'success',
          channelsCount: data.channelsCount,
          fileSize: data.fileSize
        });

        successCount++;

        // Aguardar 5 segundos entre gerações (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`❌ Erro ao processar ${list.name}:`, error.message);
        
        // Registrar log de erro
        await supabase
          .from('m3u_generation_logs')
          .insert({
            custom_list_id: list.id,
            channels_count: 0,
            generation_time_ms: 0,
            cdn_upload_status: 'failed',
            error_message: error.message
          });

        results.push({
          listId: list.id,
          listName: list.name,
          status: 'failed',
          error: error.message
        });

        failureCount++;
      }
    }

    const summary = {
      total: activeLists.length,
      success: successCount,
      failed: failureCount,
      results
    };

    console.log('📊 Resumo da regeneração:');
    console.log(`   Total: ${summary.total}`);
    console.log(`   Sucesso: ${summary.success}`);
    console.log(`   Falhas: ${summary.failed}`);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na regeneração diária:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
