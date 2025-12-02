# Sistema de Autenticação e Autorização

## Visão Geral

Sistema de autenticação multi-camadas baseado em Supabase Auth com controle de acesso granular via Row Level Security (RLS) e JWT.

**Arquitetura de 3 Níveis de Acesso:**
- **Client** (role: `client`) - Usuários finais com acesso restrito ao player
- **Admin** (role: `admin`) - Administradores com acesso ao dashboard
- **Master** (role: `master`) - Super-administrador com controle total (murillo@gmail.com)

## Componentes Principais

### 1. Supabase Auth (auth.users)
- **Provider:** Email/senha
- **Sessões:** Gerenciadas automaticamente
- **Tokens:** JWT com refresh automático

### 2. Tabela profiles (single source of truth)
Consolidação de dados de usuário e cliente:
```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id),
  full_name text,
  contact_phone text,
  email text,
  plano text,
  data_vencimento date,
  cliente_ativo boolean,
  situacao text,
  mac_smart_one text,
  dispositivo_contratado text,
  -- subscription fields
  ...
);
```

### 3. Tabela user_roles
Mapeamento de usuário → role:
```sql
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  role text CHECK (role IN ('client', 'admin', 'master'))
);
```

### 4. Custom Access Token Hook
Injeta role no JWT durante login:
```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
BEGIN
  -- Priority: master > admin > client
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = (event->>'user_id')::uuid AND role = 'master') THEN
    event := jsonb_set(event, '{user_metadata,role}', '"master"');
  ELSIF EXISTS (SELECT 1 FROM user_roles WHERE user_id = (event->>'user_id')::uuid AND role = 'admin') THEN
    event := jsonb_set(event, '{user_metadata,role}', '"admin"');
  ELSE
    event := jsonb_set(event, '{user_metadata,role}', '"client"');
  END IF;
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Fluxo de Autenticação

### 1. Login
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
```

**Sequência:**
1. Supabase Auth valida credenciais
2. `custom_access_token_hook` é executado
3. JWT é gerado com role injetada
4. JWT armazenado no localStorage
5. Frontend redireciona baseado em role

### 2. Verificação de Role (Frontend)
```typescript
const { data: { user } } = await supabase.auth.getUser();
const role = user?.user_metadata?.role || 'client';

if (role === 'master' || role === 'admin') {
  navigate('/admin');
} else {
  navigate('/app/player');
}
```

### 3. Verificação de Permissão (Backend - RLS)
```sql
-- Exemplo de policy para profiles
CREATE POLICY "Clients can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (public.is_admin_or_master());
```

## Funções de Permissão

### is_admin_or_master()
```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### has_role(required_role text)
```sql
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Proteção de Rotas (Frontend)

### AuthGuard Component
```typescript
export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const userRole = user?.user_metadata?.role;

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/app/player" />;
  }

  return <>{children}</>;
}
```

### Uso em Rotas
```typescript
<Route
  path="/admin/*"
  element={
    <AuthGuard allowedRoles={['admin', 'master']}>
      <AdminLayout />
    </AuthGuard>
  }
/>
```

## Row Level Security (RLS)

### Policies por Role

#### Tabela: profiles

**SELECT Policies:**
```sql
-- Clients: próprio profile
CREATE POLICY "Clients view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Admins/Master: todos profiles
CREATE POLICY "Admins view all profiles"
ON profiles FOR SELECT
USING (is_admin_or_master());
```

**INSERT/UPDATE Policies:**
```sql
-- Admins/Master: criar/editar qualquer profile
CREATE POLICY "Admins manage profiles"
ON profiles FOR ALL
USING (is_admin_or_master())
WITH CHECK (is_admin_or_master());
```

#### Tabela: user_roles

**SELECT Policies:**
```sql
-- Admins/Master: visualizar todos roles
CREATE POLICY "Admins view all roles"
ON user_roles FOR SELECT
USING (is_admin_or_master());

-- Clients: próprio role
CREATE POLICY "Users view own role"
ON user_roles FOR SELECT
USING (auth.uid() = user_id);
```

