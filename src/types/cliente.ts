export type SituacaoCliente = 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead';
export type PlanoCliente = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
export type FormaPagamento = 'Pix' | 'TED' | 'Boleto' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Dinheiro';
export type OrigemCadastro = 'Google Ads' | 'Facebook' | 'Instagram' | 'Indicação' | 'Website' | 'Outro';
export type SmartoneStatus = 'nao_enviado' | 'pendente' | 'criado' | 'erro';

/**
 * TIPO UNIFICADO - Fonte única da verdade
 * Representa cliente no formato do banco de dados (snake_case)
 */
export interface ClienteDb {
  id: string;
  user_id?: string;
  nome: string;
  telefone: string;
  telegram?: string;
  email?: string;
  situacao: SituacaoCliente;
  data_contratacao: string;
  data_vencimento: string;
  plano: PlanoCliente;
  valor_pago: number;
  data_ultimo_pagamento?: string;
  forma_ultimo_pagamento?: string;
  mac_smart_one?: string;
  usuario_m3u?: string;
  senha_m3u?: string;
  data_cadastro: string;
  data_ultima_edicao: string;
  cliente_ativo?: boolean;
  smartone_status?: SmartoneStatus;
  smartone_playlist_id?: string;
  smartone_raw_response?: string;
  smartone_last_sync_at?: string;
  origem_cadastro?: OrigemCadastro;
  is_recorrente?: boolean;
}

/**
 * Tipo para uso no frontend (camelCase) - compatibilidade legacy
 * @deprecated Use ClienteDb diretamente quando possível
 */
export interface Cliente {
  id: string;
  userId?: string;
  nome: string;
  telefone: string;
  telegram?: string;
  email?: string;
  situacao: SituacaoCliente;
  dataContratacao: string;
  dataVencimento: string;
  plano: PlanoCliente;
  valorPago: number;
  dataUltimoPagamento?: string;
  formaUltimoPagamento?: string;
  macSmartOne?: string;
  usuarioM3u?: string;
  senhaM3u?: string;
  dataCadastro: string;
  dataUltimaEdicao: string;
  clienteAtivo?: boolean;
  smartone_status?: SmartoneStatus;
  smartone_playlist_id?: string;
  smartone_raw_response?: string;
  smartone_last_sync_at?: string;
  origemCadastro?: OrigemCadastro;
  isRecorrente?: boolean;
}

/**
 * Converte ClienteDb (snake_case) para Cliente (camelCase)
 */
export function dbToCliente(db: ClienteDb): Cliente {
  return {
    id: db.id,
    userId: db.user_id,
    nome: db.nome,
    telefone: db.telefone,
    telegram: db.telegram,
    email: db.email,
    situacao: db.situacao,
    dataContratacao: db.data_contratacao,
    dataVencimento: db.data_vencimento,
    plano: db.plano,
    valorPago: db.valor_pago,
    dataUltimoPagamento: db.data_ultimo_pagamento,
    formaUltimoPagamento: db.forma_ultimo_pagamento,
    macSmartOne: db.mac_smart_one,
    usuarioM3u: db.usuario_m3u,
    senhaM3u: db.senha_m3u,
    dataCadastro: db.data_cadastro,
    dataUltimaEdicao: db.data_ultima_edicao,
    clienteAtivo: db.cliente_ativo,
    smartone_status: db.smartone_status,
    smartone_playlist_id: db.smartone_playlist_id,
    smartone_raw_response: db.smartone_raw_response,
    smartone_last_sync_at: db.smartone_last_sync_at,
    origemCadastro: db.origem_cadastro,
    isRecorrente: db.is_recorrente,
  };
}

/**
 * Converte Cliente (camelCase) para ClienteDb (snake_case)
 */
export function clienteToDb(cliente: Partial<Cliente>): Partial<ClienteDb> {
  return {
    id: cliente.id,
    user_id: cliente.userId,
    nome: cliente.nome,
    telefone: cliente.telefone,
    telegram: cliente.telegram,
    email: cliente.email,
    situacao: cliente.situacao,
    data_contratacao: cliente.dataContratacao,
    data_vencimento: cliente.dataVencimento,
    plano: cliente.plano,
    valor_pago: cliente.valorPago,
    data_ultimo_pagamento: cliente.dataUltimoPagamento,
    forma_ultimo_pagamento: cliente.formaUltimoPagamento,
    mac_smart_one: cliente.macSmartOne,
    usuario_m3u: cliente.usuarioM3u,
    senha_m3u: cliente.senhaM3u,
    data_cadastro: cliente.dataCadastro,
    data_ultima_edicao: cliente.dataUltimaEdicao,
    cliente_ativo: cliente.clienteAtivo,
    smartone_status: cliente.smartone_status,
    smartone_playlist_id: cliente.smartone_playlist_id,
    smartone_raw_response: cliente.smartone_raw_response,
    smartone_last_sync_at: cliente.smartone_last_sync_at,
    origem_cadastro: cliente.origemCadastro,
    is_recorrente: cliente.isRecorrente,
  };
}
