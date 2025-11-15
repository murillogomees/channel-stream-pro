# Arquitetura de Autenticação Unificada

## Visão Geral

Sistema de autenticação e autorização baseado em **roles** usando Supabase Auth + PostgreSQL RLS.

## Componentes Principais

### 1. Tabelas

#### `auth.users` (Supabase Auth)
- Gerencia identidade e autenticação
- Criada/gerenciada automaticamente pelo Supabase
- **Não modificar diretamente**

#### `public.profiles`
- **Tabela central de usuários**
- Contém dados de perfil de todos os usuários
- Campos:
  - `id` (UUID, FK para auth.users.id)
  - `nome`, `email`, `telefone`
  - `telefone_whatsapp`, `origem_cadastro`
  - `created_at`, `updated_at`

#### `public.user_roles`
- **Fonte de verdade para permissões**
- Define roles de cada usuário
- Campos:
  - `id` (UUID)
  - `user_id` (FK para profiles.id)
  - `role` (ENUM: 'client', 'admin', 'super_admin')

#### `public.clientes` (LEGACY)
- Tabela legada de dados de clientes
- Mantida para compatibilidade com dados existentes
- Ligada a profiles via `user_id`
- **Não usar para novos usuários** - dados devem estar em profiles

### 2. Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| **client** | Usuário cliente padrão | - Ver e editar apenas seus próprios dados<br>- Acesso à área /conta<br>- Sem acesso a rotas /admin |
| **admin** | Administrador do sistema | - Acesso total ao dashboard /admin<br>- Ver e editar dados de todos os usuários<br>- Cadastrar novos clientes<br>- Gerenciar configurações |
| **super_admin** | Super administrador | - Tudo que admin pode fazer<br>- Gerenciar roles de outros usuários<br>- Acessar configurações críticas<br>- Promover/rebaixar admins |

### 3. Funções de Banco

#### `has_role(_user_id uuid, _role app_role) → boolean`
- Verifica se usuário tem uma role específica
- **Security definer** - evita recursão em RLS
- Uso: `WHERE has_role(auth.uid(), 'admin')`

#### `is_admin(_user_id uuid) → boolean`
- Verifica se usuário é admin OU super_admin
- Atalho para `has_role(id, 'admin') OR has_role(id, 'super_admin')`

#### `is_super_admin(_user_id uuid) → boolean`
- Verifica se usuário é super_admin
- Atalho para `has_role(id, 'super_admin')`

### 4. Triggers

#### `handle_new_user()`
- Dispara ao criar usuário em `auth.users`
- Cria registro correspondente em `profiles`
- Copia dados básicos (nome, email, telefone)

#### `handle_new_user_role()`
- Dispara ao criar usuário em `auth.users`
- Atribui role padrão `'client'` em `user_roles`

### 5. RLS Policies

#### Profiles
- ✅ Usuários podem ver/editar próprio perfil
- ✅ Admins podem ver/editar todos os perfis
- ✅ Admins podem criar/deletar perfis

#### Clientes (LEGACY)
- ✅ Usuários podem ver próprio registro de cliente
- ✅ Admins podem ver/gerenciar todos os clientes

#### User Roles
- ✅ Usuários podem ver próprias roles
- ✅ Admins podem ver todas as roles
- ✅ Super admins podem gerenciar roles (adicionar/remover)

## Front-end

### Context API

```typescript
// src/contexts/AuthContext.tsx
const { 
  user,           // UnifiedUser com perfil + roles + dados cliente
  isAuthenticated, // boolean
  isAdmin,        // boolean (admin OU super_admin)
  isSuperAdmin,   // boolean
  isClient,       // boolean
  loading,        // boolean
  signOut,        // função
  refreshUser     // função
} = useAuth();
```

### Tipos TypeScript

```typescript
// src/types/auth.ts
type AppRole = 'client' | 'admin' | 'super_admin';

interface UnifiedUser {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
  clienteData?: { /* dados de clientes */ };
}
```

### Proteção de Rotas

