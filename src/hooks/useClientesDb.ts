import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, ClienteDb, dbToCliente, clienteToDb } from '@/types/cliente';

export function useClientesDb() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Admins devem ver todos os clientes (não filtrar por user_id)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('data_cadastro', { ascending: false });

      if (error) throw error;

      setClientes((data || []).map(dbToCliente));
    } catch (e: any) {
      console.error('Erro ao carregar clientes:', e);
      setError(e?.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const addCliente = useCallback(async (clienteData: Partial<Cliente>) => {
    const dbData = clienteToDb(clienteData);
    const { data, error } = await supabase
      .from('clientes')
      .insert([dbData as any])
      .select()
      .single();
    
    if (error) throw error;
    if (data) {
      const newCliente = dbToCliente(data);
      setClientes(prev => [newCliente, ...prev]);
      return newCliente;
    }
  }, []);

  const updateCliente = useCallback(async (id: string, clienteData: Partial<Cliente>) => {
    const { data, error } = await supabase
      .from('clientes')
      .update({
        nome: clienteData.nome,
        telefone: clienteData.telefone,
        telegram: clienteData.telegram || null,
        email: clienteData.email || null,
        situacao: clienteData.situacao,
        data_contratacao: clienteData.dataContratacao || null,
        data_vencimento: clienteData.dataVencimento || null,
        plano: clienteData.plano,
        valor_pago: clienteData.valorPago || null,
        data_ultimo_pagamento: clienteData.dataUltimoPagamento || null,
        forma_ultimo_pagamento: clienteData.formaUltimoPagamento || null,
        mac_smart_one: clienteData.macSmartOne || null,
        cliente_ativo: clienteData.clienteAtivo,
        origem_cadastro: clienteData.origemCadastro || null,
        data_ultima_edicao: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (data) {
      const updatedCliente = dbToCliente(data);
      setClientes(prev => prev.map(c => c.id === id ? updatedCliente : c));
      return updatedCliente;
    }
  }, []);

  const deleteCliente = useCallback(async (id: string) => {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
    setClientes(prev => prev.filter(c => c.id !== id));
  }, []);

  const getStats = useCallback(() => {
    const total = clientes.length;
    const now = new Date();
    const cincoProximos = new Date();
    cincoProximos.setDate(now.getDate() + 5);

    const vencendoProximos5Dias = clientes.filter(c => {
      if (!c.dataVencimento) return false;
      const vencimento = new Date(c.dataVencimento);
      return vencimento >= now && vencimento <= cincoProximos;
    }).length;

    const ativosVencidos = clientes.filter(c => {
      if (c.situacao !== 'Ativo' || !c.dataVencimento) return false;
      const vencimento = new Date(c.dataVencimento);
      return vencimento < now;
    }).length;

    return { total, vencendoProximos5Dias, ativosVencidos };
  }, [clientes]);

  const stats = useMemo(() => getStats(), [getStats]);

  return {
    clientes,
    loading,
    error,
    refresh: fetchClientes,
    addCliente,
    updateCliente,
    deleteCliente,
    getStats: () => stats,
  };
}