**INSERT/UPDATE/DELETE Policies:**
```sql
-- APENAS Master pode criar/modificar/deletar 'master' role
CREATE POLICY "Only master manages master role"
ON user_roles FOR ALL
USING (
  has_role('master')
  OR (is_admin_or_master() AND role != 'master')
)
WITH CHECK (
  has_role('master')
  OR (is_admin_or_master() AND role != 'master')
);
```

## Edge Functions Authorization

### Verificar Admin
```typescript
// supabase/functions/my-function/index.ts
const authHeader = req.headers.get('Authorization');
if (!authHeader) return new Response('Unauthorized', { status: 401 });

const { data: { user }, error } = await supabaseClient.auth.getUser(
  authHeader.replace('Bearer ', '')
);

if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}

// Check if admin or master
const { data: roles } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'master');
if (!isAdmin) {
  return new Response('Forbidden', { status: 403 });
}
```

## Gestão de Master User

### Regras Especiais
1. **Único master:** Apenas murillo@gmail.com pode ter role 'master'
2. **Não modificável por admins:** Admins não podem alterar/remover master role
3. **Auto-proteção:** Master não pode remover própria role

### Criar Novo Master (via SQL)
```sql
-- ATENÇÃO: Executar apenas com aprovação
INSERT INTO user_roles (user_id, role)
SELECT id, 'master'
FROM auth.users
WHERE email = 'novo-master@example.com';
```

## Signup Flow

### Novo Usuário (Cliente)
1. **Signup:** `supabase.auth.signUp({ email, password })`
2. **Trigger:** `handle_new_user_complete()` executado automaticamente
3. **Criação automática:**
   - `profiles` (user_id, contact_phone, plano, data_vencimento, situacao = 'trial')
   - `user_roles` (user_id, role = 'client')
   - `user_subscriptions` (profile_id, status = 'trial', current_period_end = now() + 3 days)
4. **Trial:** 3 dias gratuitos automaticamente

### Criar Admin (via Dashboard)
1. Admin/Master acessa `/admin/usuarios`
2. Clica "Criar Usuário"
3. Preenche formulário (email, senha, nome, telefone, role)
4. **Edge Function:** `create-admin-user` cria user + profile + role
5. **Restrição:** Admins podem criar 'admin' e 'client', mas NUNCA 'master'

## Debugging & Troubleshooting

### Admin perde acesso após login
1. Verificar JWT: Decode em jwt.io
2. Verificar role no JWT: `user_metadata.role`
3. Verificar role no banco: `SELECT * FROM user_roles WHERE user_id = 'xxx'`
4. **Solução:** Fazer logout completo e re-login para gerar novo JWT

### Edge function retorna 403
- Verificar se JWT está no header Authorization
- Verificar se user_roles tem entry para o usuário
- Checar logs da edge function

### Cliente vê dados de outros clientes
- **ERRO GRAVE DE SEGURANÇA**
- Revisar RLS policies da tabela
- Verificar se `auth.uid()` está sendo usado corretamente

## Testing Guidelines

### Unit Tests
- Test role assignment in custom_access_token_hook
- Test RLS policies for each role
- Test permission functions (is_admin_or_master, has_role)

### Integration Tests
- Test complete login flow for each role
- Test JWT token generation and validation
- Test unauthorized access attempts

### Manual Testing Checklist
- [ ] Master user can access all admin functions
- [ ] Admin user can manage clients but not modify master
- [ ] Client user restricted to /app/* routes
- [ ] Logout/re-login generates correct JWT

## Historical Changes

### Phase 8: Three-Tier Consolidation (Dec 2024)
- Consolidated from four roles to three (client/admin/master)
- Unified profiles table as single source of truth
- Fixed JWT custom_access_token_hook role priority

For detailed change history, see docs/archive/auth/

## Roadmap

- [ ] Implementar audit log de mudanças de roles
- [ ] Adicionar roles customizadas por tenant
- [ ] Sistema de permissões granulares (além de roles)
- [ ] Expiração automática de roles temporárias

## Contato

Para dúvidas sobre a arquitetura de autenticação, consulte:
- Documentação Supabase: https://supabase.com/docs/guides/auth
- RLS Best Practices: https://supabase.com/docs/guides/auth/row-level-security
