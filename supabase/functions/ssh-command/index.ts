import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SSHCommandRequest {
  command: string;
  timeout?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VPS_HOST = Deno.env.get('VPS_SSH_HOST');
    const VPS_USER = Deno.env.get('VPS_SSH_USER');
    const VPS_PASS = Deno.env.get('VPS_SSH_PASS');

    if (!VPS_HOST || !VPS_USER || !VPS_PASS) {
      return new Response(
        JSON.stringify({ error: 'SSH credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { command, timeout = 30000 } = await req.json() as SSHCommandRequest;

    if (!command) {
      return new Response(
        JSON.stringify({ error: 'Command is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Executing SSH command: ${command}`);

    // Use sshpass for password-based SSH
    const sshCommand = new Deno.Command("sshpass", {
      args: [
        "-p", VPS_PASS,
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=10",
        `${VPS_USER}@${VPS_HOST}`,
        command
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const process = sshCommand.spawn();
      const output = await process.output();
      clearTimeout(timeoutId);

      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);

      return new Response(
        JSON.stringify({
          success: output.success,
          code: output.code,
          stdout,
          stderr,
          command
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.error('SSH command error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'SSH command execution failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
