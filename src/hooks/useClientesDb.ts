import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, PlanoCliente, SituacaoCliente } from '@/types/cliente';

// Mapeia o registro do banco (snake_case) para o tipo Cliente (camelCase)
function mapDbToCliente(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome ?? '',
    telefone: row.telefone ?? '',
    telegram: row.telegram ?? '',
    email: row.email ?? '',
    situacao: (row.situacao as SituacaoCliente) ?? 'Testando',
    dataContratacao: row.data_contratacao ?? '',
    dataVencimento: row.data_vencimento ?? '',
    plano: (row.plano as PlanoCliente) ?? 'Mensal',
    valorPago: row.valor_pago ?? 0,
    dataUltimoPagamento: row.data_ultimo_pagamento ?? '',
    formaUltimoPagamento: row.forma_ultimo_pagamento ?? '',
    macSmartOne: row.mac_smart_one ?? '',
    usuario: row.usuario_m3u ?? '',
    senha: row.senha_m3u ?? '',
    dataCadastro: row.data_cadastro ?? row.created_at ?? '',
    dataUltimaEdicao: row.data_ultima_edicao ?? row.updated_at ?? '',
    clienteAtivo: row.cliente_ativo ?? undefined,
    smartone_status: row.smartone_status ?? undefined,
    smartone_playlist_id: row.smartone_playlist_id ?? undefined,
    smartone_raw_response: row.smartone_raw_response ?? undefined,
    smartone_last_sync_at: row.smartone_last_sync_at ?? undefined,
    origemCadastro: row.origem_cadastro ?? undefined,
  };
}

export function useClientesDb() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('data_cadastro', { ascending: false });

      if (error) throw error;

      setClientes((data || []).map(mapDbToCliente));
    } catch (e: any) {
      console.error('[useClientesDb] Erro ao carregar clientes:', e);
      setError(e?.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

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
    deleteCliente,
    getStats: () => stats,
  };
}
