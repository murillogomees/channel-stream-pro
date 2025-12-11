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
      // Use notification_templates table instead of whatsapp_templates
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedTemplates: WhatsappTemplate[] = data.map(t => ({
          id: t.id,
          name: t.template_name,
          message: t.template_content,
          variables: (t.variables as string[] | null) || [],
          type: 'local' as const,
          eventType: t.template_key as any,
          daysBeforeDue: 0,
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
          template_name: template.name,
          template_key: template.eventType || template.name.toLowerCase().replace(/\s+/g, '_'),
          template_content: template.message,
          variables: template.variables || [],
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: WhatsappTemplate = {
        id: data.id,
        name: data.template_name,
        message: data.template_content,
        variables: (data.variables as string[] | null) || [],
        type: 'local' as const,
        eventType: data.template_key as any,
        daysBeforeDue: 0,
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
      
      if (data.name) updateData.template_name = data.name;
      if (data.message) updateData.template_content = data.message;
      if (data.variables) updateData.variables = data.variables;
      if (data.eventType) updateData.template_key = data.eventType;

      const { error } = await supabase
        .from('notification_templates')
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
          template_name: t.name,
          template_key: t.eventType || t.name.toLowerCase().replace(/\s+/g, '_'),
          template_content: t.message,
          variables: t.variables || [],
          is_active: true,
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
