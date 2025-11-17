import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validação de MAC Address
const macAddressRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^[0-9A-Fa-f]{12}$/;

function validateMacAddress(mac: string): { valid: boolean; error?: string } {
  if (!mac || typeof mac !== 'string') {
    return { valid: false, error: 'MAC Address é obrigatório' };
  }

  const trimmedMac = mac.trim();
  if (!macAddressRegex.test(trimmedMac)) {
    return { 
      valid: false, 
      error: 'MAC Address inválido. Use o formato: 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E ou 001A2B3C4D5E' 
    };
  }

  return { valid: true };
}

function normalizeMacAddress(mac: string): string {
  let normalized = mac.trim().toUpperCase();
  
  // Se não tem separadores, adiciona :
  if (normalized.length === 12 && !normalized.includes(':') && !normalized.includes('-')) {
    normalized = normalized.match(/.{1,2}/g)?.join(':') || normalized;
  }
  
  // Converte - para :
  normalized = normalized.replace(/-/g, ':');
  
  return normalized;
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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter configurações do SmartOne do ambiente
    const smartoneBaseUrl = Deno.env.get('SMARTONE_API_BASE_URL');
    const smartoneClientApi = Deno.env.get('SMARTONE_CLIENT_API');
    const smartoneKeyApi = Deno.env.get('SMARTONE_KEY_API');

    if (!smartoneBaseUrl || !smartoneClientApi || !smartoneKeyApi) {
      return new Response(
        JSON.stringify({ error: 'Configurações SmartOne não encontradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { action, playlist, playlistId } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required (create, update, delete)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Para create e update, validar e normalizar MAC Address
    if ((action === 'create' || action === 'update') && playlist) {
      const macValidation = validateMacAddress(playlist.mac);
      if (!macValidation.valid) {
        return new Response(
          JSON.stringify({ error: macValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Normalizar MAC antes de enviar
      playlist.mac = normalizeMacAddress(playlist.mac);
      
      // Validar URL do M3U
      if (!playlist.m3u_url) {
        return new Response(
          JSON.stringify({ error: 'URL do M3U é obrigatória' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create playlist (xtream_playlist type)
    if (action === 'create') {
      console.log('Creating xtream playlist:', playlist);

      const smartoneResponse = await fetch(
        `${smartoneBaseUrl}/plugin/smart_one/client_main/add_playlist/#xtream_playlist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client_api': smartoneClientApi,
            'key_api': smartoneKeyApi,
          },
          body: JSON.stringify({
            nome: playlist.nome,
            mac: playlist.mac,
            m3u_url: playlist.m3u_url,
            descricao: playlist.descricao || '',
          }),
        }
      );

      const responseData = await smartoneResponse.json();
      
      if (!smartoneResponse.ok) {
        console.error('SmartOne API error:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.message || 'Erro ao criar playlist no SmartOne',
            details: responseData,
          }),
          { status: smartoneResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          playlistId: responseData.id || responseData.playlist_id,
          m3uUrl: responseData.m3u_url,
          message: 'Playlist criada com sucesso',
          data: responseData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update playlist (xtream_playlist type)
    if (action === 'update') {
      console.log('Updating xtream playlist:', playlistId, playlist);

      const smartoneResponse = await fetch(
        `${smartoneBaseUrl}/plugin/smart_one/client_main/update_playlist/${playlistId}/#xtream_playlist`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'client_api': smartoneClientApi,
            'key_api': smartoneKeyApi,
          },
          body: JSON.stringify({
            nome: playlist.nome,
            mac: playlist.mac,
            m3u_url: playlist.m3u_url,
            descricao: playlist.descricao || '',
          }),
        }
      );

      const responseData = await smartoneResponse.json();

      if (!smartoneResponse.ok) {
        console.error('SmartOne API error:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.message || 'Erro ao atualizar playlist no SmartOne',
            details: responseData,
          }),
          { status: smartoneResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          playlistId,
          m3uUrl: responseData.m3u_url,
          message: 'Playlist atualizada com sucesso',
          data: responseData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deletar playlist
    if (action === 'delete') {
      const smartoneUrl = `${smartoneBaseUrl}/plugin/smart_one/client_main/delete_playlist/${playlistId}/`;
      
      console.log('Deleting playlist at:', smartoneUrl);

      const response = await fetch(smartoneUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_api: smartoneClientApi,
          key_api: smartoneKeyApi,
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        console.error('SmartOne API error:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.message || 'Erro ao deletar playlist no SmartOne',
            details: responseData,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Playlist deletada com sucesso',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smartone-test function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});