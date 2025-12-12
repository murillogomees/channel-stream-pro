import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Self-hosted PostgreSQL connection
const SELFHOSTED_DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sql } = await req.json();

    // Parse the connection URL for self-hosted
    // Expected format: postgresql://postgres:password@host:5432/postgres
    const selfHostedDbUrl = 'postgresql://postgres:Fc2vT97Nnfcd@supabase.iptvlink.com.br:5432/postgres';

    const client = new Client(selfHostedDbUrl);
    await client.connect();

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
      
      result = {
        action: 'custom-sql',
        rows: customResult.rows,
        rowCount: customResult.rowCount
      };
    }
    else {
      result = {
        error: 'Invalid action',
        available_actions: ['disable-trigger', 'enable-trigger', 'list-triggers', 'check-users', 'custom-sql']
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
