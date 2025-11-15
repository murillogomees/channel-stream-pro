# Guia de Teste de Permissões

## Página de Validação

A página `/admin/permission-test` permite validar visualmente se as permissões e roles estão funcionando corretamente.

### Como Usar

1. Acesse `/admin/permission-test` (apenas admins)
2. Clique em "Executar Testes de Permissão"
3. Aguarde os resultados

### Testes Executados

1. **Contexto de Autenticação**: Verifica se o usuário está autenticado
2. **Roles do Usuário**: Lista as roles atribuídas
3. **Flags de Permissão**: Valida isAdmin, isSuperAdmin, isClient
4. **SELECT - Próprio Perfil**: Testa leitura do próprio registro em profiles
5. **SELECT - Todos os Perfis**: Testa acesso admin a todos os perfis
6. **SELECT - Clientes**: Testa acesso admin aos dados de clientes
7. **SELECT - Próprias Roles**: Testa leitura das próprias roles
8. **SELECT - Todas as Roles**: Testa acesso admin a todas as roles
9. **RPC - is_admin()**: Testa função is_admin() no banco
10. **RPC - has_role()**: Testa função has_role() no banco

## Cenários de Teste Manual

### Cliente Normal

1. Fazer login como cliente
2. Acessar `/conta` (deve funcionar)
3. Tentar acessar `/admin/dashboard` (deve redirecionar para /403)
4. Tentar acessar `/admin/permission-test` (deve redirecionar para /403)

### Admin

1. Fazer login como admin
2. Acessar `/admin/dashboard` (deve funcionar)
3. Acessar `/admin/permission-test` (deve funcionar)
4. Executar testes (todos devem passar)
5. Verificar acesso a:
   - Listagem de clientes
   - Cadastro de clientes
   - Edição de clientes
   - Configurações do sistema

### Super Admin

1. Fazer login como super admin
2. Acessar `/admin/user-roles` (deve funcionar)
3. Promover/rebaixar usuários (deve funcionar)
4. Ver audit log de mudanças de roles

## Edge Functions

As edge functions agora verificam permissões:

### smartone-sync
- **Requer**: Admin
- **Verifica**: Token JWT + função `is_admin()`
- **Resposta sem permissão**: 403 Forbidden

### sync-new-client
- **Requer**: Admin
- **Verifica**: Token JWT + função `is_admin()`
- **Resposta sem permissão**: 403 Forbidden

## Problemas Comuns

### Usuário admin não consegue acessar páginas admin

**Diagnóstico**:
1. Verificar se a role está na tabela `user_roles`
2. Executar teste de permissões
3. Verificar logs do navegador (console)
4. Fazer logout e login novamente

**Solução**:
```sql
-- Verificar roles do usuário
SELECT * FROM user_roles WHERE user_id = 'uuid-do-usuario';

-- Adicionar role admin se necessário
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-do-usuario', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Funções RPC retornam erro

**Diagnóstico**:
1. Verificar se funções existem no banco
2. Verificar se RLS está configurado corretamente
3. Testar função diretamente no SQL Editor

**Solução**:
```sql
-- Testar is_admin()
SELECT is_admin('uuid-do-usuario');

-- Testar has_role()
SELECT has_role('uuid-do-usuario', 'admin');
```

### Edge function retorna 403

**Diagnóstico**:
1. Verificar se token JWT está sendo enviado
2. Verificar se usuário tem role admin
3. Checar logs da edge function

**Solução**:
- Verificar header `Authorization: Bearer <token>`
- Confirmar que `supabase.auth.getUser()` retorna usuário válido
- Confirmar que `is_admin()` retorna true

## Melhores Práticas

1. **Sempre teste após mudanças de permissões**
   - Execute a página de teste após modificar RLS
   - Teste manualmente com diferentes tipos de usuários

2. **Use o audit log**
   - Todas as mudanças de roles são registradas
   - Verifique o histórico em caso de problemas

3. **Nunca bypass RLS em produção**
   - Use `anon` key no frontend
   - Use `service_role` apenas em edge functions quando necessário
   - Sempre valide permissões no backend

4. **Mantenha roles simples**
   - client: usuário padrão
   - admin: acesso total ao dashboard
   - super_admin: gerenciamento de roles

5. **Documente mudanças**
   - Atualize este guia ao adicionar novas permissões
   - Documente novos casos de uso
