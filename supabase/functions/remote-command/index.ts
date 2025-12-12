import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COOLIFY_URL = "https://dashboard.iptvlink.com.br";
const COOLIFY_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface RemoteCommandRequest {
  action: 'apply-ssh-key' | 'execute-command' | 'backup-authorized-keys' | 'rollback' | 'verify-connection';
  host: string;
  user: string;
  environment: 'dev' | 'staging' | 'prod';
  serverUuid?: string;
  publicKey?: string;
  keyId?: string;
  command?: string;
  auditId?: string;
}

interface AuditLogEntry {
  audit_id: string;
  action: string;
  host: string;
  user: string;
  environment: string;
  key_source: 'coolify' | 'manual';
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  details: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  backup_reference?: string;
}

// Generate UUID for audit tracking
function generateAuditId(): string {
  return crypto.randomUUID();
}

// Validate SSH public key format
function validatePublicKey(key: string): boolean {
  const validPrefixes = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'];
  return validPrefixes.some(prefix => key.trim().startsWith(prefix));
}

// Log audit entry to database
async function logAudit(supabase: ReturnType<typeof createClient>, entry: AuditLogEntry): Promise<void> {
  try {
    // Map to database column names
    await supabase.from('remote_command_audit').insert({
      audit_id: entry.audit_id,
      action: entry.action,
      host: entry.host,
      user_remote: entry.user, // maps to user_remote column
      environment: entry.environment,
      key_source: entry.key_source,
      status: entry.status,
      details: JSON.parse(entry.details || '{}'),
      created_at: entry.created_at,
      completed_at: entry.completed_at,
      backup_reference: entry.backup_reference,
      error_message: entry.error_message,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

// Get SSH keys from Coolify
async function getCoolifySSHKeys(): Promise<Array<{ uuid: string; name: string; public_key: string }>> {
  const response = await fetch(`${COOLIFY_URL}/api/v1/security/keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${COOLIFY_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch SSH keys: ${response.status}`);
  }

  return response.json();
}

// Execute command on server via Coolify (if supported)
async function executeViaContainer(
  serverUuid: string,
  containerName: string,
  command: string
): Promise<{ success: boolean; output: string }> {
  // Note: Coolify API may not directly support SSH command execution
  // This would require a custom script or agent on the server
  
  // For now, we'll document the command that needs to be executed
  console.log(`Command to execute on ${containerName}: ${command}`);
  
  return {
    success: true,
    output: `Command prepared for execution: ${command}`,
  };
}

// Verify user has master role
async function verifyMasterRole(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'master')
    .single();

  return !error && data !== null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify master role
    const isMaster = await verifyMasterRole(supabase, user.id);
    if (!isMaster) {
      return new Response(JSON.stringify({ error: 'Access denied. Master role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request = await req.json() as RemoteCommandRequest;
    const auditId = request.auditId || generateAuditId();

    // Create initial audit entry
    const auditEntry: AuditLogEntry = {
      audit_id: auditId,
      action: request.action,
      host: request.host,
      user: request.user,
      environment: request.environment,
      key_source: request.keyId ? 'coolify' : 'manual',
      status: 'pending',
      details: JSON.stringify(request),
      created_at: new Date().toISOString(),
    };

    await logAudit(supabase, auditEntry);

    let result: Record<string, unknown> = {};

    switch (request.action) {
      case 'apply-ssh-key': {
        // Get public key (from Coolify or manual)
        let publicKey = request.publicKey;
        
        if (request.keyId) {
          const keys = await getCoolifySSHKeys();
          const key = keys.find(k => k.uuid === request.keyId);
          if (!key) {
            throw new Error(`SSH key not found: ${request.keyId}`);
          }
          publicKey = key.public_key;
        }

        if (!publicKey || !validatePublicKey(publicKey)) {
          throw new Error('Invalid SSH public key format');
        }

        // For prod environment, require double confirmation
        if (request.environment === 'prod') {
          // This would be handled by the frontend
          console.log('PROD environment - double confirmation required');
        }

        // Generate commands to execute
        const commands = {
          backup: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-${auditId} 2>/dev/null || true`,
          apply: `grep -F "${publicKey}" ~/.ssh/authorized_keys >/dev/null 2>&1 || echo "${publicKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
          verify: `ssh -o BatchMode=yes -o ConnectTimeout=5 ${request.user}@${request.host} echo ok`,
        };

        result = {
          status: 'commands_generated',
          audit_id: auditId,
          host: request.host,
          user: request.user,
          key_source: request.keyId ? 'coolify' : 'manual',
          commands,
          instructions: [
            '1. Execute backup command first',
            '2. Then apply the SSH key',
            '3. Verify connection with verify command',
            '4. If verification fails, rollback using backup',
          ],
        };

        auditEntry.status = 'success';
        auditEntry.completed_at = new Date().toISOString();
        auditEntry.backup_reference = `authorized_keys.bak-${auditId}`;
        break;
      }

      case 'backup-authorized-keys': {
        const backupCommand = `mkdir -p ~/.ssh && cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-${auditId}`;
        
        result = {
          status: 'backup_command_generated',
          audit_id: auditId,
          command: backupCommand,
          backup_file: `authorized_keys.bak-${auditId}`,
        };
        
        auditEntry.status = 'success';
        auditEntry.backup_reference = `authorized_keys.bak-${auditId}`;
        break;
      }

      case 'rollback': {
        if (!request.auditId) {
          throw new Error('auditId required for rollback');
        }

        const rollbackCommand = `mv ~/.ssh/authorized_keys.bak-${request.auditId} ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
        
        result = {
          status: 'rollback_command_generated',
          audit_id: request.auditId,
          command: rollbackCommand,
        };

        auditEntry.status = 'rolled_back';
        break;
      }

      case 'verify-connection': {
        const verifyCommand = `ssh -o BatchMode=yes -o ConnectTimeout=5 ${request.user}@${request.host} echo ok`;
        
        result = {
          status: 'verify_command_generated',
          command: verifyCommand,
        };
        break;
      }

      case 'execute-command': {
        if (!request.command) {
          throw new Error('Command required');
        }

        // Sanitize command - basic safety check
        const dangerousPatterns = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
        for (const pattern of dangerousPatterns) {
          if (request.command.includes(pattern)) {
            throw new Error('Dangerous command detected');
          }
        }

        result = {
          status: 'command_prepared',
          audit_id: auditId,
          command: request.command,
          execution_instructions: `ssh ${request.user}@${request.host} "${request.command}"`,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

    // Update audit log
    auditEntry.completed_at = new Date().toISOString();
    await logAudit(supabase, { ...auditEntry, details: JSON.stringify(result) });

    return new Response(JSON.stringify({
      success: true,
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Remote command error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      short: `Falha: ${error.message}`,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
