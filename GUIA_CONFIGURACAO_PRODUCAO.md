# 🚀 Guia de Configuração para Produção - IPTV Link

## 📋 Status do Sistema

### ✅ O QUE JÁ ESTÁ PRONTO

1. **Sistema de Notificações WhatsApp**
   - ✅ Notificações automáticas diárias às 10:00
   - ✅ Cobertura completa: 5 dias ANTES até 5 dias APÓS vencimento
   - ✅ Detecção automática de pagamentos
   - ✅ Mensagens de boas-vindas (cadastro público e admin)
   - ✅ Notificações de atualização de dados
   - ✅ Sistema de retry automático em caso de falha
   - ✅ Dashboard de monitoramento em tempo real
   - ✅ Alertas para administradores

2. **Integração SmartOne IPTV**
   - ✅ Edge function `smartone-sync` completa
   - ✅ Sincronização automática ao cadastrar/editar cliente
   - ✅ Tratamento robusto de erros
   - ✅ Status tracking (não enviado, pendente, criado, erro)
   - ✅ Botão de ressincronização manual
   - ✅ Logs detalhados para debugging

3. **Formulários e Validações**
   - ✅ AdminClienteForm com validação Zod completa
   - ✅ TutorialSmartOne com validação em tempo real
   - ✅ Formatação automática de MAC address
   - ✅ Verificação de duplicatas
   - ✅ Proteção contra XSS e SQL injection
   - ✅ Mensagens de erro claras

4. **Analytics e Relatórios**
   - ✅ Dashboard completo de métricas
   - ✅ Análise de conversão por canal
   - ✅ CAC (Custo de Aquisição)
   - ✅ ROI real por canal
   - ✅ Previsão de receita
   - ✅ Exportação para CSV
   - ✅ Comparação de períodos
   - ✅ Sistema de metas com alertas

5. **Interface e UX**
   - ✅ Design profissional e responsivo
   - ✅ Tema dark/light automático
   - ✅ Componentes Shadcn/UI
   - ✅ Feedback visual (toasts, loading)
   - ✅ Tratamento de erros user-friendly

## 🔧 CONFIGURAÇÃO NECESSÁRIA

### Passo 1: Configurar Secrets do WhatsApp

1. Acesse: https://botbot.com.br
2. Faça login ou crie uma conta
3. Obtenha suas credenciais:
   - `appkey`
   - `authkey`

4. Configure no Supabase:
   - Acesse: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/settings/functions
   - Clique em "Add new secret"
   - Adicione:
     ```
     Nome: WHATSAPP_APPKEY
     Valor: [seu appkey do BotBot]
     
     Nome: WHATSAPP_AUTHKEY
     Valor: [seu authkey do BotBot]
     ```

### Passo 2: Configurar Secrets do SmartOne

1. Obtenha as credenciais do SmartOne IPTV:
   - URL base da API
   - Client API (ID do cliente)
   - Key API (chave de autenticação)

2. Configure no Supabase:
   - Mesma página de secrets
   - Adicione:
     ```
     Nome: SMARTONE_API_BASE_URL
     Valor: [URL base, ex: https://api.smartone.com]
     
     Nome: SMARTONE_CLIENT_API
     Valor: [seu client ID]
     
     Nome: SMARTONE_KEY_API
     Valor: [sua key API]
     ```

### Passo 3: Testar Integração SmartOne

1. Acesse Admin Dashboard → SmartOne Config
2. Insira as credenciais na interface
3. Clique em "Testar Conexão"
4. Verifique se retorna sucesso
5. Teste criando um cliente com MAC válido
6. Verifique os logs: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/functions/smartone-sync/logs

### Passo 4: Configurar Templates de Notificação

1. Acesse Admin Dashboard → Templates de Mensagem
2. Revise os templates padrão
3. **IMPORTANTE**: Crie templates para TODOS os dias de vencimento:
   - 5 dias antes (daysBeforeDue: 5)
   - 4 dias antes (daysBeforeDue: 4)
   - 3 dias antes (daysBeforeDue: 3)
   - 2 dias antes (daysBeforeDue: 2)
   - 1 dia antes (daysBeforeDue: 1)
   - Dia do vencimento (daysBeforeDue: 0)
   - 1 dia atrasado (daysBeforeDue: -1)
   - 2 dias atrasado (daysBeforeDue: -2)
   - 3 dias atrasado (daysBeforeDue: -3)
   - 4 dias atrasado (daysBeforeDue: -4)
   - 5 dias atrasado (daysBeforeDue: -5) - CORTE DO SERVIÇO

4. Personalize as mensagens conforme sua necessidade
5. Use variáveis disponíveis: {nome}, {valor}, {dataVencimento}, {plano}

### Passo 5: Configurar WhatsApp no Sistema

1. Acesse Admin Dashboard → Configurações de Notificação
2. Insira as credenciais do BotBot:
   - App Key
   - Auth Key
3. Configure o horário de envio (padrão: 10:00)
4. **NÃO ATIVE** o envio automático ainda

### Passo 6: Testar Envio Manual

