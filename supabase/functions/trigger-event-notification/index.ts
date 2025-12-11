import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappAppKey = Deno.env.get("WHATSAPP_APPKEY")!;
const whatsappAuthKey = Deno.env.get("WHATSAPP_AUTHKEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface EventPayload {
  event_type: string;
  user_id: string;
  extra_data?: Record<string, any>;
}

// Send WhatsApp message
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    if (!whatsappAppKey || !whatsappAuthKey) {
      console.log("WhatsApp credentials not configured");
      return false;
    }

    const response = await fetch("https://api.botbot.app/v1/sendmessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appkey: whatsappAppKey,
        authkey: whatsappAuthKey,
      },
      body: JSON.stringify({ to: phone, message }),
    });

    const result = await response.json();
    return result.message_status === "success";
  } catch (error) {
    console.error(`Error sending WhatsApp:`, error);
    return false;
  }
}

// Get admin/master phones
async function getAdminPhones(): Promise<string[]> {
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "master"]);

  if (!adminRoles || adminRoles.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("contact_phone")
    .in("id", adminRoles.map((r) => r.user_id))
    .not("contact_phone", "is", null);

  return profiles?.map((p) => p.contact_phone).filter(Boolean) || [];
}

// Replace template variables
function replaceVariables(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return result;
}

// Notify admins about sent notification
async function notifyAdmins(
  clientName: string,
  clientPhone: string,
  eventType: string,
  ruleName: string
) {
  const adminPhones = await getAdminPhones();
  if (adminPhones.length === 0) return;

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const message = `📬 *Notificação Enviada*

👤 Cliente: ${clientName}
📱 Telefone: ${clientPhone}
📋 Tipo: ${ruleName}
🕐 Horário: ${now}

✅ Notificação automática processada.`;

  for (const adminPhone of adminPhones) {
    await sendWhatsAppMessage(adminPhone, message);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Log notification
async function logNotification(
  recipientId: string,
  recipientPhone: string,
  templateKey: string,
  messageContent: string,
  status: "pending" | "sent" | "failed",
  errorMessage?: string
) {
  await supabase.from("notification_logs").insert({
    recipient_id: recipientId,
    recipient_phone: recipientPhone,
    template_key: templateKey,
    message_content: messageContent,
    status,
    error_message: errorMessage,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EventPayload = await req.json();
    const { event_type, user_id, extra_data } = payload;

    console.log(`Processing event: ${event_type} for user: ${user_id}`);

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.contact_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "User has no phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active rules for this event type
    const { data: rules } = await supabase
      .from("auto_notifications")
      .select("*")
      .eq("trigger_type", event_type)
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      console.log(`No active rules for event: ${event_type}`);
      return new Response(
        JSON.stringify({ success: true, message: "No rules for this event", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const rule of rules) {
      // Get template content
      let templateContent: string | null = null;

      if (rule.template_key) {
        const { data: template } = await supabase
          .from("notification_templates")
          .select("template_content")
          .eq("template_key", rule.template_key)
          .eq("is_active", true)
          .maybeSingle();
        
        templateContent = template?.template_content;
      }

      if (!templateContent) {
        templateContent = rule.message_template;
      }

      if (!templateContent) {
        console.log(`No template content for rule: ${rule.name}`);
        continue;
      }

      // Prepare variables
      const vars: Record<string, string> = {
        nome: profile.nome || "Cliente",
        email: profile.email,
        telefone: profile.contact_phone,
        plano: profile.plano || "Mensal",
        dataVencimento: profile.data_vencimento
          ? new Date(profile.data_vencimento).toLocaleDateString("pt-BR")
          : "",
        dataContratacao: profile.data_contratacao
          ? new Date(profile.data_contratacao).toLocaleDateString("pt-BR")
          : "",
        valor: profile.valor_pago?.toFixed(2) || "0.00",
        linkPagamento: `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/checkout`,
        whatsappSuporte: "5561996975924",
        empresaNome: "IPTV LINK",
        ...extra_data,
      };

      const message = replaceVariables(templateContent, vars);

      // Send notification
      const success = await sendWhatsAppMessage(profile.contact_phone, message);

      await logNotification(
        profile.id,
        profile.contact_phone,
        rule.template_key || rule.trigger_type,
        message,
        success ? "sent" : "failed"
      );

      if (success) {
        sentCount++;
        // Notify admins
        await notifyAdmins(
          profile.nome || "Cliente",
          profile.contact_phone,
          event_type,
          rule.name
        );
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Event ${event_type} processed: ${sentCount} notifications sent`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in trigger-event-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
