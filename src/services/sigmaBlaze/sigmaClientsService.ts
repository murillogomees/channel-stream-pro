import { supabase } from "@/integrations/supabase/client";

export interface SigmaClient {
  id: string;
  sigma_id: string | null;
  name: string;
  whatsapp: string;
  email: string | null;
  plan_name: string;
  plan_value: number | null;
  expiration_date: string;
  last_login: string | null;
  last_payment_date: string | null;
  last_reminder_sent: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SigmaReminderTemplate {
  id: string;
  name: string;
  message: string;
  is_default: boolean;
  created_at: string;
}

export interface SigmaReminderLog {
  id: string;
  client_id: string;
  template_id: string | null;
  message_sent: string;
  whatsapp_number: string;
  status: string;
  error_message: string | null;
  sent_by: string | null;
  created_at: string;
}

export interface ClientFilters {
  search?: string;
  riskLevel?: 'all' | 'low' | 'medium' | 'high';
  expirationStatus?: 'all' | 'ok' | 'warning' | 'critical';
  page?: number;
  pageSize?: number;
}

// Risk score calculation
export function calculateRiskScore(client: SigmaClient): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();
  const expDate = new Date(client.expiration_date);
  const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // +40: expired or <= 2 days
  if (daysUntilExpiry <= 2) {
    score += 40;
    reasons.push(daysUntilExpiry <= 0 ? 'Plano expirado' : `Vence em ${daysUntilExpiry} dia(s)`);
  }

