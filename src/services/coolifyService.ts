import { supabase } from "@/lib/supabase";

export interface CoolifyResponse<T = unknown> {
  success: boolean;
  status: number;
  statusText: string;
  data: T;
  meta: {
    endpoint: string;
    method: string;
    timestamp: string;
  };
  error?: string;
}

export interface CoolifyServer {
  uuid: string;
  name: string;
  description?: string;
  ip: string;
  user: string;
  port: number;
  is_reachable: boolean;
  is_usable: boolean;
  settings?: Record<string, unknown>;
}

export interface CoolifyProject {
  uuid: string;
  name: string;
  description?: string;
  environments?: CoolifyEnvironment[];
}

export interface CoolifyEnvironment {
  id: number;
  name: string;
  project_uuid: string;
  created_at: string;
  updated_at: string;
}

export interface CoolifyServiceType {
  uuid: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  created_at: string;
  updated_at: string;
}

export interface CoolifyApplication {
  uuid: string;
  name: string;
  description?: string;
  status: string;
  fqdn?: string;
  git_repository?: string;
  git_branch?: string;
  build_pack?: string;
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
}

export interface CoolifyDatabase {
  uuid: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  public_port?: number;
}

export interface CoolifyDeployment {
  uuid: string;
  status: string;
  commit?: string;
  commit_message?: string;
  created_at: string;
  application_uuid?: string;
}

