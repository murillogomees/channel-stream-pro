# Como Corrigir o Problema do JWT "role=admin"

## ⚠️ Problema Atual

O usuário `murillo@gmail.com` tem o role de `admin` na tabela `user_roles`, mas está sendo redirecionado para `/conta` ao invés de `/dashboard` porque:

1. O JWT do Supabase contém `role: "admin"` ao invés de `role: "authenticated"`
2. PostgreSQL tenta mudar para o role "admin" (que não existe como database role)
3. Isso gera erro 401/22023 e o sistema assume incorretamente que é um `client`

## ✅ Solução: Remover o Hook que Seta `role: "admin"` no JWT

### Passo 1: Verificar o JWT Atual

1. Abra o Console do navegador (F12)
2. Cole este código:
```javascript
const session = await supabase.auth.getSession();
console.log('JWT Payload:', session.data.session?.access_token);
console.log('Role no JWT:', session.data.session?.user?.role);
```

**Esperado:** `role: "authenticated"` ✅  
**Problema:** `role: "admin"` ❌

### Passo 2: Remover o Hook no Supabase Dashboard

1. Vá para: **Authentication → Hooks**
2. Procure por hooks do tipo "Custom Access Token"
3. Se encontrar algum hook que contém `jsonb_set(claims, '{role}', ...)`, **DESATIVE-O** ou edite para usar `user_role` ao invés de `role`

### Passo 3: Criar Hook Seguro (Recomendado)

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Criar função para adicionar user_role ao JWT SEM tocar na claim 'role'
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Buscar o role do usuário (prioriza admin)
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = (event->>'user_id')::uuid
  ORDER BY (ur.role = 'admin') DESC
  LIMIT 1;

  -- Adicionar user_role ao JWT (NÃO modificar claims.role!)
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(user_role));
  END IF;

  RETURN event;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO postgres;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO anon;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;
```

Depois, vá em **Authentication → Hooks** e:
- **Enable Hook:** Custom Access Token
- **Function:** `public.custom_access_token_hook`
- **Save**

### Passo 4: Invalidar Sessões Antigas

1. Vá para: **Authentication → Users**
2. Encontre `murillo@gmail.com`
3. Clique nos 3 pontinhos → **Revoke Sessions**

### Passo 5: Limpar Storage e Relogar

1. Faça logout do sistema
2. Abra o Console (F12) → Application → Local Storage
3. Limpe todos os dados do `supabase.auth`
4. Faça login novamente

### Passo 6: Verificar Sucesso

1. Após login, abra o Console:
```javascript
const session = await supabase.auth.getSession();
console.log('✅ Role no JWT:', session.data.session?.user?.role); // Deve ser "authenticated"
console.log('✅ User Role (custom):', session.data.session?.user?.user_metadata?.user_role); // Pode ser "admin"
```

2. Tente acessar `/dashboard` → Deve funcionar! ✅

## 🔍 Troubleshooting

### Ainda está sendo redirecionado?

1. Verifique se a função `has_role` está retornando corretamente:
```sql
SELECT has_role('7f136599-d816-48a9-afcd-30f9f67580ce', 'admin');
-- Deve retornar: true
```

2. Verifique se o user_role está na tabela:
```sql
SELECT * FROM user_roles WHERE user_id = '7f136599-d816-48a9-afcd-30f9f67580ce';
-- Deve mostrar role = 'admin'
```

3. Abra o Console e veja se há erros relacionados a "role" ou "22023"

### Se o problema persistir:

Execute no SQL Editor para garantir que o role está correto:
```sql
-- Remover qualquer role 'client'
DELETE FROM public.user_roles 
WHERE user_id = '7f136599-d816-48a9-afcd-30f9f67580ce' 
AND role = 'client';

-- Garantir que tem role 'admin'
INSERT INTO public.user_roles (user_id, role)
VALUES ('7f136599-d816-48a9-afcd-30f9f67580ce', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## 📚 Referências

- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [JWT Custom Claims](https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control-rbac)
