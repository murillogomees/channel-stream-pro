import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyAffiliatePayload {
  affiliate_id: string;
  event_type: "new_referral" | "referral_confirmed" | "withdrawal_approved" | "withdrawal_rejected" | "tier_upgrade";
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { affiliate_id, event_type, data } = await req.json() as NotifyAffiliatePayload;

    console.log(`[notify-affiliate] Processing ${event_type} for affiliate ${affiliate_id}`);

    // Get affiliate details
    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliates")
      .select("name, phone, email")
      .eq("id", affiliate_id)
      .single();

    if (affiliateError || !affiliate) {
      throw new Error(`Affiliate not found: ${affiliateError?.message}`);
    }

    // Build message based on event type
    let message = "";
    switch (event_type) {
      case "new_referral":
        message = `🎉 *Nova Indicação!*\n\nOlá ${affiliate.name}!\n\nUma nova pessoa usou seu link de indicação.\n\n📋 Detalhes:\n- Cliente: ${data?.client_name || "Novo cliente"}\n- Plano: ${data?.plan || "N/A"}\n- Valor: R$ ${data?.value?.toFixed(2) || "0.00"}\n\nA comissão será confirmada após o pagamento.`;
        break;

      case "referral_confirmed":
        message = `✅ *Comissão Liberada!*\n\nOlá ${affiliate.name}!\n\nSua indicação foi confirmada e a comissão foi creditada.\n\n💰 Valor: R$ ${data?.commission?.toFixed(2) || "0.00"}\n📊 Saldo disponível: R$ ${data?.balance?.toFixed(2) || "0.00"}\n\nObrigado por fazer parte do nosso programa!`;
        break;

      case "withdrawal_approved":
        message = `💸 *Saque Aprovado!*\n\nOlá ${affiliate.name}!\n\nSeu saque foi processado com sucesso.\n\n💰 Valor: R$ ${data?.amount?.toFixed(2) || "0.00"}\n🏦 PIX: ${data?.pix_key || "N/A"}\n\nO valor será transferido em até 24h úteis.`;
        break;

      case "withdrawal_rejected":
        message = `❌ *Saque Não Aprovado*\n\nOlá ${affiliate.name}!\n\nInfelizmente seu saque não pôde ser processado.\n\n💰 Valor: R$ ${data?.amount?.toFixed(2) || "0.00"}\n📝 Motivo: ${data?.reason || "Entre em contato com o suporte"}\n\nSe tiver dúvidas, entre em contato.`;
        break;

      case "tier_upgrade":
        message = `🏆 *Parabéns! Novo Nível!*\n\nOlá ${affiliate.name}!\n\nVocê alcançou um novo nível no programa de afiliados!\n\n⬆️ Novo tier: ${data?.tier_name || "N/A"}\n💎 Comissão: ${data?.commission}%\n\nContinue assim!`;
        break;
    }

    // Send WhatsApp notification
    if (affiliate.phone && message) {
      const appKey = Deno.env.get("WHATSAPP_APPKEY");
      const authKey = Deno.env.get("WHATSAPP_AUTHKEY");

      if (appKey && authKey) {
        const cleanPhone = affiliate.phone.replace(/\D/g, "");
        
        try {
          const response = await fetch(
            `https://api.ultramsg.com/${appKey}/messages/chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                token: authKey,
                to: `55${cleanPhone}`,
                body: message,
              }),
            }
          );

          const result = await response.json();
          console.log(`[notify-affiliate] WhatsApp sent:`, result);
        } catch (whatsappError) {
          console.error("[notify-affiliate] WhatsApp error:", whatsappError);
        }
      }
    }

    // Log the notification
    await supabase.from("activity_logs").insert({
      action_type: "affiliate_notification",
      action_description: `Notificação ${event_type} enviada para afiliado ${affiliate.name}`,
      entity_type: "affiliate",
      entity_id: affiliate_id,
      metadata: { event_type, data },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-affiliate] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