// Available Coolify API Actions
export const COOLIFY_ACTIONS = {
  // Health & Version
  health: { name: 'Health Check', description: 'Verificar saúde da API', category: 'Sistema' },
  version: { name: 'Versão', description: 'Obter versão do Coolify', category: 'Sistema' },
  
  // Servers
  'list-servers': { name: 'Listar Servidores', description: 'Lista todos os servidores gerenciados', category: 'Servidores' },
  'get-server': { name: 'Detalhes do Servidor', description: 'Obtém detalhes de um servidor específico', category: 'Servidores' },
  'get-server-resources': { name: 'Recursos do Servidor', description: 'Lista recursos (containers, apps) do servidor', category: 'Servidores' },
  'get-server-domains': { name: 'Domínios do Servidor', description: 'Lista domínios configurados no servidor', category: 'Servidores' },
  'validate-server': { name: 'Validar Servidor', description: 'Valida conectividade e configuração', category: 'Servidores' },
  
  // Projects
  'list-projects': { name: 'Listar Projetos', description: 'Lista todos os projetos', category: 'Projetos' },
  'get-project': { name: 'Detalhes do Projeto', description: 'Obtém detalhes de um projeto', category: 'Projetos' },
  'create-project': { name: 'Criar Projeto', description: 'Cria um novo projeto', category: 'Projetos' },
  'update-project': { name: 'Atualizar Projeto', description: 'Atualiza configurações do projeto', category: 'Projetos' },
  'delete-project': { name: 'Deletar Projeto', description: 'Remove um projeto (DESTRUTIVO)', category: 'Projetos' },
  
  // Services
  'list-services': { name: 'Listar Serviços', description: 'Lista todos os serviços', category: 'Serviços' },
  'get-service': { name: 'Detalhes do Serviço', description: 'Obtém detalhes de um serviço', category: 'Serviços' },
  'start-service': { name: 'Iniciar Serviço', description: 'Inicia um serviço parado', category: 'Serviços' },
  'stop-service': { name: 'Parar Serviço', description: 'Para um serviço em execução', category: 'Serviços' },
  'restart-service': { name: 'Reiniciar Serviço', description: 'Reinicia um serviço', category: 'Serviços' },
  'delete-service': { name: 'Deletar Serviço', description: 'Remove um serviço (DESTRUTIVO)', category: 'Serviços' },
  
  // Applications
  'list-applications': { name: 'Listar Aplicações', description: 'Lista todas as aplicações', category: 'Aplicações' },
  'get-application': { name: 'Detalhes da Aplicação', description: 'Obtém detalhes de uma aplicação', category: 'Aplicações' },
  'create-application': { name: 'Criar Aplicação', description: 'Cria uma nova aplicação', category: 'Aplicações' },
  'update-application': { name: 'Atualizar Aplicação', description: 'Atualiza configurações da aplicação', category: 'Aplicações' },
  'delete-application': { name: 'Deletar Aplicação', description: 'Remove uma aplicação (DESTRUTIVO)', category: 'Aplicações' },
  'start-application': { name: 'Iniciar Aplicação', description: 'Inicia uma aplicação parada', category: 'Aplicações' },
  'stop-application': { name: 'Parar Aplicação', description: 'Para uma aplicação em execução', category: 'Aplicações' },
  'restart-application': { name: 'Reiniciar Aplicação', description: 'Reinicia uma aplicação', category: 'Aplicações' },
  'get-application-logs': { name: 'Logs da Aplicação', description: 'Obtém logs de uma aplicação', category: 'Aplicações' },
  'get-application-envs': { name: 'Variáveis de Ambiente', description: 'Lista variáveis de ambiente', category: 'Aplicações' },
  'update-application-envs': { name: 'Atualizar Variáveis', description: 'Atualiza variáveis de ambiente', category: 'Aplicações' },
  
  // Databases
  'list-databases': { name: 'Listar Bancos', description: 'Lista todos os bancos de dados', category: 'Bancos de Dados' },
  'get-database': { name: 'Detalhes do Banco', description: 'Obtém detalhes de um banco', category: 'Bancos de Dados' },
  'create-database': { name: 'Criar Banco', description: 'Cria um novo banco de dados', category: 'Bancos de Dados' },
  'update-database': { name: 'Atualizar Banco', description: 'Atualiza configurações do banco', category: 'Bancos de Dados' },
  'delete-database': { name: 'Deletar Banco', description: 'Remove um banco (DESTRUTIVO)', category: 'Bancos de Dados' },
  'start-database': { name: 'Iniciar Banco', description: 'Inicia um banco parado', category: 'Bancos de Dados' },
  'stop-database': { name: 'Parar Banco', description: 'Para um banco em execução', category: 'Bancos de Dados' },
  'restart-database': { name: 'Reiniciar Banco', description: 'Reinicia um banco', category: 'Bancos de Dados' },
  
  // Deployments
  deploy: { name: 'Deploy', description: 'Dispara deploy de um recurso', category: 'Deploys' },
  'list-deployments': { name: 'Listar Deploys', description: 'Lista todos os deployments', category: 'Deploys' },
  'get-deployment': { name: 'Detalhes do Deploy', description: 'Obtém detalhes de um deploy', category: 'Deploys' },
  
  // Teams
  'list-teams': { name: 'Listar Times', description: 'Lista todos os times', category: 'Times' },
  'get-team': { name: 'Detalhes do Time', description: 'Obtém detalhes de um time', category: 'Times' },
  'get-team-members': { name: 'Membros do Time', description: 'Lista membros de um time', category: 'Times' },
  
  // Private Keys
  'list-private-keys': { name: 'Listar Chaves SSH', description: 'Lista chaves privadas', category: 'Segurança' },
  'create-private-key': { name: 'Criar Chave SSH', description: 'Adiciona nova chave privada', category: 'Segurança' },
  'delete-private-key': { name: 'Deletar Chave SSH', description: 'Remove uma chave privada', category: 'Segurança' },
  
  // Resources
  'list-resources': { name: 'Listar Recursos', description: 'Overview de todos os recursos', category: 'Sistema' },
} as const;

export type CoolifyAction = keyof typeof COOLIFY_ACTIONS;

class CoolifyClient {
  private async callApi<T = unknown>(
    action: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>
  ): Promise<CoolifyResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke('coolify-api', {
        body: { action, params, body }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as CoolifyResponse<T>;
    } catch (err) {
      console.error('Coolify API Error:', err);
      throw err;
    }
  }

  // Health & Version
  async getHealth() {
    return this.callApi<{ status: string }>('health');
  }

  async getVersion() {
    return this.callApi<string>('version');
  }

  // Servers
  async listServers() {
    return this.callApi<CoolifyServer[]>('list-servers');
  }

  async getServer(uuid: string) {
    return this.callApi<CoolifyServer>('get-server', { uuid });
  }

  async getServerResources(uuid: string) {
    return this.callApi('get-server-resources', { uuid });
  }

