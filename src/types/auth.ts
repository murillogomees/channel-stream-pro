/**
 * TIPOS UNIFICADOS DE AUTENTICAÇÃO
 * @version 4.0.0
 * 
 * HIERARQUIA DE ROLES (cada usuário só pode ter UMA role):
 * 
 * 1. MASTER (mais alto) - murillo@gmail.com
 *    - Acesso TOTAL e irrestrito a todo o sistema
 *    - CRUD completo em todas as tabelas
 *    - Executar migrations e configurar serviços
 *    - Gerenciar rotas, tokens e integrações
 *    - Criar/remover admins
 *    - Funções exclusivas que admin não pode acessar
 * 
 * 2. ADMIN (intermediário)
 *    - Gerencia o sistema e usuários
 *    - Acesso ao dashboard administrativo
 *    - CRUD em clientes e conteúdo
 *    - Algumas funções podem ser restritas apenas ao master
 * 
 * 3. CLIENT (base)
 *    - Acesso apenas a /app/* (streaming/player)
 *    - Depende de assinatura ativa para acesso
 *    - Sem acesso ao painel administrativo
 */
export type AppRole = 'client' | 'admin' | 'master';

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
  isMaster: boolean;
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
  isMaster: boolean;
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
