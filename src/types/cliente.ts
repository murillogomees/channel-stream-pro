export type SituacaoCliente = 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead';
export type PlanoCliente = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
export type FormaPagamento = 'Pix' | 'TED' | 'Boleto' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Dinheiro';

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
  formaUltimoPagamento: FormaPagamento | string;
  macSmartOne: string;
  dataCadastro: string;
  dataUltimaEdicao: string;
  clienteAtivo?: boolean; // Indica se o cliente está usando os serviços atualmente
  smartone_status?: 'nao_enviado' | 'pendente' | 'criado' | 'erro';
  smartone_playlist_id?: string;
  smartone_raw_response?: string;
  smartone_last_sync_at?: string;
  origemCadastro?: 'Google Ads' | 'Facebook' | 'Instagram' | 'Indicação' | 'Website' | 'Outro';
}
