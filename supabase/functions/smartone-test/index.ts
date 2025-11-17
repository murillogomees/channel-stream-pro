import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const body = await req.json();
    const { action, playlist, playlistId } = body;

    console.log('SmartOne Test - Action:', action);

    // Criar playlist
    if (action === 'create') {
      const { nome, mac, usuario, senha, descricao } = playlist;

      // Chamar API do SmartOne para criar playlist
      const smartoneUrl = `${smartoneBaseUrl}/plugin/smart_one/client_main/add_playlist/`;
      
      console.log('Creating playlist at:', smartoneUrl);
      
      const response = await fetch(smartoneUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_api: smartoneClientApi,
          key_api: smartoneKeyApi,
          name: nome,
          mac_address: mac,
          username: usuario,
          password: senha,
          description: descricao || '',
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('SmartOne API error:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.message || 'Erro ao criar playlist no SmartOne',
            details: responseData,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Atualizar playlist
    if (action === 'update') {
      const { nome, mac, usuario, senha, descricao } = playlist;

      const smartoneUrl = `${smartoneBaseUrl}/plugin/smart_one/client_main/update_playlist/${playlistId}/`;
      
      console.log('Updating playlist at:', smartoneUrl);

      const response = await fetch(smartoneUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_api: smartoneClientApi,
          key_api: smartoneKeyApi,
          name: nome,
          mac_address: mac,
          username: usuario,
          password: senha,
          description: descricao || '',
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('SmartOne API error:', responseData);
        return new Response(
          JSON.stringify({ 
            error: responseData.message || 'Erro ao atualizar playlist no SmartOne',
            details: responseData,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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