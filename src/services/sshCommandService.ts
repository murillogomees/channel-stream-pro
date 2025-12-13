import { supabase } from "@/integrations/supabase/client";

interface SSHCommandResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
  command: string;
}

class SSHCommandService {
  async execute(command: string, timeout?: number): Promise<SSHCommandResult> {
    const { data, error } = await supabase.functions.invoke<SSHCommandResult>('ssh-command', {
      body: { command, timeout }
    });

    if (error) {
      throw new Error(`SSH command failed: ${error.message}`);
    }

    return data!;
  }

  // Kong diagnostics
  async getKongLogs(lines = 50): Promise<string> {
    const result = await this.execute(`docker logs supabase-kong --tail ${lines} 2>&1`);
    return result.stdout || result.stderr;
  }

  async getKongConfig(): Promise<string> {
    const result = await this.execute(`docker exec supabase-kong cat /usr/local/kong/declarative/kong.yml 2>&1`);
    return result.stdout || result.stderr;
  }

  async getKongRoutes(): Promise<string> {
    const result = await this.execute(`docker exec supabase-kong curl -s http://localhost:8001/routes 2>&1`);
    return result.stdout || result.stderr;
  }

  async getKongServices(): Promise<string> {
    const result = await this.execute(`docker exec supabase-kong curl -s http://localhost:8001/services 2>&1`);
    return result.stdout || result.stderr;
  }

  async getContainerStatus(): Promise<string> {
    const result = await this.execute(`docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep supabase 2>&1`);
    return result.stdout || result.stderr;
  }

  async testPostgrestConnection(): Promise<string> {
    const result = await this.execute(`docker exec supabase-kong curl -s http://supabase-rest:3000/ 2>&1`);
    return result.stdout || result.stderr;
  }

  async testAuthConnection(): Promise<string> {
    const result = await this.execute(`docker exec supabase-kong curl -s http://supabase-auth:9999/health 2>&1`);
    return result.stdout || result.stderr;
  }

  // Generic docker commands
  async dockerExec(container: string, cmd: string): Promise<SSHCommandResult> {
    return this.execute(`docker exec ${container} ${cmd}`);
  }

  async restartContainer(container: string): Promise<SSHCommandResult> {
    return this.execute(`docker restart ${container}`);
  }
}

export const sshCommandService = new SSHCommandService();
