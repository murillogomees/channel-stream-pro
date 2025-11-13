import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmartOneSyncRequest {
  mac: string;
  usuario: string;
  senha: string;
  clienteNome: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mac, usuario, senha, clienteNome }: SmartOneSyncRequest = await req.json();

    console.log('SmartOne sync request:', { mac, usuario, clienteNome });

    // Validar dados obrigatórios
    if (!mac || !usuario || !senha) {
      return new Response(
        JSON.stringify({ 
          error: 'Dados obrigatórios faltando: MAC, usuário e senha são necessários' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar configurações do SmartOne dos secrets
    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');

    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      console.error('SmartOne credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Configuração do SmartOne incompleta. Verifique as credenciais.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Construir URL M3U do cliente
    const m3uUrl = `http://dns.fastcdn.fun:80/get.php?username=${usuario}&password=${senha}&type=m3u_plus&output=ts`;

    // Chamar API do SmartOne
    console.log('Calling SmartOne API:', SMARTONE_API_BASE_URL);
    
    const smartoneResponse = await fetch(`${SMARTONE_API_BASE_URL}/playlist/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_api: SMARTONE_CLIENT_API,
        key_api: SMARTONE_KEY_API,
        mac: mac,
        m3u_url: m3uUrl,
        name: clienteNome || 'Cliente',
      }),
    });

    const responseText = await smartoneResponse.text();
    console.log('SmartOne response status:', smartoneResponse.status);
    console.log('SmartOne response body:', responseText);

    let smartoneData;
    try {
      smartoneData = JSON.parse(responseText);
    } catch {
      smartoneData = { raw: responseText };
    }

    if (!smartoneResponse.ok) {
      console.error('SmartOne API error:', smartoneData);
      return new Response(
        JSON.stringify({ 
          error: `Erro na API SmartOne: ${smartoneData.message || smartoneData.error || 'Erro desconhecido'}`,
          details: smartoneData 
        }),
        {
          status: smartoneResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('SmartOne sync successful:', smartoneData);

    return new Response(
      JSON.stringify({
        success: true,
        playlistId: smartoneData.id || smartoneData.playlist_id || 'N/A',
        data: smartoneData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in smartone-sync function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno ao processar sincronização',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
