import { WhatsappTemplate } from '@/types/whatsapp';

export const DEFAULT_TEMPLATES: WhatsappTemplate[] = [
  // === BOAS-VINDAS ===
  {
    id: 'welcome_trial',
    name: 'Boas-vindas - Período de Teste',
    message: `Olá {nome}! 👋🔥
Bem-vindo à IPTV LINK!

Seu período de teste foi ativado com sucesso. Aproveite à vontade — canais, filmes, séries e tudo mais sem limites.

Se curtir a experiência (e você vai), é só escolher um plano quando desejar. Estamos por aqui pra qualquer dúvida.

Atenciosamente,
IPTV LINK

Indique um amigo e ganhe 1 mês grátis automaticamente!`,
    variables: ['nome'],
    type: 'local',
    eventType: 'welcome_trial',
  },
  {
    id: 'welcome_plan',
    name: 'Boas-vindas - Plano Contratado',
    message: `Olá {nome}! 🚀💙
Seu acesso foi ativado com sucesso no plano: {plano}.

Agora é só aproveitar o melhor do entretenimento sem travar.
Data de vencimento: {dataVencimento}

Qualquer dúvida é só chamar aqui no WhatsApp.

Atenciosamente,
IPTV LINK

Indique um amigo e ganhe 1 mês grátis!`,
    variables: ['nome', 'plano', 'dataVencimento'],
    type: 'local',
    eventType: 'welcome_plan',
  },
  
  // === RENOVAÇÃO CONFIRMADA ===
  {
    id: 'renewal_confirmed',
    name: 'Renovação Confirmada',
    message: `Olá {nome}! 🙌
Seu plano foi renovado com sucesso!

Próxima cobrança: {dataVencimento}.
Tudo liberado para continuar assistindo sem dor de cabeça.

Deus abençoe sempre! ✨

Atenciosamente,
IPTV LINK

Amigos Assistem Juntos:
Indique um amigo → Ele assina → Você ganha 1 mês grátis automaticamente.`,
    variables: ['nome', 'dataVencimento'],
    type: 'local',
    eventType: 'renewal',
  },
  
  // === LEMBRETES DE VENCIMENTO ===
  {
    id: 'expiration_minus_5',
    name: 'Faltam 5 dias para vencer',
    message: 'Olá {nome}! Seu plano vence em 5 dias ({dataVencimento}). Valor: R$ {valor}. Renove agora: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 5,
  },
  {
    id: 'expiration_minus_3',
    name: 'Faltam 3 dias para vencer',
    message: '⚠️ {nome}, seu plano vence em 3 dias ({dataVencimento}). Garanta seu acesso renovando agora! Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 3,
  },
  {
    id: 'expiration_minus_1',
    name: 'Falta 1 dia para vencer',
    message: '🚨 {nome}, AMANHÃ seu plano vence! Data: {dataVencimento}. Renove hoje para não perder acesso! Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 1,
  },
  {
    id: 'expiration_zero',
    name: 'Vence hoje',
    message: `Olá {nome}! 👋
Passando para avisar que seu plano no valor de R$ {valor} vence hoje.

Vamos renovar para manter o acesso liberado?

PIX para renovação: {linkPagamento}

Qualquer dúvida, estou à disposição.

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 0,
  },
  {
    id: 'expiration_plus_1',
    name: 'Vencido há 1 dia',
    message: '❌ {nome}, seu plano venceu ontem. Regularize para reativar seu acesso. Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -1,
  },
  {
    id: 'expiration_plus_3',
    name: 'Vencido há 3 dias',
    message: '🔴 {nome}, seu plano está vencido há 3 dias. Última chance para reativar antes do bloqueio permanente. Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -3,
  },
  {
    id: 'expiration_plus_5',
    name: 'Vencido há 5 dias (Bloqueio)',
    message: '❌ {nome}, seu acesso foi bloqueado por falta de pagamento. Para reativar, regularize seu plano. Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -5,
  },
  
  // === LEMBRETE GENÉRICO DE PAGAMENTO ===
  {
    id: 'payment_reminder_generic',
    name: 'Lembrete Genérico de Pagamento',
    message: `Olá {nome}! 💬
Passando para lembrar: seu plano vence em breve.

Fique tranquilo, você pode renovar quando quiser através do PIX.

Estamos à disposição para qualquer dúvida!

Atenciosamente,
IPTV LINK`,
    variables: ['nome'],
    type: 'local',
    eventType: 'payment_reminder',
  },
  
  // === STATUS DE PAGAMENTO (MercadoPago) ===
  {
    id: 'payment_approved',
    name: 'Pagamento Aprovado',
    message: `🎉 *Pagamento Aprovado!*

Olá {nome}!

Seu pagamento foi confirmado com sucesso!

✅ *Plano:* {plano}
💰 *Valor:* R$ {valor}
💳 *Forma:* {formaPagamento}
📅 *Válido até:* {dataVencimento}

Seu acesso já está 100% liberado! 
Pode entrar agora e aproveitar todo o conteúdo. 🎬

Qualquer dúvida, estamos por aqui!

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor', 'formaPagamento', 'dataVencimento'],
    type: 'local',
    eventType: 'payment_approved',
  },
  {
    id: 'payment_pending',
    name: 'Pagamento Pendente',
    message: `⏳ *Pagamento Pendente*

Olá {nome}!

Recebemos seu pedido de pagamento e ele está aguardando confirmação.

📋 *Plano:* {plano}
💰 *Valor:* R$ {valor}
💳 *Forma:* {formaPagamento}

{statusInfo}

Assim que o pagamento for confirmado, você será notificado e seu acesso será liberado automaticamente!

Qualquer dúvida, estamos à disposição.

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor', 'formaPagamento', 'statusInfo'],
    type: 'local',
    eventType: 'payment_pending',
  },
  {
    id: 'payment_in_process',
    name: 'Pagamento em Processamento',
    message: `⏳ *Pagamento em Análise*

Olá {nome}!

Seu pagamento está sendo processado pela operadora.

📋 *Plano:* {plano}
💰 *Valor:* R$ {valor}
💳 *Forma:* {formaPagamento}

Geralmente a confirmação ocorre em poucos minutos. Você receberá uma mensagem assim que for aprovado!

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor', 'formaPagamento'],
    type: 'local',
    eventType: 'payment_in_process',
  },
  {
    id: 'payment_rejected',
    name: 'Pagamento Recusado',
    message: `❌ *Pagamento Não Aprovado*

Olá {nome}!

Infelizmente seu pagamento não foi processado.

📋 *Plano:* {plano}
💰 *Valor:* R$ {valor}
💳 *Forma:* {formaPagamento}
📝 *Motivo:* {motivoErro}

Por favor, verifique os dados e tente novamente, ou escolha outra forma de pagamento.

Se precisar de ajuda, estamos à disposição!

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor', 'formaPagamento', 'motivoErro'],
    type: 'local',
    eventType: 'payment_rejected',
  },
  {
    id: 'payment_refunded',
    name: 'Pagamento Reembolsado',
    message: `💰 *Pagamento Reembolsado*

Olá {nome}!

Seu pagamento foi reembolsado conforme solicitação.

📋 *Plano:* {plano}
💰 *Valor:* R$ {valor}

O valor será devolvido na mesma forma de pagamento utilizada.

Qualquer dúvida, estamos à disposição!

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor'],
    type: 'local',
    eventType: 'payment_refunded',
  },
  {
    id: 'payment_cancelled',
    name: 'Pagamento Cancelado',
    message: `🚫 *Pagamento Cancelado*

Olá {nome}!

O pagamento do seu plano foi cancelado.

📋 *Plano:* {plano}
💰 *Valor:* R$ {valor}

Se não foi você quem cancelou, entre em contato conosco para verificar o que aconteceu.

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor'],
    type: 'local',
    eventType: 'payment_cancelled',
  },
];
