export type SituacaoCliente = 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead' | '';
export type PlanoCliente = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | '';

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
}
