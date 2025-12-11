import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HomepageContent {
  id: string;
  section_key: string;
  content: Record<string, any>;
  updated_at: string;
}

export interface HomepageFAQ {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useHomepageContent() {
  const [content, setContent] = useState<Record<string, HomepageContent>>({});
  const [faqs, setFaqs] = useState<HomepageFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homepage_content')
        .select('*');

      if (error) throw error;

      const contentMap: Record<string, HomepageContent> = {};
      data?.forEach(item => {
        contentMap[item.section_key] = {
          id: item.id,
          section_key: item.section_key,
          content: item.content as Record<string, any>,
          updated_at: item.updated_at,
        };
      });
      setContent(contentMap);
    } catch (error) {
      console.error('Erro ao buscar conteúdo:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFAQs = async (includeInactive = false) => {
    try {
      let query = supabase
        .from('homepage_faqs')
        .select('*')
        .order('display_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Erro ao buscar FAQs:', error);
    }
  };

  const updateContent = async (sectionKey: string, newContent: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('homepage_content')
        .update({ content: newContent })
        .eq('section_key', sectionKey);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conteúdo atualizado com sucesso!",
      });

      await fetchContent();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar conteúdo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o conteúdo.",
        variant: "destructive",
      });
      return false;
    }
  };

  const createFAQ = async (faq: Omit<HomepageFAQ, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('homepage_faqs')
        .insert(faq)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "FAQ criada com sucesso!",
      });

      await fetchFAQs(true);
      return data;
    } catch (error) {
      console.error('Erro ao criar FAQ:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a FAQ.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateFAQ = async (id: string, updates: Partial<HomepageFAQ>) => {
    try {
      const { error } = await supabase
        .from('homepage_faqs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "FAQ atualizada com sucesso!",
      });

      await fetchFAQs(true);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar FAQ:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a FAQ.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteFAQ = async (id: string) => {
    try {
      const { error } = await supabase
        .from('homepage_faqs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "FAQ excluída com sucesso!",
      });

      await fetchFAQs(true);
      return true;
    } catch (error) {
      console.error('Erro ao excluir FAQ:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a FAQ.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchContent();
    fetchFAQs();
  }, []);

  return {
    content,
    faqs,
    loading,
    fetchContent,
    fetchFAQs,
    updateContent,
    createFAQ,
    updateFAQ,
    deleteFAQ,
  };
}
