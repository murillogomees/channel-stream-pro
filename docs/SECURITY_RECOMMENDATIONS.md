# Recomendações de Segurança Supabase

## ✅ Implementado via Migração SQL

### 1. Search Path em Funções SECURITY DEFINER
Todas as funções SECURITY DEFINER agora têm `SET search_path = public` configurado, prevenindo ataques de manipulação de schema.

**Funções atualizadas:**
- `ensure_single_default_m3u()`
- `log_role_change()`
- `cleanup_old_security_events()`
- `cleanup_old_rate_limits()`
- `cleanup_old_metrics()`
- `update_updated_at_column()`

---

## ⚠️ Configurações Manuais Necessárias no Painel Supabase

### 2. Proteção Contra Senhas Vazadas (HIBP)

**Por que é importante:**
A integração com Have I Been Pwned (HIBP) previne que usuários utilizem senhas que já foram expostas em vazamentos de dados conhecidos.

**Como configurar:**

1. Acesse o painel Supabase: [Authentication → Providers](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/auth/providers)

2. Clique em **Email** provider

3. Na seção **Security**, habilite:
   - ✅ **Enable leaked password protection**
   - Define uma política de força de senha mínima (recomendado: Strong)

4. Salve as configurações

**Documentação oficial:**
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

### 3. Opções Adicionais de MFA (Autenticação Multi-Fator)

**Por que é importante:**
MFA adiciona uma camada extra de segurança, exigindo um segundo fator além da senha.

**Opções disponíveis:**

#### 3.1 TOTP (Time-based One-Time Password) - Já disponível
O TOTP já está habilitado por padrão e permite uso de apps como:
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password

#### 3.2 SMS MFA (Requer configuração adicional)

**Como configurar SMS MFA:**

1. Acesse: [Authentication → Providers](https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/auth/providers)

2. Clique em **Phone** provider

3. Configure um provedor de SMS:
   - **Twilio** (recomendado)
   - **MessageBird**
   - **Textlocal**
   - **Vonage**

4. Adicione as credenciais do provedor escolhido

5. Habilite **SMS MFA** nas configurações

#### 3.3 WhatsApp MFA (via Twilio)

1. Configure Twilio como provedor de Phone
2. Habilite WhatsApp nos canais da sua conta Twilio
3. Configure o número WhatsApp Business

**Documentação oficial:**
- MFA Overview: https://supabase.com/docs/guides/auth/auth-mfa
- Phone Auth: https://supabase.com/docs/guides/auth/phone-login
- SMS Providers: https://supabase.com/docs/guides/auth/phone-login/twilio

---

## 📋 Checklist de Segurança

- [x] Search path configurado em todas funções SECURITY DEFINER
- [ ] Proteção contra senhas vazadas (HIBP) habilitada
- [ ] Política de força de senha configurada (mínimo: Strong)
- [ ] TOTP MFA testado e funcionando
- [ ] SMS MFA configurado (opcional, mas recomendado)
- [ ] WhatsApp MFA configurado (opcional)

---

## 🔒 Boas Práticas Adicionais

### Políticas de Senha Recomendadas
```
Mínimo: 12 caracteres
Requer: Letras maiúsculas, minúsculas, números e símbolos
HIBP: Habilitado
```

### Configuração de MFA
```
Requer MFA para: Admins (obrigatório)
Opções disponíveis: TOTP + SMS
Grace period: 7 dias para configurar após login
```

### Rate Limiting
O projeto já possui rate limiting implementado via:
- Tabela `rate_limit_tracking`
- Função `check_and_block_ip()`
- Sistema de IP blacklist

---

## 📊 Monitoramento de Segurança

O sistema já monitora:
- ✅ Eventos de segurança (`security_events`)
- ✅ Bloqueio automático de IPs (`ip_blacklist`)
- ✅ Auditoria de mudanças de role (`role_audit_log`)
- ✅ Tentativas de login falhadas
- ✅ Acessos não autorizados

Acesse o painel de segurança em: `/admin/security-monitor`

---

## 🚀 Próximos Passos

1. **Imediato:** Configurar proteção contra senhas vazadas no painel
2. **Curto prazo:** Configurar provedor de SMS para MFA
3. **Médio prazo:** Implementar MFA obrigatório para usuários admin
4. **Contínuo:** Monitorar eventos de segurança e ajustar políticas

---

## 📚 Referências

- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/database-linter)
- [Auth Security](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts)
- [MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
