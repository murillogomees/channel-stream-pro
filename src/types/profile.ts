import { ClienteDb } from './cliente';

export interface Profile {
  id: string;
  nome: string;
  telefone: string;
  telegram?: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Use ClienteDb from './cliente' instead
 */
export type ClienteData = ClienteDb;

export interface ClienteComPerfil extends ClienteDb {
  profile: Profile;
}
