import { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/types/whatsapp';

const STORAGE_KEY = 'whatsapp_templates';

const DEFAULT_TEMPLATES: WhatsappTemplate[] = [
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
    name: '5 dias antes do vencimento',
    message: 'Olá {nome}! Seu plano vence em 5 dias ({dataVencimento}). Valor: R$ {valor}. Renove agora: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 5,
  },
  {
    id: 'expiration_minus_3',
    name: '3 dias antes do vencimento',
    message: '⚠️ {nome}, seu plano vence em 3 dias ({dataVencimento}). Garanta seu acesso renovando agora! Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 3,
  },
  {
    id: 'expiration_minus_1',
    name: '1 dia antes do vencimento',
    message: '🚨 {nome}, AMANHÃ seu plano vence! Data: {dataVencimento}. Renove hoje para não perder acesso! Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: 1,
  },
  {
    id: 'expiration_zero',
    name: 'Dia do vencimento',
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
    name: '1 dia após vencimento',
    message: '❌ {nome}, seu plano venceu ontem. Regularize para reativar seu acesso. Valor: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -1,
  },
  {
    id: 'expiration_plus_3',
    name: '3 dias após vencimento',
    message: '❌ {nome}, seu acesso está suspenso há 3 dias. Regularize seu pagamento de R$ {valor} para reativar! Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -3,
  },
  {
    id: 'expiration_plus_5',
    name: '5 dias após vencimento',
    message: '⛔ {nome}, seu acesso será cancelado em breve. Plano vencido há 5 dias. Valor para reativação: R$ {valor}. Link: {linkPagamento}',
    variables: ['nome', 'valor', 'linkPagamento'],
    type: 'local',
    eventType: 'expiration',
    daysBeforeDue: -5,
  },
];

export const useTemplates = () => {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        setTemplates(DEFAULT_TEMPLATES);
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
    }
  }, []);

  const addTemplate = (template: Omit<WhatsappTemplate, 'id'>) => {
    const novoTemplate: WhatsappTemplate = {
      ...template,
      id: crypto.randomUUID(),
    };
    const novosTemplates = [...templates, novoTemplate];
    setTemplates(novosTemplates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosTemplates));
    return novoTemplate;
  };

  const updateTemplate = (id: string, data: Partial<WhatsappTemplate>) => {
    const novosTemplates = templates.map(t =>
      t.id === id ? { ...t, ...data } : t
    );
    setTemplates(novosTemplates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosTemplates));
  };

  const deleteTemplate = (id: string) => {
    const novosTemplates = templates.filter(t => t.id !== id);
    setTemplates(novosTemplates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosTemplates));
  };

  const getTemplateById = (id: string) => {
    return templates.find(t => t.id === id);
  };

  const resetToDefaults = () => {
    setTemplates(DEFAULT_TEMPLATES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
  };

  const extractVariables = (message: string): string[] => {
    const matches = message.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/[{}]/g, ''));
  };

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    resetToDefaults,
    extractVariables,
  };
};
