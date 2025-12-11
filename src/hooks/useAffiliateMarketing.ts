import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface MarketingMaterial {
  id: string;
  title: string;
  description: string | null;
  type: string;
  content_url: string | null;
  content_text: string | null;
  dimensions: string | null;
  file_size: number | null;
  download_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAffiliateMarketing() {
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterials = async (onlyActive = false) => {
    try {
      let query = supabase
        .from('affiliate_marketing_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (onlyActive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMaterials((data || []) as MarketingMaterial[]);
    } catch (error: any) {
      console.error('Error fetching materials:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const createMaterial = async (material: Omit<MarketingMaterial, 'id' | 'created_at' | 'updated_at' | 'download_count'>) => {
    try {
      const { data, error } = await supabase
        .from('affiliate_marketing_materials')
        .insert(material)
        .select()
        .single();

      if (error) throw error;
      setMaterials(prev => [data as MarketingMaterial, ...prev]);
      toast.success('Material criado com sucesso');
      return data;
    } catch (error: any) {
      console.error('Error creating material:', error);
      toast.error('Erro ao criar material');
      throw error;
    }
  };

  const updateMaterial = async (id: string, updates: Partial<MarketingMaterial>) => {
    try {
      const { data, error } = await supabase
        .from('affiliate_marketing_materials')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setMaterials(prev => prev.map(m => m.id === id ? data as MarketingMaterial : m));
      toast.success('Material atualizado');
      return data;
    } catch (error: any) {
      console.error('Error updating material:', error);
      toast.error('Erro ao atualizar material');
      throw error;
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_marketing_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMaterials(prev => prev.filter(m => m.id !== id));
      toast.success('Material removido');
    } catch (error: any) {
      console.error('Error deleting material:', error);
      toast.error('Erro ao remover material');
      throw error;
    }
  };

  const incrementDownload = async (id: string) => {
    try {
      const material = materials.find(m => m.id === id);
      if (!material) return;

      await supabase
        .from('affiliate_marketing_materials')
        .update({ download_count: (material.download_count || 0) + 1 })
        .eq('id', id);

      setMaterials(prev => prev.map(m => 
        m.id === id ? { ...m, download_count: (m.download_count || 0) + 1 } : m
      ));
    } catch (error: any) {
      console.error('Error incrementing download:', error);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  return {
    materials,
    loading,
    fetchMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    incrementDownload
  };
}
