# Guia de Migração - Consolidação de Campos de Telefone

**Status**: ✅ EXECUTED  
**Execution Date**: 2024-12-02  
**Archive Date**: 2025-01-02 (30 days after execution)

## Resumo Executivo

Esta migração consolida os campos `telefone` e `telefone_whatsapp` em um único campo `contact_phone` na tabela `profiles`, simplificando o modelo de dados e melhorando a experiência do usuário.

## Impacto

### Alto Impacto
- ✅ **Formulários de cadastro/edição** - Unificados em um único campo
- ✅ **Sistema de notificações WhatsApp** - Usa o novo campo `contact_phone`
- ✅ **APIs** - Compatibilidade retroativa mantida via gateway

### Médio Impacto
- ⚠️ **Relatórios e exports** - Atualizados para usar `contact_phone`
- ⚠️ **Integrações externas** - Podem precisar atualização

### Baixo Impacto
- ✓ **Autenticação** - Sem alterações
- ✓ **Player/Streaming** - Sem alterações

## Checklist de Execução

### Pré-Deploy

- [x] Fazer backup completo do banco de dados
- [x] Executar scripts de verificação de conflitos
- [x] Notificar integrações externas da mudança
- [x] Preparar rollback scripts

### Deploy

1. **Executar migração SQL** (5-10 minutos)
   ```bash
   # Aplicar migração via Supabase Dashboard > SQL Editor
   # Arquivo: supabase/migrations/20251202023016_*.sql
   ```

2. **Verificar migração**
   ```sql
   SELECT 
     COUNT(*) as total_profiles,
     COUNT(contact_phone) as profiles_with_contact,
     COUNT(contact_phone) * 100.0 / COUNT(*) as percentage_filled
   FROM public.profiles;
   ```

3. **Deploy do código atualizado**
   - Frontend React atualizado
   - Hooks e serviços usando `contact_phone`
   - Gateway de compatibilidade ativado

### Pós-Deploy

- [x] Verificar formulários de cadastro funcionando
- [x] Testar envio de notificações WhatsApp
- [x] Validar exports e relatórios
- [x] Monitorar logs por 24h

## Compatibilidade Retroativa

### Gateway de Compatibilidade (Temporário)

O código inclui um gateway de compatibilidade que aceita os campos antigos:

```typescript
// Backend aceita tanto formato antigo quanto novo
{
  telefone: "(11) 99999-9999",        // ❌ Deprecated
  telefone_whatsapp: "(11) 88888-8888", // ❌ Deprecated
  contact_phone: "(11) 99999-9999"    // ✅ Preferred
}
```

**Remoção planejada:** 60 dias após deploy (01/03/2025)

## Rollback

Se necessário reverter a migração:

```sql
-- Ver script completo em:
-- supabase/migrations/20251202023016_*.sql
-- Seção: ROLLBACK SCRIPT
```

## Conflitos de Dados

A migração priorizará `telefone_whatsapp` sobre `telefone` quando ambos existirem:

```sql
-- Registros com conflito são logados
SELECT id, nome, telefone, telefone_whatsapp, contact_phone
FROM public.profiles
WHERE telefone != telefone_whatsapp
  AND telefone IS NOT NULL
  AND telefone_whatsapp IS NOT NULL;
```

## Suporte

- **Documentação técnica:** [REFACTOR_DOCUMENTATION.md](./REFACTOR_DOCUMENTATION.md)
- **Issues:** GitHub Issues
- **Emergências:** Executar rollback imediatamente

## Timeline

| Data | Ação |
|------|------|
| 02/12/2024 | ✅ Deploy da migração (EXECUTADO) |
| 03-09/12/2024 | Monitoramento intensivo |
| 01/03/2025 | Remoção do gateway de compatibilidade |
| 01/04/2025 | DROP das colunas antigas (telefone, telefone_whatsapp) |

## Métricas de Sucesso

- ✅ 92% dos perfis com `contact_phone` preenchido (23/25)
- ✅ 0 erros de envio de notificação WhatsApp
- ✅ 0 regressões em formulários
- ✅ Tempo de resposta < 200ms em queries de profile

## Execution Results

**Migration File**: `supabase/migrations/20251202023016_49507380-fce6-4911-955b-bd74c28f152b.sql`

**Statistics**:
- Total profiles: 25
- Profiles with contact_phone: 23 (92%)
- Data source: telefone_whatsapp (primary), telefone (fallback)
- Missing data: 2 profiles (8%) - require manual follow-up

**Verification**: All notification systems confirmed using contact_phone field.

**Monitoring Period**: 30 days (until 2025-01-02)

**Next Steps**: 
- Monitor remaining 8% for data quality
- Archive this document after monitoring period
- Schedule deprecation of old columns (2025-04-01)
