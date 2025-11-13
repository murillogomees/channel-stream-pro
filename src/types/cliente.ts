export type SituacaoCliente = 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead';
export type PlanoCliente = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  telegram: string;
  email: string;
  situacao: SituacaoCliente;
  dataContratacao: string;
  dataVencimento: string;
  plano: PlanoCliente;
  valorPago: number;
  dataUltimoPagamento: string;
  formaUltimoPagamento: string;
  macSmartOne: string;
  usuario: string;
  senha: string;
  dataCadastro: string;
  dataUltimaEdicao: string;
  clienteAtivo?: boolean; // Indica se o cliente está usando os serviços atualmente
  smartone_status?: 'nao_enviado' | 'pendente' | 'criado' | 'erro';
  smartone_playlist_id?: string;
  smartone_raw_response?: string;
  smartone_last_sync_at?: string;
}
