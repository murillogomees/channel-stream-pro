export type SituacaoCliente = 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead';
export type PlanoCliente = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
export type FormaPagamento = 
  | 'PIX' 
  | 'TED' 
  | 'Boleto' 
  | 'Cartão de Crédito' 
  | 'Cartão de Débito' 
  | 'Dinheiro'
  | 'Saldo Mercado Pago'
  | 'Outro';
export type OrigemCadastro = 'Google Ads' | 'Facebook' | 'Instagram' | 'Indicação' | 'Website' | 'Outro';
export type DispositivoTipo =
  | 'smart_tv'
  | 'roku_tv'
  | 'fire_stick'
  | 'android_tv'
  | 'celular_android'
  | 'celular_ios'
  | 'computador'
  | 'mac'
  | 'tablet_android'
  | 'tablet_ios'
  | 'chromecast'
  | 'apple_tv'
  | 'xbox'
  | 'playstation';

/**
 * TIPO UNIFICADO - Fonte única da verdade
 * Representa cliente no formato do banco de dados (snake_case)
 */
export interface ClienteDb {
  id: string;
  user_id?: string;
  nome: string;
  telefone: string;
  email?: string;
  situacao: SituacaoCliente;
  data_contratacao: string;
  data_vencimento: string;
  plano: PlanoCliente;
  valor_pago: number;
  data_ultimo_pagamento?: string;
  forma_ultimo_pagamento?: string;
  usuario_m3u?: string;
  senha_m3u?: string;
  data_cadastro: string;
  data_ultima_edicao: string;
  cliente_ativo?: boolean;
  origem_cadastro?: OrigemCadastro;
  is_recorrente?: boolean;
  dispositivo_contratado?: DispositivoTipo;
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
  email?: string;
  situacao: SituacaoCliente;
  dataContratacao: string;
  dataVencimento: string;
  plano: PlanoCliente;
  valorPago: number;
  dataUltimoPagamento?: string;
  formaUltimoPagamento?: string;
  usuarioM3u?: string;
  senhaM3u?: string;
  dataCadastro: string;
  dataUltimaEdicao: string;
  clienteAtivo?: boolean;
  origemCadastro?: OrigemCadastro;
  isRecorrente?: boolean;
  dispositivoContratado?: DispositivoTipo;
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
    email: db.email,
    situacao: db.situacao,
    dataContratacao: db.data_contratacao,
    dataVencimento: db.data_vencimento,
    plano: db.plano,
    valorPago: db.valor_pago,
    dataUltimoPagamento: db.data_ultimo_pagamento,
    formaUltimoPagamento: db.forma_ultimo_pagamento,
    usuarioM3u: db.usuario_m3u,
    senhaM3u: db.senha_m3u,
    dataCadastro: db.data_cadastro,
    dataUltimaEdicao: db.data_ultima_edicao,
    clienteAtivo: db.cliente_ativo,
    origemCadastro: db.origem_cadastro,
    isRecorrente: db.is_recorrente,
    dispositivoContratado: db.dispositivo_contratado,
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
    email: cliente.email,
    situacao: cliente.situacao,
    data_contratacao: cliente.dataContratacao,
    data_vencimento: cliente.dataVencimento,
    plano: cliente.plano,
    valor_pago: cliente.valorPago,
    data_ultimo_pagamento: cliente.dataUltimoPagamento,
    forma_ultimo_pagamento: cliente.formaUltimoPagamento,
    usuario_m3u: cliente.usuarioM3u,
    senha_m3u: cliente.senhaM3u,
    data_cadastro: cliente.dataCadastro,
    data_ultima_edicao: cliente.dataUltimaEdicao,
    cliente_ativo: cliente.clienteAtivo,
    origem_cadastro: cliente.origemCadastro,
    is_recorrente: cliente.isRecorrente,
    dispositivo_contratado: cliente.dispositivoContratado,
  };
}