  async getServerDomains(uuid: string) {
    return this.callApi('get-server-domains', { uuid });
  }

  async validateServer(uuid: string) {
    return this.callApi('validate-server', { uuid });
  }

  // Projects
  async listProjects() {
    return this.callApi<CoolifyProject[]>('list-projects');
  }

  async getProject(uuid: string) {
    return this.callApi<CoolifyProject>('get-project', { uuid });
  }

  async createProject(name: string, description?: string) {
    return this.callApi('create-project', undefined, { name, description });
  }

  async updateProject(uuid: string, data: Partial<CoolifyProject>) {
    return this.callApi('update-project', { uuid }, data);
  }

  async deleteProject(uuid: string) {
    return this.callApi('delete-project', { uuid });
  }

  // Services
  async listServices() {
    return this.callApi<CoolifyServiceType[]>('list-services');
  }

  async getService(uuid: string) {
    return this.callApi<CoolifyServiceType>('get-service', { uuid });
  }

  async startService(uuid: string) {
    return this.callApi('start-service', { uuid });
  }

  async stopService(uuid: string) {
    return this.callApi('stop-service', { uuid });
  }

  async restartService(uuid: string) {
    return this.callApi('restart-service', { uuid });
  }

  async deleteService(uuid: string) {
    return this.callApi('delete-service', { uuid });
  }

  // Applications
  async listApplications() {
    return this.callApi<CoolifyApplication[]>('list-applications');
  }

  async getApplication(uuid: string) {
    return this.callApi<CoolifyApplication>('get-application', { uuid });
  }

  async startApplication(uuid: string) {
    return this.callApi('start-application', { uuid });
  }

  async stopApplication(uuid: string) {
    return this.callApi('stop-application', { uuid });
  }

  async restartApplication(uuid: string) {
    return this.callApi('restart-application', { uuid });
  }

  async getApplicationLogs(uuid: string) {
    return this.callApi('get-application-logs', { uuid });
  }

  async getApplicationEnvs(uuid: string) {
    return this.callApi('get-application-envs', { uuid });
  }

  // Databases
  async listDatabases() {
    return this.callApi<CoolifyDatabase[]>('list-databases');
  }

  async getDatabase(uuid: string) {
    return this.callApi<CoolifyDatabase>('get-database', { uuid });
  }

  async startDatabase(uuid: string) {
    return this.callApi('start-database', { uuid });
  }

  async stopDatabase(uuid: string) {
    return this.callApi('stop-database', { uuid });
  }

  async restartDatabase(uuid: string) {
    return this.callApi('restart-database', { uuid });
  }

  // Deployments
  async deploy(uuid: string, force = false) {
    return this.callApi('deploy', { uuid, force: String(force) });
  }

  async listDeployments() {
    return this.callApi<CoolifyDeployment[]>('list-deployments');
  }

  async getDeployment(uuid: string) {
    return this.callApi<CoolifyDeployment>('get-deployment', { uuid });
  }

  // Teams
  async listTeams() {
    return this.callApi('list-teams');
  }

  async getTeam(id: string) {
    return this.callApi('get-team', { id });
  }

  async getTeamMembers(id: string) {
    return this.callApi('get-team-members', { id });
  }

  // Resources Overview
  async listResources() {
    return this.callApi('list-resources');
  }

  // SSH Keys Management
  async listPrivateKeys() {
    return this.callApi<CoolifySSHKey[]>('list-private-keys');
  }

  async createPrivateKey(name: string, privateKey: string, description?: string) {
    return this.callApi('create-private-key', undefined, { 
      name, 
      private_key: privateKey,
      description 
    });
  }

  async deletePrivateKey(uuid: string) {
    return this.callApi('delete-private-key', { uuid });
  }

  // Generic call for custom endpoints
  async call<T = unknown>(
    action: string,
    params?: Record<string, string>,
    body?: Record<string, unknown>
  ) {
    return this.callApi<T>(action, params, body);
  }
}

// SSH Key interface
export interface CoolifySSHKey {
  uuid: string;
  name: string;
  description?: string;
  public_key?: string;
  fingerprint?: string;
  created_at: string;
  updated_at: string;
  team_id?: number;
  is_git_related?: boolean;
}

export const coolifyService = new CoolifyClient();
