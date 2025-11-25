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
        .from('whatsapp_templates')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedTemplates: WhatsappTemplate[] = data.map(t => ({
          id: t.id,
          name: t.name,
          message: t.message,
          variables: t.variables || [],
          type: t.type as 'local' | 'botbot',
          eventType: t.event_type as any,
          daysBeforeDue: t.days_before_due,
          botbotTemplateId: t.botbot_template_id,
          arquivo: t.arquivo as any,
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
        .from('whatsapp_templates')
        .insert({
          name: template.name,
          message: template.message,
          variables: template.variables || [],
          type: template.type,
          event_type: template.eventType,
          days_before_due: template.daysBeforeDue,
          botbot_template_id: template.botbotTemplateId,
          arquivo: template.arquivo,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: WhatsappTemplate = {
        id: data.id,
        name: data.name,
        message: data.message,
        variables: data.variables || [],
        type: data.type as 'local' | 'botbot',
        eventType: data.event_type as any,
        daysBeforeDue: data.days_before_due,
        botbotTemplateId: data.botbot_template_id,
        arquivo: data.arquivo as any,
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
      const updateData: any = {};
      
      if (data.name) updateData.name = data.name;
      if (data.message) updateData.message = data.message;
      if (data.variables) updateData.variables = data.variables;
      if (data.type) updateData.type = data.type;
      if (data.eventType) updateData.event_type = data.eventType;
      if (data.daysBeforeDue !== undefined) updateData.days_before_due = data.daysBeforeDue;
      if (data.botbotTemplateId) updateData.botbot_template_id = data.botbotTemplateId;
      if (data.arquivo) updateData.arquivo = data.arquivo;

      const { error } = await supabase
        .from('whatsapp_templates')
        .update(updateData)
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
        .from('whatsapp_templates')
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
      await supabase.from('whatsapp_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Insert default templates
      const { error } = await supabase.from('whatsapp_templates').insert(
        DEFAULT_TEMPLATES.map(t => ({
          name: t.name,
          message: t.message,
          variables: t.variables || [],
          type: t.type,
          event_type: t.eventType,
          days_before_due: t.daysBeforeDue,
          botbot_template_id: t.botbotTemplateId,
          arquivo: t.arquivo,
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
