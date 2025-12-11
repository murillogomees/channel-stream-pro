import { WhatsappTemplate } from '@/types/whatsapp';

export const DEFAULT_TEMPLATES: WhatsappTemplate[] = [
  // === BOAS-VINDAS ===
  {
    id: 'welcome_trial',
    name: 'Boas-vindas - Período de Teste',
    message: `Olá {{nome}}! 👋🔥
Bem-vindo à IPTV LINK!

Seu período de teste foi ativado com sucesso. Aproveite à vontade — canais, filmes, séries e tudo mais sem limites.

📅 Seu teste termina em: {{dataFimTeste}}

Se curtir a experiência (e você vai), é só escolher um plano quando desejar. Estamos por aqui pra qualquer dúvida.

Atenciosamente,
IPTV LINK

💡 Indique um amigo e ganhe 1 mês grátis automaticamente!`,
    variables: ['nome', 'dataFimTeste'],
    type: 'local',
    eventType: 'welcome_trial',
  },
  {
    id: 'welcome_plan',
    name: 'Boas-vindas - Plano Contratado',
    message: `Olá {{nome}}! 🚀💙
Seu acesso foi ativado com sucesso no plano: {{plano}}.

Agora é só aproveitar o melhor do entretenimento sem travar.

📋 Plano: {{plano}}
💰 Valor: R$ {{valor}}
📅 Vencimento: {{dataVencimento}}

Qualquer dúvida é só chamar aqui no WhatsApp: {{whatsappSuporte}}

Atenciosamente,
IPTV LINK

🎁 Indique um amigo e ganhe 1 mês grátis!`,
    variables: ['nome', 'plano', 'valor', 'dataVencimento', 'whatsappSuporte'],
    type: 'local',
    eventType: 'welcome_plan',
  },
  
  // === RENOVAÇÃO CONFIRMADA ===
  {
    id: 'renewal_confirmed',
    name: 'Renovação Confirmada',
    message: `Olá {{nome}}! 🙌
Seu plano foi renovado com sucesso!

📋 Plano: {{plano}}
📅 Próxima cobrança: {{dataVencimento}}

Tudo liberado para continuar assistindo sem dor de cabeça.

Deus abençoe sempre! ✨

Atenciosamente,
IPTV LINK

🤝 Amigos Assistem Juntos:
Indique um amigo → Ele assina → Você ganha 1 mês grátis automaticamente.`,
    variables: ['nome', 'plano', 'dataVencimento'],
    type: 'local',
    eventType: 'renewal',
  },
  
  // === LEMBRETES DE VENCIMENTO ===
  {
    id: 'expiration_minus_7',
    name: 'Faltam 7 dias para vencer',
    message: `Olá {{nome}}! 📅

Seu plano vence em 7 dias ({{dataVencimento}}).

Que tal renovar antecipadamente e garantir entretenimento sem interrupção?

💰 Valor: R$ {{valor}}
🔗 Renove aqui: {{linkPagamento}}

Estamos à disposição!

IPTV LINK`,
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 7,
  },
  {
    id: 'expiration_minus_5',
    name: 'Faltam 5 dias para vencer',
    message: 'Olá {{nome}}! Seu plano vence em 5 dias ({{dataVencimento}}). Valor: R$ {{valor}}. Renove agora: {{linkPagamento}}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 5,
  },
  {
    id: 'expiration_minus_3',
    name: 'Faltam 3 dias para vencer',
    message: '⚠️ {{nome}}, seu plano vence em 3 dias ({{dataVencimento}}). Garanta seu acesso renovando agora! Valor: R$ {{valor}}. Link: {{linkPagamento}}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 3,
  },
  {
    id: 'expiration_minus_1',
    name: 'Falta 1 dia para vencer',
    message: '🚨 {{nome}}, AMANHÃ seu plano vence! Data: {{dataVencimento}}. Renove hoje para não perder acesso! Valor: R$ {{valor}}. Link: {{linkPagamento}}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 1,
  },
  {
    id: 'expiration_zero',
    name: 'Vence hoje',
    message: `Olá {{nome}}! 👋
Passando para avisar que seu plano no valor de R$ {{valor}} vence hoje.

Vamos renovar para manter o acesso liberado?

🔗 PIX para renovação: {{linkPagamento}}

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
    message: '❌ {{nome}}, seu plano venceu ontem. Regularize para reativar seu acesso. Valor: R$ {{valor}}. Link: {{linkPagamento}}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -1,
  },
  {
    id: 'expiration_plus_3',
    name: 'Vencido há 3 dias',
    message: '🔴 {{nome}}, seu plano está vencido há 3 dias. Última chance para reativar antes do bloqueio permanente. Valor: R$ {{valor}}. Link: {{linkPagamento}}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -3,
  },
  {
    id: 'expiration_plus_5',
    name: 'Vencido há 5 dias (Bloqueio)',
    message: '❌ {{nome}}, seu acesso foi bloqueado por falta de pagamento. Para reativar, regularize seu plano. Valor: R$ {{valor}}. Link: {{linkPagamento}}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -5,
  },
  {
    id: 'expiration_plus_7',
    name: 'Vencido há 7 dias (Última Chance)',
    message: `⛔ {{nome}}, seu acesso será EXCLUÍDO em 48 horas!

Sua conta está vencida há 7 dias e será removida do sistema.

Para evitar perder todo seu histórico e configurações:
💰 Valor: R$ {{valor}}
🔗 Regularize agora: {{linkPagamento}}

Esta é sua última notificação.

IPTV LINK`,
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -7,
  },
  
  // === LEMBRETE GENÉRICO DE PAGAMENTO ===
  {
    id: 'payment_reminder_generic',
    name: 'Lembrete Genérico de Pagamento',
    message: `Olá {{nome}}! 💬
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

Olá {{nome}}!

Seu pagamento foi confirmado com sucesso!

✅ *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}
💳 *Forma:* {{formaPagamento}}
📅 *Válido até:* {{dataVencimento}}

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

Olá {{nome}}!

Recebemos seu pedido de pagamento e ele está aguardando confirmação.

📋 *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}
💳 *Forma:* {{formaPagamento}}

