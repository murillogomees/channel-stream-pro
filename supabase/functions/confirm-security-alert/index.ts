import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmRequest {
  deliveryId: string;
  adminPhoneId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { deliveryId, adminPhoneId }: ConfirmRequest = await req.json();

    if (!deliveryId || !adminPhoneId) {
      return new Response(
        JSON.stringify({ error: 'deliveryId e adminPhoneId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a entrega existe e pertence ao admin
    const { data: delivery, error: fetchError } = await supabase
      .from('security_alert_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('admin_phone_id', adminPhoneId)
      .single();

    if (fetchError || !delivery) {
      return new Response(
        JSON.stringify({ error: 'Entrega não encontrada ou não autorizada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Confirmar recebimento
    const { error: updateError } = await supabase
      .from('security_alert_deliveries')
      .update({
        confirmed_at: new Date().toISOString(),
        delivery_status: 'confirmed'
      })
      .eq('id', deliveryId);

    if (updateError) {
      console.error('Erro ao confirmar entrega:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar entrega' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ConfirmAlert] Alerta confirmado: ${deliveryId} por admin ${adminPhoneId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Alerta confirmado com sucesso',
        confirmedAt: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função confirm-security-alert:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});