1. Crie um cliente teste com vencimento para amanhã
2. Vá em Admin Dashboard → Notificações
3. Selecione o cliente
4. Teste envio manual
5. Confirme recebimento no WhatsApp
6. Verifique os logs

### Passo 7: Ativar Envio Automático

1. Após confirmar que tudo funciona
2. Vá em Configurações de Notificação
3. Ative "Envio Automático"
4. O sistema começará a verificar e enviar automaticamente às 10:00

## 📱 Como Funciona o Sistema de Notificações

### Fluxo Automático Diário

1. **10:00** - Sistema verifica se deve executar
2. Busca todos os clientes ativos
3. Detecta quem pagou recentemente
4. Para cada cliente:
   - Calcula dias até vencimento
   - Procura template correspondente
   - Verifica se já enviou hoje
   - Envia se necessário
5. Registra tudo em logs
6. Atualiza histórico

### Dias de Notificação (Exemplo)

```
Cliente com vencimento em 10/12/2024:

05/12 (dia -5): Notificação "Faltam 5 dias"
06/12 (dia -4): Notificação "Faltam 4 dias"
07/12 (dia -3): Notificação "Faltam 3 dias"
08/12 (dia -2): Notificação "Faltam 2 dias"
09/12 (dia -1): Notificação "Vence amanhã"
10/12 (dia 0):  Notificação "Vence hoje"
11/12 (dia +1): Notificação "1 dia atrasado"
12/12 (dia +2): Notificação "2 dias atrasado"
13/12 (dia +3): Notificação "3 dias atrasado"
14/12 (dia +4): Notificação "4 dias atrasado"
15/12 (dia +5): Notificação "SERVIÇO CORTADO"
```

### Prevenção de Duplicatas

- ✅ Verifica se já enviou no mesmo dia
- ✅ Não envia duas vezes mesmo se forçar
- ✅ Reseta a cada nova data

## 🎯 Monitoramento em Produção

### Dashboard AdminNotificationLive

- Visualize notificações em tempo real
- Filtre por tipo, status, período
- Pause/resume feed
- Salve filtros personalizados
- Veja estatísticas instantâneas

### Logs de Edge Functions

- Acesse: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/functions/smartone-sync/logs
- Monitore erros e sucessos
- Veja payloads completos
- Identifique problemas rapidamente

### Analytics

- Dashboard completo de métricas
- Conversão por canal
- ROI e CAC
- Previsões
- Exportação de relatórios

## ⚠️ AVISOS IMPORTANTES

### Antes de Ir para Produção

1. ✅ **Teste TUDO** com dados reais primeiro
2. ✅ Configure **TODOS** os templates de vencimento (dia -5 até +5)
3. ✅ Verifique se os secrets estão configurados corretamente
4. ✅ Teste o envio manual antes de ativar automático
5. ✅ Monitore os logs nas primeiras 48 horas
6. ✅ Tenha um número de suporte configurado nos templates

### Segurança

1. 🔐 **NUNCA** compartilhe secrets publicamente
2. 🔐 Faça backup do localStorage regularmente
3. 🔐 Use senhas fortes para admin
4. 🔐 Monitore acessos suspeitos
5. 🔐 Configure RLS no Supabase se usar tabelas

### Performance

1. ⚡ Sistema suporta milhares de clientes
2. ⚡ Rate limiting automático para WhatsApp
3. ⚡ Retry automático em caso de falha
4. ⚡ Cache inteligente de dados
5. ⚡ Otimização de queries

## 🆘 Suporte e Troubleshooting

### Problema: Notificações não estão sendo enviadas

1. Verifique se secrets estão configurados
2. Confirme que autoSendEnabled está true
3. Verifique horário configurado vs horário atual
4. Veja logs de erro no console
5. Confirme que há clientes com vencimento nos próximos dias

### Problema: SmartOne não sincroniza

1. Verifique secrets do SmartOne
2. Teste conexão na página de configuração
3. Veja logs da edge function
4. Confirme que MAC está no formato correto
5. Verifique se credenciais M3U estão corretas

### Problema: Formulários dando erro

1. Verifique validações no console
2. Confirme formato de dados (MAC, telefone, email)
3. Veja erros do Zod
4. Teste com dados mínimos primeiro
5. Limpe cache se necessário

## 📞 Links Úteis

- **Edge Functions**: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/functions
- **Secrets**: https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/settings/functions
- **BotBot API**: https://botbot.com.br
- **Documentação Lovable**: https://docs.lovable.dev

---

## ✅ Checklist Final

Antes de publicar:

- [ ] Secrets configurados (WhatsApp + SmartOne)
- [ ] Templates de notificação criados (todos os 11 dias)
- [ ] Teste manual de notificação realizado
- [ ] Teste de integração SmartOne realizado
- [ ] Validação de formulários testada
- [ ] Analytics funcionando
- [ ] Monitoramento em tempo real testado
- [ ] Backup de dados realizado
- [ ] Números de teste removidos
- [ ] Domínio personalizado configurado (opcional)

**Após tudo OK, clique em "Publish" no Lovable!** 🚀

---

**Última atualização**: 13/11/2025
**Status**: ✅ Sistema pronto para produção
