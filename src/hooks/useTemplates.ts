import { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/types/whatsapp';
import { DEFAULT_TEMPLATES } from '@/constants/defaultTemplates';
import { supabase } from '@/integrations/supabase/client';

export const useTemplates = () => {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedTemplates: WhatsappTemplate[] = data.map(t => ({
          id: t.id,
          name: t.name,
          message: t.content,
          variables: t.variables ? Object.keys(t.variables as any) : [],
          type: ((t.variables as any)?.botbotTemplateId ? 'botbot' : 'local') as 'local' | 'botbot',
          eventType: (t.variables as any)?.eventType || 'payment_reminder',
          daysBeforeDue: (t.variables as any)?.daysBeforeDue,
          botbotTemplateId: (t.variables as any)?.botbotTemplateId,
        }));
        setTemplates(mappedTemplates);
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  };

  const addTemplate = async (template: Omit<WhatsappTemplate, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .insert({
          name: template.name,
          content: template.message,
          variables: {
            eventType: template.eventType,
            daysBeforeDue: template.daysBeforeDue,
            botbotTemplateId: template.botbotTemplateId,
          },
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: WhatsappTemplate = {
        id: data.id,
        name: data.name,
        message: data.content,
        variables: data.variables ? Object.keys(data.variables as any) : [],
        type: ((data.variables as any)?.botbotTemplateId ? 'botbot' : 'local') as 'local' | 'botbot',
        eventType: (data.variables as any).eventType,
        daysBeforeDue: (data.variables as any).daysBeforeDue,
        botbotTemplateId: (data.variables as any).botbotTemplateId,
      };

      setTemplates([...templates, newTemplate]);
      return newTemplate;
    } catch (error) {
      console.error('Erro ao adicionar template:', error);
      throw error;
    }
  };

  const updateTemplate = async (id: string, data: Partial<WhatsappTemplate>) => {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .update({
          name: data.name,
          content: data.message,
          variables: {
            eventType: data.eventType,
            daysBeforeDue: data.daysBeforeDue,
            botbotTemplateId: data.botbotTemplateId,
          },
        })
        .eq('id', id);

      if (error) throw error;

      const updated = templates.map(t => 
        t.id === id ? { ...t, ...data } : t
      );
      setTemplates(updated);
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const updated = templates.filter(t => t.id !== id);
      setTemplates(updated);
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      throw error;
    }
  };

  const getTemplateById = (id: string) => {
    return templates.find(t => t.id === id);
  };

  const resetToDefaults = async () => {
    try {
      // Delete all existing templates
      await supabase.from('notification_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Insert default templates
      const { error } = await supabase.from('notification_templates').insert(
        DEFAULT_TEMPLATES.map(t => ({
          name: t.name,
          content: t.message,
          variables: {
            eventType: t.eventType,
            daysBeforeDue: t.daysBeforeDue,
            botbotTemplateId: t.botbotTemplateId,
          },
          active: true,
        }))
      );

      if (error) throw error;

      await loadTemplates();
    } catch (error) {
      console.error('Erro ao resetar templates:', error);
      throw error;
    }
  };

  const extractVariables = (message: string): string[] => {
    const matches = message.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/[{}]/g, ''));
  };

  return {
    templates,
    loading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    resetToDefaults,
    extractVariables,
  };
};
