import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountId = Deno.env.get('R2_ACCOUNT_ID') || '';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';
    const publicDomain = Deno.env.get('R2_PUBLIC_DOMAIN') || '';

    // Função para mascarar valor mantendo primeiros e últimos 4 caracteres
    const maskValue = (value: string): string => {
      if (!value || value.length < 8) {
        return value ? '••••••••' : '';
      }
      const first = value.substring(0, 4);
      const last = value.substring(value.length - 4);
      const masked = '•'.repeat(Math.min(value.length - 8, 20));
      return `${first}${masked}${last}`;
    };

    return new Response(JSON.stringify({
      success: true,
      config: {
        accountId: {
          value: accountId,
          masked: maskValue(accountId),
          configured: !!accountId
        },
        accessKeyId: {
          value: accessKeyId,
          masked: maskValue(accessKeyId),
          configured: !!accessKeyId
        },
        secretAccessKey: {
          value: secretAccessKey,
          masked: maskValue(secretAccessKey),
          configured: !!secretAccessKey
        },
        bucketName: {
          value: bucketName,
          masked: bucketName,
          configured: !!bucketName
        },
        publicDomain: {
          value: publicDomain,
          masked: publicDomain,
          configured: !!publicDomain
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error getting R2 config:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
