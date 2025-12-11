import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRule {
  id: string;
  name: string;
  trigger_type: string;
  template_key: string | null;
  message_template: string | null;
  is_active: boolean;
  delay_hours: number | null;
  conditions: Record<string, any>;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string;
  contact_phone: string | null;
  plano: string | null;
  data_vencimento: string | null;
  data_contratacao: string | null;
  situacao: string | null;
  cliente_ativo: boolean | null;
  valor_pago: number | null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const whatsappAppKey = Deno.env.get("WHATSAPP_APPKEY")!;
const whatsappAuthKey = Deno.env.get("WHATSAPP_AUTHKEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        "appkey": whatsappAppKey,
        "authkey": whatsappAuthKey,
      },
      body: JSON.stringify({ to: phone, message }),
    });

    const result = await response.json();
    console.log(`WhatsApp sent to ${phone}: ${result.message_status}`);
    return result.message_status === "success";
  } catch (error) {
    console.error(`Error sending WhatsApp to ${phone}:`, error);
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
function replaceVariables(template: string, profile: Profile, extraVars: Record<string, string> = {}): string {
  const vars: Record<string, string> = {
    nome: profile.nome || "Cliente",
    email: profile.email,
    telefone: profile.contact_phone || "",
    plano: profile.plano || "Mensal",
    dataVencimento: profile.data_vencimento
      ? new Date(profile.data_vencimento).toLocaleDateString("pt-BR")
      : "",
    dataContratacao: profile.data_contratacao
      ? new Date(profile.data_contratacao).toLocaleDateString("pt-BR")
      : "",
    valor: profile.valor_pago?.toFixed(2) || "0.00",
    situacao: profile.situacao || "",
    linkPagamento: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/checkout`,
    whatsappSuporte: "5561996975924",
    empresaNome: "IPTV LINK",
    ...extraVars,
  };

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
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

// Notify admins about sent notification
async function notifyAdmins(
  clientName: string,
  clientPhone: string,
  triggerType: string,
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

✅ Notificação automática processada com sucesso.`;

  for (const adminPhone of adminPhones) {
    await sendWhatsAppMessage(adminPhone, message);
  }
}

// Get template content
async function getTemplateContent(templateKey: string): Promise<string | null> {
  const { data } = await supabase
    .from("notification_templates")
    .select("template_content")
    .eq("template_key", templateKey)
    .eq("is_active", true)
    .maybeSingle();

  return data?.template_content || null;
}

// Process due date notifications
async function processDueDateNotifications(rules: NotificationRule[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rule of rules) {
    const daysOffset = rule.delay_hours || 0;
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    console.log(`Processing ${rule.name}: looking for due date ${targetDateStr}`);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("data_vencimento", targetDateStr)
      .eq("cliente_ativo", true);

    if (!profiles || profiles.length === 0) {
      console.log(`No profiles found for ${rule.name}`);
      continue;
    }

    console.log(`Found ${profiles.length} profiles for ${rule.name}`);

    const templateContent = rule.template_key 
      ? await getTemplateContent(rule.template_key)
      : rule.message_template;

    if (!templateContent) {
      console.log(`No template content for ${rule.name}`);
      continue;
    }

    for (const profile of profiles) {
      if (!profile.contact_phone) continue;

      const message = replaceVariables(templateContent, profile);
      const success = await sendWhatsAppMessage(profile.contact_phone, message);

      await logNotification(
        profile.id,
        profile.contact_phone,
        rule.template_key || rule.trigger_type,
        message,
        success ? "sent" : "failed",
        success ? undefined : "Failed to send"
      );

      if (success) {
        await notifyAdmins(
          profile.nome || "Cliente",
          profile.contact_phone,
          rule.trigger_type,
          rule.name
        );
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Process trial expiration notifications
async function processTrialNotifications(rules: NotificationRule[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rule of rules) {
    const daysOffset = rule.delay_hours || 0;
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("data_vencimento", targetDateStr)
      .eq("situacao", "Testando");

    if (!profiles || profiles.length === 0) continue;

    const templateContent = rule.template_key
      ? await getTemplateContent(rule.template_key)
      : rule.message_template;

    if (!templateContent) continue;

    for (const profile of profiles) {
      if (!profile.contact_phone) continue;

      const message = replaceVariables(templateContent, profile);
      const success = await sendWhatsAppMessage(profile.contact_phone, message);

      await logNotification(
        profile.id,
        profile.contact_phone,
        rule.template_key || rule.trigger_type,
        message,
        success ? "sent" : "failed"
      );

      if (success) {
        await notifyAdmins(
          profile.nome || "Cliente",
          profile.contact_phone,
          rule.trigger_type,
          rule.name
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Process subscription expiration
async function processExpiredSubscriptions(rules: NotificationRule[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rule of rules) {
    const daysOffset = Math.abs(rule.delay_hours || 0);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - daysOffset);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("data_vencimento", targetDateStr)
      .neq("situacao", "Testando");

    if (!profiles || profiles.length === 0) continue;

    const templateContent = rule.template_key
      ? await getTemplateContent(rule.template_key)
      : rule.message_template;

    if (!templateContent) continue;

    for (const profile of profiles) {
      if (!profile.contact_phone) continue;

      const message = replaceVariables(templateContent, profile);
      const success = await sendWhatsAppMessage(profile.contact_phone, message);

      await logNotification(
        profile.id,
        profile.contact_phone,
        rule.template_key || rule.trigger_type,
        message,
        success ? "sent" : "failed"
      );

      if (success) {
        await notifyAdmins(
          profile.nome || "Cliente",
          profile.contact_phone,
          rule.trigger_type,
          rule.name
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting automatic notification processing...");

    // Get all active notification rules
    const { data: rules, error } = await supabase
      .from("auto_notifications")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching rules:", error);
      throw error;
    }

    if (!rules || rules.length === 0) {
      console.log("No active notification rules found");
      return new Response(
        JSON.stringify({ success: true, message: "No active rules", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${rules.length} active notification rules`);

    // Group rules by trigger type
    const dueDateRules = rules.filter((r) =>
      ["payment_due", "expiration_reminder"].includes(r.trigger_type) && 
      (r.conditions as any)?.trigger_condition?.includes("days_before")
    );
    
    const trialRules = rules.filter((r) =>
      ["trial_expiring", "trial_ending"].includes(r.trigger_type)
    );
    
    const expiredRules = rules.filter((r) =>
      ["subscription_expired", "expiration_after"].includes(r.trigger_type) ||
      ((r.conditions as any)?.trigger_condition?.includes("days_after"))
    );

    // Process each category
    await processDueDateNotifications(dueDateRules);
    await processTrialNotifications(trialRules);
    await processExpiredSubscriptions(expiredRules);

    console.log("Automatic notification processing completed");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notifications processed",
        rulesProcessed: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-auto-notifications:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
