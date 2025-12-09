import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  period: string;
  period_months: number;
  features: string[];
  cta_text: string;
  is_highlighted: boolean;
  savings_amount: number | null;
  savings_percent: number | null;
  is_active: boolean;
  display_order: number;
  whatsapp_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPlans = async (includeInactive = false) => {
    try {
      setLoading(true);
      let query = supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPlans((data || []).map(p => ({
        ...p,
        features: (p.features as string[] | null) || [],
      })));
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os planos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async (plan: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert(plan)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Plano criado com sucesso!",
      });
      
      await fetchPlans(true);
      return data;
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o plano.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updatePlan = async (id: string, updates: Partial<SubscriptionPlan>) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Plano atualizado com sucesso!",
      });
      
      await fetchPlans(true);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o plano.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Plano excluído com sucesso!",
      });
      
      await fetchPlans(true);
      return true;
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o plano.",
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderPlans = async (planIds: string[]) => {
    try {
      const updates = planIds.map((id, index) => ({
        id,
        display_order: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('subscription_plans')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      await fetchPlans(true);
      return true;
    } catch (error) {
      console.error('Erro ao reordenar planos:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return {
    plans,
    loading,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    reorderPlans,
  };
}
