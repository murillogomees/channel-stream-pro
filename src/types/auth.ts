/**
 * TIPOS UNIFICADOS DE AUTENTICAÇÃO
 * @version 3.0.0
 * 
 * Sistema baseado em:
 * - auth.users (Supabase Auth) - identidade
 * - public.profiles - dados de perfil
 * - public.user_roles - permissões (client, admin, super_admin)
 * - public.clientes - dados de cliente e vencimento
 * - public.user_subscriptions - status de assinatura
 */

export type AppRole = 'client' | 'admin' | 'super_admin';

export type SubscriptionStatusType = 'trial' | 'active' | 'canceled' | 'expired' | 'past_due';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  telefone_whatsapp?: string;
  origem_cadastro?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface ClienteData {
  id: string;
  situacao: string;
  plano: string;
  data_vencimento: string | null;
  valor_pago: number;
  cliente_ativo: boolean;
  mac_smart_one?: string;
}

export interface SubscriptionData {
  id: string;
  status: SubscriptionStatusType;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  mercado_pago_subscription_id?: string;
}

export interface UnifiedUser extends UserProfile {
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  // Status de acesso
  hasValidAccess: boolean;
  isExpired: boolean;
  daysRemaining: number;
  isTrial: boolean;
  // Dados de cliente (se existir registro em clientes)
  clienteData?: ClienteData;
  // Dados de subscription
  subscriptionData?: SubscriptionData;
}

export interface AuthContextType {
  user: UnifiedUser | null;
  session: any;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  // Status de acesso
  hasValidAccess: boolean;
  isExpired: boolean;
  isTrial: boolean;
  daysRemaining: number;
  // Ações
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
