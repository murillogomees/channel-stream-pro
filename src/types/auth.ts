/**
 * TIPOS UNIFICADOS DE AUTENTICAÇÃO
 * 
 * Sistema baseado em:
 * - auth.users (Supabase Auth) - identidade
 * - public.profiles - dados de perfil
 * - public.user_roles - permissões (client, admin, super_admin)
 */

export type AppRole = 'client' | 'admin' | 'super_admin';

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

export interface UnifiedUser extends UserProfile {
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  // Dados de cliente (se existir registro em clientes)
  clienteData?: {
    id: string;
    situacao: string;
    plano: string;
    data_vencimento: string;
    valor_pago: number;
    cliente_ativo: boolean;
    mac_smart_one?: string;
  };
}

export interface AuthContextType {
  user: UnifiedUser | null;
  session: any;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
