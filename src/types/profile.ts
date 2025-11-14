export interface Profile {
  id: string;
  nome: string;
  telefone: string;
  telegram?: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ClienteData {
  id: string;
  user_id: string;
  situacao: 'Testando' | 'Ativo' | 'Devendo' | 'Inativo' | 'Lead';
  data_contratacao: string;
  data_vencimento: string;
  plano: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
  valor_pago: number;
  data_ultimo_pagamento: string;
  forma_ultimo_pagamento: string;
  mac_smart_one: string;
  usuario_m3u: string;
  senha_m3u: string;
  data_cadastro: string;
  data_ultima_edicao: string;
  cliente_ativo?: boolean;
  smartone_status?: 'nao_enviado' | 'pendente' | 'criado' | 'erro';
  smartone_playlist_id?: string;
  smartone_raw_response?: string;
  smartone_last_sync_at?: string;
  origem_cadastro?: 'Google Ads' | 'Facebook' | 'Instagram' | 'Indicação' | 'Website' | 'Outro';
}

export interface ClienteComPerfil extends ClienteData {
  profile: Profile;
}
