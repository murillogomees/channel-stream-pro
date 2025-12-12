import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, sql, dbHost, dbPort, dbUser, dbPassword, dbName, email, newPassword } = body;

    // Get the database connection params from environment or request
    // SELFHOSTED_DB_URL format: postgresql://user:password@host:port/database
    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL') || '';
    let host = dbHost || 'supabase.iptvlink.com.br';
    let port = dbPort || 5432;
    let user = dbUser || 'postgres';
    let password = dbPassword || '';
    let database = dbName || 'postgres';
    
    // Parse SELFHOSTED_DB_URL if available
    if (dbUrl && !dbPassword) {
      try {
        const url = new URL(dbUrl);
        host = url.hostname;
        port = parseInt(url.port) || 5432;
        user = url.username;
        password = url.password;
        database = url.pathname.replace('/', '');
      } catch (e) {
        console.log('Failed to parse SELFHOSTED_DB_URL:', e);
      }
    }

    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database password not configured. Provide dbPassword in request or set SELFHOSTED_DB_URL'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Connecting to PostgreSQL at ${host}:${port}...`);
    
    const client = new Client({
      hostname: host,
      port: port,
      user: user,
      password: password,
      database: database,
      tls: { enabled: false }
    });
    
    await client.connect();
    console.log('Connected successfully');

    let result: unknown;

    if (action === 'disable-trigger') {
      console.log('Disabling on_auth_user_created trigger...');
      
      // Disable the trigger
      const disableResult = await client.queryObject(`
        ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
      `);
      
      result = {
        action: 'disable-trigger',
        trigger: 'on_auth_user_created',
        status: 'disabled',
        details: disableResult
      };
    } 
    else if (action === 'enable-trigger') {
      console.log('Enabling on_auth_user_created trigger...');
      
      const enableResult = await client.queryObject(`
        ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
      `);
      
      result = {
        action: 'enable-trigger',
        trigger: 'on_auth_user_created',
        status: 'enabled',
        details: enableResult
      };
    }
    else if (action === 'list-triggers') {
      const triggers = await client.queryObject(`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_schema,
          event_object_table,
          action_statement
        FROM information_schema.triggers
        WHERE event_object_schema = 'auth'
        ORDER BY trigger_name;
      `);
      
      result = {
        action: 'list-triggers',
        triggers: triggers.rows
      };
    }
    else if (action === 'check-users') {
      const users = await client.queryObject(`
        SELECT id, email, created_at, email_confirmed_at
        FROM auth.users
        ORDER BY created_at DESC
        LIMIT 10;
      `);
      
      result = {
        action: 'check-users',
        users: users.rows
      };
    }
    else if (action === 'custom-sql' && sql) {
      console.log('Executing custom SQL:', sql);
      const customResult = await client.queryObject(sql);
      
      // Convert BigInt to Number/String to avoid JSON serialization issues
      const safeRows = customResult.rows.map((row: Record<string, unknown>) => {
        const safeRow: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          safeRow[key] = typeof value === 'bigint' ? Number(value) : value;
        }
        return safeRow;
      });
      
      result = {
        action: 'custom-sql',
        rows: safeRows,
        rowCount: typeof customResult.rowCount === 'bigint' ? Number(customResult.rowCount) : customResult.rowCount
      };
    }
    else if (action === 'reset-password') {
      if (!email || !newPassword) {
        result = { error: 'email and newPassword required' };
      } else {
        console.log('Resetting password for:', email);
        
        // Use pgcrypto with cost factor 6 (GoTrue self-hosted requirement)
        const updateResult = await client.queryObject`
          UPDATE auth.users 
          SET encrypted_password = crypt(${newPassword}, gen_salt('bf', 6))
          WHERE email = ${email}
          RETURNING id, email
        `;
        
        if (updateResult.rows.length === 0) {
          result = { error: 'User not found', action: 'reset-password' };
        } else {
          result = {
            action: 'reset-password',
            success: true,
            user: updateResult.rows[0]
          };
        }
      }
    }
    else {
      result = {
        error: 'Invalid action',
        available_actions: ['disable-trigger', 'enable-trigger', 'list-triggers', 'check-users', 'custom-sql', 'reset-password']
      };
    }

    await client.end();

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Database operation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
