import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, accessKeyId, secretAccessKey, bucketName } = await req.json();

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing R2 credentials');
    }

    // Testar listagem de objetos no bucket
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}?list-type=2&max-keys=1`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessKeyId}:${secretAccessKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`R2 API returned ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Verificar se XML contém tag de sucesso
    if (xmlText.includes('<ListBucketResult')) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Conexão bem-sucedida com bucket ${bucketName}`,
          bucketName
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      throw new Error('Invalid response from R2');
    }

  } catch (error: any) {
    console.error('[Test R2] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
