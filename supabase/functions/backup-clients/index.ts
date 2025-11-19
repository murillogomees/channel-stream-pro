import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando backup automático de clientes...');

    // Buscar todos os clientes
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('*')
      .order('data_cadastro', { ascending: false });

    if (clientesError) {
      console.error('❌ Erro ao buscar clientes:', clientesError);
      throw clientesError;
    }

    console.log(`✅ ${clientes?.length || 0} clientes encontrados`);

    // Buscar M3U lists atribuídas
    const { data: m3uAssignments, error: m3uError } = await supabase
      .from('client_m3u_lists')
      .select(`
        client_id,
        is_active,
        assigned_at,
        m3u_lists (
          name,
          file_url
        )
      `);

    if (m3uError) {
      console.error('❌ Erro ao buscar M3U assignments:', m3uError);
    }

    // Criar mapa de M3U lists por cliente
    const m3uByClient = new Map();
    m3uAssignments?.forEach((assignment: any) => {
      if (!m3uByClient.has(assignment.client_id)) {
        m3uByClient.set(assignment.client_id, []);
      }
      m3uByClient.get(assignment.client_id).push({
        name: assignment.m3u_lists.name,
        url: assignment.m3u_lists.file_url,
        is_active: assignment.is_active,
        assigned_at: assignment.assigned_at,
      });
    });

    // Enriquecer dados dos clientes com M3U lists
    const enrichedClientes = clientes?.map(cliente => ({
      ...cliente,
      m3u_lists: m3uByClient.get(cliente.id) || [],
    }));

    // Criar backup em formato JSON
    const backup = {
      timestamp: new Date().toISOString(),
      total_clientes: enrichedClientes?.length || 0,
      clientes: enrichedClientes,
      metadata: {
        backup_date: new Date().toISOString(),
        backup_version: '1.0',
        total_active: enrichedClientes?.filter(c => c.cliente_ativo).length || 0,
        total_inactive: enrichedClientes?.filter(c => !c.cliente_ativo).length || 0,
        by_situation: {
          testando: enrichedClientes?.filter(c => c.situacao === 'Testando').length || 0,
          ativo: enrichedClientes?.filter(c => c.situacao === 'Ativo').length || 0,
          devendo: enrichedClientes?.filter(c => c.situacao === 'Devendo').length || 0,
          inativo: enrichedClientes?.filter(c => c.situacao === 'Inativo').length || 0,
          lead: enrichedClientes?.filter(c => c.situacao === 'Lead').length || 0,
        },
      },
    };

    console.log('✅ Backup criado com sucesso');
    console.log(`📊 Total de clientes: ${backup.total_clientes}`);
    console.log(`📊 Ativos: ${backup.metadata.total_active}, Inativos: ${backup.metadata.total_inactive}`);

    return new Response(
      JSON.stringify({
        success: true,
        backup,
        message: 'Backup criado com sucesso',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro no backup:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