```tsx
// Rota apenas para admins
<ProtectedRoute requireAdmin>
  <AdminDashboard />
</ProtectedRoute>

// Rota apenas para super admins
<ProtectedRoute requireSuperAdmin>
  <UserRoleManagement />
</ProtectedRoute>

// Rota apenas para clientes
<ProtectedRoute requireClient>
  <ClientAccount />
</ProtectedRoute>
```

### Redirecionamentos Pós-Login

- **Admin/Super Admin** → `/admin/dashboard`
- **Client** → `/conta`

## Fluxos de Uso

### 1. Criar Novo Cliente (via Admin)

```typescript
// 1. Criar usuário no Supabase Auth
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: 'cliente@email.com',
  password: 'senha123',
  options: {
    data: {
      nome: 'Nome do Cliente',
      telefone: '11999999999'
    }
  }
});

// 2. Triggers automáticos criam:
//    - Registro em profiles
//    - Role 'client' em user_roles

// 3. Opcional: criar registro em clientes para dados específicos
const { error: clienteError } = await supabase
  .from('clientes')
  .insert({
    user_id: authData.user.id,
    situacao: 'Testando',
    plano: 'Mensal',
    // ... outros campos
  });
```

### 2. Promover Cliente a Admin

```typescript
// Apenas super_admin pode fazer isso
const { error } = await supabase
  .from('user_roles')
  .insert({
    user_id: 'uuid-do-usuario',
    role: 'admin'
  });
```

### 3. Verificar Permissões no Front-end

```tsx
function AdminButton() {
  const { isAdmin } = useAuth();
  
  if (!isAdmin) return null;
  
  return <Button>Ação Administrativa</Button>;
}
```

### 4. Verificar Permissões no Edge Function

```typescript
// supabase/functions/exemplo/index.ts
const authHeader = req.headers.get('Authorization')!;
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);

// Verificar se é admin
const { data: isAdmin } = await supabase
  .rpc('is_admin', { _user_id: user.id });

if (!isAdmin) {
  return new Response('Forbidden', { status: 403 });
}
```

## Migrações Executadas

### Versão 1.0 - Unificação
- ✅ Adicionado `super_admin` ao enum `app_role`
- ✅ Criadas funções `is_admin()` e `is_super_admin()`
- ✅ Atualizadas RLS policies de profiles, clientes e user_roles
- ✅ Criada VIEW `users_unified` para acesso simplificado
- ✅ Configurados triggers para novos usuários

## Segurança

### ✅ Implementado
- RLS ativo em todas as tabelas
- Funções security definer para evitar recursão
- Políticas baseadas em roles
- Verificação de auth.uid() em todas as policies

### ⚠️ Atenções
- **NUNCA** desabilitar RLS em produção
- **NUNCA** usar `service_role` key no front-end
- **NUNCA** confiar apenas em verificações client-side
- **SEMPRE** validar permissões no backend (RLS + edge functions)

## Troubleshooting

### Usuário não consegue acessar área admin
1. Verificar se tem role admin: `SELECT * FROM user_roles WHERE user_id = 'uuid'`
2. Verificar RLS: `SELECT is_admin('uuid')`
3. Limpar cache do navegador / fazer logout-login

### Cliente vê dados de outros clientes
- **ERRO GRAVE DE SEGURANÇA**
- Revisar policies da tabela imediatamente
- Verificar se `auth.uid()` está sendo usado corretamente

### Edge function retorna 403
- Verificar se JWT está sendo passado no header
- Verificar se função `is_admin()` está funcionando
- Checar logs da função para detalhes

## Roadmap

- [ ] Implementar audit log de mudanças de roles
- [ ] Adicionar roles customizadas por tenant
- [ ] Sistema de permissões granulares (além de roles)
- [ ] Expiração automática de roles temporárias

## Contato

Para dúvidas sobre a arquitetura de autenticação, consulte:
- Documentação Supabase: https://supabase.com/docs/guides/auth
- RLS Best Practices: https://supabase.com/docs/guides/auth/row-level-security