  // +25: last login > 7 days
  if (client.last_login) {
    const daysSinceLogin = Math.ceil((now.getTime() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLogin > 7) {
      score += 25;
      reasons.push(`Último login há ${daysSinceLogin} dias`);
    }
  } else {
    score += 25;
    reasons.push('Nunca fez login');
  }

  // +15: last payment near previous expiration
  if (client.last_payment_date && client.last_reminder_sent) {
    score += 15;
    reasons.push('Pagamento atrasado no ciclo anterior');
  }

  // +10: received reminder and didn't renew
  if (client.last_reminder_sent && daysUntilExpiry <= 5) {
    score += 10;
    reasons.push('Recebeu lembrete sem renovar');
  }

  // +10: new client (< 7 days)
  const daysSinceCreation = Math.ceil((now.getTime() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreation < 7) {
    score += 10;
    reasons.push('Cliente novo (< 7 dias)');
  }

  return { score: Math.min(score, 100), reasons };
}

export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
}

export function getExpirationStatus(expirationDate: string): { color: 'green' | 'yellow' | 'red'; days: number; label: string } {
  const now = new Date();
  const expDate = new Date(expirationDate);
  const days = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return { color: 'red', days, label: `Expirado há ${Math.abs(days)} dia(s)` };
  if (days <= 2) return { color: 'red', days, label: `Vence em ${days} dia(s)` };
  if (days <= 5) return { color: 'yellow', days, label: `Vence em ${days} dias` };
  return { color: 'green', days, label: `Vence em ${days} dias` };
}

// CRUD
export async function getClients(filters: ClientFilters = {}): Promise<{ data: SigmaClient[]; count: number }> {
  const { page = 1, pageSize = 20, search, riskLevel, expirationStatus } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('sigma_blaze_clients')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('expiration_date', { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,whatsapp.ilike.%${search}%`);
  }

  if (expirationStatus && expirationStatus !== 'all') {
    const now = new Date().toISOString();
    const twoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    if (expirationStatus === 'critical') {
      query = query.lte('expiration_date', twoDays);
    } else if (expirationStatus === 'warning') {
      query = query.gt('expiration_date', twoDays).lte('expiration_date', fiveDays);
    } else if (expirationStatus === 'ok') {
      query = query.gt('expiration_date', fiveDays);
    }
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as SigmaClient[], count: count || 0 };
}

export async function createClient(client: Partial<SigmaClient>): Promise<SigmaClient> {
  const { data, error } = await supabase
    .from('sigma_blaze_clients')
    .insert({
      name: client.name!,
      whatsapp: client.whatsapp!,
      email: client.email,
      plan_name: client.plan_name || 'Blaze IPTV',
      expiration_date: client.expiration_date!,
      sigma_id: client.sigma_id,
      last_login: client.last_login,
      last_payment_date: client.last_payment_date,
      notes: client.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SigmaClient;
}

export async function updateClient(id: string, updates: Partial<SigmaClient>): Promise<SigmaClient> {
  const { data, error } = await supabase
    .from('sigma_blaze_clients')
    .update({
      name: updates.name,
      whatsapp: updates.whatsapp,
      email: updates.email,
      plan_name: updates.plan_name,
      expiration_date: updates.expiration_date,
      notes: updates.notes,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SigmaClient;
}

export async function softDeleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('sigma_blaze_clients')
    .update({ status: 'inactive' })
    .eq('id', id);
  if (error) throw error;
}

// Templates
export async function getTemplates(): Promise<SigmaReminderTemplate[]> {
  const { data, error } = await supabase
    .from('sigma_reminder_templates')
    .select('*')
    .order('is_default', { ascending: false });
  if (error) throw error;
  return (data || []) as SigmaReminderTemplate[];
}

export async function createTemplate(template: Partial<SigmaReminderTemplate>): Promise<SigmaReminderTemplate> {
  const { data, error } = await supabase
    .from('sigma_reminder_templates')
    .insert({ name: template.name!, message: template.message! })
    .select()
    .single();
  if (error) throw error;
  return data as SigmaReminderTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('sigma_reminder_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Reminder sending
export function renderTemplate(template: string, client: SigmaClient): string {
  const expStatus = getExpirationStatus(client.expiration_date);
  const expDate = new Date(client.expiration_date);
  return template
    .replace(/\{\{nome\}\}/g, client.name)
    .replace(/\{\{plano\}\}/g, client.plan_name)
    .replace(/\{\{data_vencimento\}\}/g, expDate.toLocaleDateString('pt-BR'))
    .replace(/\{\{dias_restantes\}\}/g, String(Math.max(0, expStatus.days)));
}

export function canSendReminder(client: SigmaClient): { allowed: boolean; reason?: string } {
  if (!client.last_reminder_sent) return { allowed: true };
  const lastSent = new Date(client.last_reminder_sent);
  const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return { allowed: false, reason: `Aguarde ${Math.ceil(24 - hoursSince)}h para reenviar` };
  }
  return { allowed: true };
}

export async function sendReminder(
  clientId: string,
  whatsapp: string,
  message: string,
  templateId?: string
): Promise<void> {
  // Log the reminder
  const { error: logError } = await supabase
    .from('sigma_reminder_logs')
    .insert({
      client_id: clientId,
      template_id: templateId,
      message_sent: message,
      whatsapp_number: whatsapp,
      status: 'sent',
    });
  if (logError) throw logError;

  // Update last_reminder_sent
  await supabase
    .from('sigma_blaze_clients')
    .update({ last_reminder_sent: new Date().toISOString() })
    .eq('id', clientId);
}

export async function sendBulkReminders(
  clientIds: string[],
  templateMessage: string,
  templateId?: string,
  clients?: SigmaClient[]
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;

  for (const id of clientIds) {
    const client = clients?.find(c => c.id === id);
    if (!client) { skipped++; continue; }

    const canSend = canSendReminder(client);
    if (!canSend.allowed) { skipped++; continue; }

    try {
      const rendered = renderTemplate(templateMessage, client);
      await sendReminder(id, client.whatsapp, rendered, templateId);
      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, skipped, errors };
}

export async function getReminderLogs(clientId: string): Promise<SigmaReminderLog[]> {
  const { data, error } = await supabase
    .from('sigma_reminder_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as SigmaReminderLog[];
}
