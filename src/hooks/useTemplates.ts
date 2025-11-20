import { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/types/whatsapp';
import { DEFAULT_TEMPLATES } from '@/constants/defaultTemplates';

const STORAGE_KEY = 'whatsapp_templates';

export const useTemplates = () => {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedTemplates = JSON.parse(stored);
        
        // Validar que templates têm eventType definido
        const validTemplates = parsedTemplates.filter((t: WhatsappTemplate) => {
          return t.eventType && typeof t.eventType === 'string';
        });
        
        // Se templates inválidos ou vazios, usar templates padrão
        if (validTemplates.length === 0) {
          console.warn('Templates no localStorage inválidos. Restaurando padrões.');
          setTemplates(DEFAULT_TEMPLATES);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
        } else {
          setTemplates(validTemplates);
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        setTemplates(DEFAULT_TEMPLATES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      }
    } else {
      console.log('Nenhum template encontrado. Carregando templates padrão.');
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