{{statusInfo}}

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

Olá {{nome}}!

Seu pagamento está sendo processado pela operadora.

📋 *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}
💳 *Forma:* {{formaPagamento}}

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

Olá {{nome}}!

Infelizmente seu pagamento não foi processado.

📋 *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}
💳 *Forma:* {{formaPagamento}}
📝 *Motivo:* {{motivoErro}}

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

Olá {{nome}}!

Seu pagamento foi reembolsado conforme solicitação.

📋 *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}

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

Olá {{nome}}!

O pagamento do seu plano foi cancelado.

📋 *Plano:* {{plano}}
💰 *Valor:* R$ {{valor}}

Se não foi você quem cancelou, entre em contato conosco para verificar o que aconteceu.

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'plano', 'valor'],
    type: 'local',
    eventType: 'payment_cancelled',
  },

  // === TRIAL / PERÍODO DE TESTE ===
  {
    id: 'trial_ending_2days',
    name: 'Teste Termina em 2 Dias',
    message: `Olá {{nome}}! 👋

Seu período de teste termina em 2 dias!

Está gostando da experiência? 🎬

Escolha um plano e continue aproveitando:
• Mensal: R$ 30,00
• Trimestral: R$ 79,90 (economize R$ 10!)
• Semestral: R$ 149,90 (economize R$ 30!)
• Anual: R$ 279,90 (economize R$ 80!)

🔗 Assine agora: {{linkPagamento}}

Qualquer dúvida, estamos aqui!

IPTV LINK`,
    variables: ['nome', 'linkPagamento'],
    type: 'local',
    eventType: 'trial_ending',
  },
  {
    id: 'trial_ending_1day',
    name: 'Teste Termina Amanhã',
    message: `⚠️ {{nome}}, seu teste termina AMANHÃ!

Não perca acesso ao melhor conteúdo!

Escolha seu plano agora: {{linkPagamento}}

🎁 Primeira assinatura com 10% de desconto usando o cupom: PRIMEIRO10

IPTV LINK`,
    variables: ['nome', 'linkPagamento'],
    type: 'local',
    eventType: 'trial_expiring',
  },
  {
    id: 'trial_expired',
    name: 'Teste Expirou',
    message: `Olá {{nome}}! 😢

Seu período de teste expirou.

Sentimos sua falta! Volte agora e ganhe condições especiais:

🎁 Use o cupom VOLTE20 para 20% de desconto na primeira assinatura!

🔗 Assine aqui: {{linkPagamento}}

Esperamos você de volta!

IPTV LINK`,
    variables: ['nome', 'linkPagamento'],
    type: 'local',
    eventType: 'trial_expired',
  },

  // === UPGRADE/DOWNGRADE DE PLANO ===
  {
    id: 'plan_upgrade',
    name: 'Upgrade de Plano',
    message: `🎉 *Parabéns pelo Upgrade!*

Olá {{nome}}!

Seu plano foi atualizado com sucesso!

⬆️ *De:* {{planoAnterior}}
⬆️ *Para:* {{novoPlano}}
💰 *Novo valor:* R$ {{valor}}
📅 *Válido até:* {{dataVencimento}}

Aproveite todos os novos benefícios! 🚀

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'planoAnterior', 'novoPlano', 'valor', 'dataVencimento'],
    type: 'local',
    eventType: 'plan_upgrade',
  },
  {
    id: 'plan_downgrade',
    name: 'Downgrade de Plano',
    message: `📋 *Plano Atualizado*

Olá {{nome}}!

Seu plano foi alterado conforme solicitação.

⬇️ *De:* {{planoAnterior}}
⬇️ *Para:* {{novoPlano}}
💰 *Novo valor:* R$ {{valor}}

As alterações entram em vigor no próximo ciclo de cobrança.

Estamos à disposição para qualquer dúvida!

IPTV LINK`,
    variables: ['nome', 'planoAnterior', 'novoPlano', 'valor'],
    type: 'local',
    eventType: 'plan_downgrade',
  },

  // === CLIENTE INATIVO ===
  {
    id: 'user_inactive_7days',
    name: 'Inativo há 7 Dias',
    message: `Olá {{nome}}! 👋

Sentimos sua falta! Faz uma semana que você não acessa a plataforma.

🎬 Novidades esperando por você:
• {{novosConteudos}}
• {{conteudoEmDestaque}}

Volte e aproveite! {{linkApp}}

IPTV LINK`,
    variables: ['nome', 'novosConteudos', 'conteudoEmDestaque', 'linkApp'],
    type: 'local',
    eventType: 'user_inactive',
  },
  {
    id: 'user_inactive_15days',
    name: 'Inativo há 15 Dias',
    message: `{{nome}}, estamos com saudades! 😢

Você não acessa há 15 dias. Está tudo bem?

📺 Temos novidades incríveis:
• Novos filmes lançados
• Séries exclusivas
• Canais ao vivo em HD

🔗 Acesse agora: {{linkApp}}

Se tiver qualquer problema, nos avise! {{whatsappSuporte}}

IPTV LINK`,
    variables: ['nome', 'linkApp', 'whatsappSuporte'],
    type: 'local',
    eventType: 'user_inactive',
  },
  {
    id: 'user_inactive_30days',
    name: 'Inativo há 30 Dias',
    message: `{{nome}}, faz 30 dias! 😟

Você sumiu! Está com algum problema técnico?

🎁 Oferta especial para você voltar:
Cupom SAUDADE30 = 30% de desconto na próxima renovação!

📞 Precisa de ajuda? {{whatsappSuporte}}
🔗 Acesse: {{linkApp}}

Queremos você de volta!

IPTV LINK`,
    variables: ['nome', 'linkApp', 'whatsappSuporte'],
    type: 'local',
    eventType: 'user_inactive',
  },

  // === AFILIADOS ===
  {
    id: 'affiliate_new_referral',
    name: 'Nova Indicação (Afiliado)',
    message: `🎉 *Nova Indicação!*

Olá {{nome}}!

Alguém usou seu código de indicação!

👤 *Indicado:* {{nomeIndicado}}
📋 *Status:* Aguardando assinatura

Quando ele assinar, você ganha automaticamente!

📊 Suas estatísticas:
• Total indicados: {{totalIndicacoes}}
• Convertidos: {{indicacoesConvertidas}}
• Comissão acumulada: {{comissaoTotal}}

Continue compartilhando: {{linkIndicacao}}

IPTV LINK`,
    variables: ['nome', 'nomeIndicado', 'totalIndicacoes', 'indicacoesConvertidas', 'comissaoTotal', 'linkIndicacao'],
    type: 'local',
    eventType: 'affiliate_referral',
  },
  {
    id: 'affiliate_commission_earned',
    name: 'Comissão Creditada (Afiliado)',
    message: `💰 *Comissão Creditada!*

Olá {{nome}}!

Parabéns! Você ganhou uma nova comissão!

👤 *Indicado:* {{nomeIndicado}}
📋 *Plano assinado:* {{planoIndicado}}
💵 *Sua comissão:* R$ {{comissaoTotal}}

📊 Saldo disponível para saque: {{comissaoPendente}}

Continue indicando e ganhe mais!
🔗 {{linkIndicacao}}

IPTV LINK`,
    variables: ['nome', 'nomeIndicado', 'planoIndicado', 'comissaoTotal', 'comissaoPendente', 'linkIndicacao'],
    type: 'local',
    eventType: 'affiliate_commission',
  },

  // === FIDELIDADE ===
  {
    id: 'loyalty_milestone',
    name: 'Marco de Fidelidade',
    message: `🏆 *Parabéns, {{nome}}!*

Você completou {{mesesComoCliente}} meses como nosso cliente!

🎁 Como agradecimento, você ganhou:
• {{pontosFidelidade}} pontos de fidelidade
• Nível atual: {{nivelFidelidade}}
• Próxima recompensa: {{proximaRecompensa}}

Obrigado por fazer parte da família IPTV LINK! 💙

IPTV LINK`,
    variables: ['nome', 'mesesComoCliente', 'pontosFidelidade', 'nivelFidelidade', 'proximaRecompensa'],
    type: 'local',
    eventType: 'loyalty_reward',
  },
  {
    id: 'client_anniversary',
    name: 'Aniversário de Cliente',
    message: `🎂 *Feliz Aniversário de Cliente!*

Olá {{nome}}!

Hoje faz 1 ano que você está conosco! 🎉

Como presente especial:
🎁 30% de desconto na próxima renovação
📌 Cupom: ANIVER30

Sua economia total neste ano: {{economiaTotal}}

Obrigado por confiar na IPTV LINK!

IPTV LINK`,
    variables: ['nome', 'economiaTotal'],
    type: 'local',
    eventType: 'client_anniversary',
  },

  // === PROMOÇÕES E CAMPANHAS ===
  {
    id: 'promotional_campaign',
    name: 'Campanha Promocional',
    message: `🔥 *PROMOÇÃO ESPECIAL!*

Olá {{nome}}!

Só hoje: {{descontoCupom}} de desconto!

🎁 Cupom: {{codigoCupom}}
⏰ Válido até: {{validadeCupom}}

Aproveite agora: {{linkPagamento}}

Não perca esta oportunidade!

IPTV LINK`,
    variables: ['nome', 'descontoCupom', 'codigoCupom', 'validadeCupom', 'linkPagamento'],
    type: 'local',
    eventType: 'promotional_campaign',
  },
  {
    id: 'seasonal_greeting',
    name: 'Mensagem Sazonal',
    message: `🎄 *{{mensagemEspecial}}*

Olá {{nome}}!

A equipe IPTV LINK deseja a você e sua família muita paz, amor e alegria!

🎁 Presente especial: cupom NATAL10 para 10% de desconto!

Boas festas! 🌟

IPTV LINK`,
    variables: ['nome', 'mensagemEspecial'],
    type: 'local',
    eventType: 'seasonal_greeting',
  },

  // === NOVOS CONTEÚDOS ===
  {
    id: 'new_content_added',
    name: 'Novo Conteúdo Adicionado',
    message: `🎬 *Novidade na Plataforma!*

Olá {{nome}}!

Acabamos de adicionar novos conteúdos que você vai adorar:

🆕 {{conteudoEmDestaque}}

📊 Agora temos:
• {{totalCanais}} canais
• {{totalFilmes}} filmes
• {{totalSeries}} séries

Acesse agora: {{linkApp}}

IPTV LINK`,
    variables: ['nome', 'conteudoEmDestaque', 'totalCanais', 'totalFilmes', 'totalSeries', 'linkApp'],
    type: 'local',
    eventType: 'new_content',
  },

  // === SUPORTE E MANUTENÇÃO ===
  {
    id: 'maintenance_scheduled',
    name: 'Manutenção Programada',
    message: `🔧 *Aviso de Manutenção*

Olá {{nome}}!

Informamos que haverá manutenção programada em nossa plataforma.

📅 Data: {{dataPersonalizada}}
⏰ Horário: {{horaAtual}}
⏱️ Duração estimada: 2 horas

Durante este período, o serviço pode apresentar instabilidades.

Agradecemos a compreensão!

IPTV LINK`,
    variables: ['nome', 'dataPersonalizada', 'horaAtual'],
    type: 'local',
    eventType: 'maintenance',
  },
  {
    id: 'maintenance_completed',
    name: 'Manutenção Concluída',
    message: `✅ *Manutenção Concluída!*

Olá {{nome}}!

Nossa manutenção foi concluída com sucesso!

O sistema está 100% operacional.

Pode voltar a aproveitar o melhor conteúdo! 🎬

Qualquer problema, nos avise: {{whatsappSuporte}}

IPTV LINK`,
    variables: ['nome', 'whatsappSuporte'],
    type: 'local',
    eventType: 'maintenance',
  },

  // === REATIVAÇÃO E CHURN ===
  {
    id: 'churn_risk_detected',
    name: 'Risco de Cancelamento Detectado',
    message: `Olá {{nome}}! 💬

Notamos que você tem acessado menos a plataforma ultimamente.

Está tudo bem? Podemos ajudar com algo?

🎁 Que tal um cupom especial?
Código: VOLTE15 = 15% de desconto na renovação

📞 Fale conosco: {{whatsappSuporte}}

Queremos te manter conosco!

IPTV LINK`,
    variables: ['nome', 'whatsappSuporte'],
    type: 'local',
    eventType: 'churn_risk',
  },
  {
    id: 'client_reactivation',
    name: 'Cliente Reativado',
    message: `🎉 *Bem-vindo de Volta!*

Olá {{nome}}!

Ficamos muito felizes com seu retorno!

Seu acesso foi reativado com sucesso.

📋 Plano: {{plano}}
📅 Válido até: {{dataVencimento}}

Bom entretenimento! 🎬

IPTV LINK`,
    variables: ['nome', 'plano', 'dataVencimento'],
    type: 'local',
    eventType: 'client_reactivation',
  },
  {
    id: 'client_deactivation',
    name: 'Cliente Desativado',
    message: `😢 *Conta Desativada*

Olá {{nome}}!

Sua conta foi desativada por falta de pagamento.

Para reativar, basta regularizar:
🔗 {{linkPagamento}}

Sentiremos sua falta! Esperamos te ver em breve.

IPTV LINK`,
    variables: ['nome', 'linkPagamento'],
    type: 'local',
    eventType: 'client_deactivation',
  },

  // === MENSAGEM MANUAL/GENÉRICA ===
  {
    id: 'manual_generic',
    name: 'Mensagem Manual',
    message: `Olá {{nome}}!

{{textoPersonalizado1}}

{{textoPersonalizado2}}

Qualquer dúvida, estamos à disposição!

Atenciosamente,
IPTV LINK`,
    variables: ['nome', 'textoPersonalizado1', 'textoPersonalizado2'],
    type: 'local',
    eventType: 'manual',
  },
];
