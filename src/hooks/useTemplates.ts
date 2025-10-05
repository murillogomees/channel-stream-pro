import { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/types/whatsapp';

const STORAGE_KEY = 'whatsapp_templates';

const DEFAULT_TEMPLATES: WhatsappTemplate[] = [
  {
    id: '1',
    name: '5 dias antes',
    message: 'Olá {nome}! Seu plano vence em 5 dias ({dataVencimento}). Renove agora: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: -5,
  },
  {
    id: '2',
    name: '3 dias antes',
    message: 'Atenção {nome}! Faltam apenas 3 dias para vencer ({dataVencimento}). Evite bloqueio: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: -3,
  },
  {
    id: '3',
    name: 'Dia do vencimento',
    message: 'Olá {nome}! Seu plano vence HOJE ({dataVencimento}). Renove urgente: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: 0,
  },
  {
    id: '4',
    name: '1 dia atrasado',
    message: '{nome}, seu plano está VENCIDO desde {dataVencimento}. Regularize agora: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: 1,
  },
  {
    id: '5',
    name: '3 dias atrasado',
    message: '{nome}, 3 dias de atraso! Venceu em {dataVencimento}. Pague para evitar bloqueio: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: 3,
  },
  {
    id: '6',
    name: '5 dias atrasado - Final',
    message: 'ÚLTIMA CHAMADA {nome}! 5 dias de atraso ({dataVencimento}). Bloqueio iminente: {linkPagamento}',
    variables: ['nome', 'dataVencimento', 'linkPagamento'],
    type: 'local',
    daysBeforeDue: 5,
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
