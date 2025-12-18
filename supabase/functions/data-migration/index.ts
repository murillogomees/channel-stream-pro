import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Source: Lovable Cloud
const SOURCE_URL = Deno.env.get('SUPABASE_URL') || "https://waxgowafohlrfoefwhsf.supabase.co";
const SOURCE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw";

// Destination: Same project (self-migration/cleanup)
const DEST_URL = SOURCE_URL;
const DEST_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tables } = await req.json();

    // Create clients
    const sourceClient = createClient(SOURCE_URL, SOURCE_ANON_KEY);
    const destClient = createClient(DEST_URL, DEST_SERVICE_KEY);

    const results: Record<string, unknown> = {};

    switch (action) {
      case 'migrate-all': {
        // Core tables to migrate in order (respecting foreign keys)
        const tablesToMigrate = tables || [
          'subscription_plans',
          'whatsapp_config',
          'notification_templates',
          'auto_notifications',
          'test_contacts',
          'profiles',
          'user_roles',
          'iptv_channels',
        ];

        for (const table of tablesToMigrate) {
          try {
            console.log(`Migrating ${table}...`);
            
            // Read from source
            const { data: sourceData, error: readError } = await sourceClient
              .from(table)
              .select('*');

            if (readError) {
              results[table] = { error: readError.message, migrated: 0 };
              continue;
            }

            if (!sourceData || sourceData.length === 0) {
              results[table] = { skipped: true, reason: 'empty', migrated: 0 };
              continue;
            }

            // Insert to destination (upsert to handle duplicates)
            const { error: writeError, count } = await destClient
              .from(table)
              .upsert(sourceData, { onConflict: 'id', ignoreDuplicates: false })
              .select();

            if (writeError) {
              results[table] = { error: writeError.message, migrated: 0 };
            } else {
              results[table] = { success: true, migrated: sourceData.length };
            }
          } catch (e) {
            results[table] = { error: (e as Error).message, migrated: 0 };
          }
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'migrate-all',
          results,
          timestamp: new Date().toISOString(),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'migrate-table': {
        const { tableName, batchSize = 1000 } = await req.json();
        
        if (!tableName) {
          return new Response(JSON.stringify({ error: 'tableName required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let offset = 0;
        let totalMigrated = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await sourceClient
            .from(tableName)
            .select('*')
            .range(offset, offset + batchSize - 1);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          const { error: insertError } = await destClient
            .from(tableName)
            .upsert(data, { onConflict: 'id' });

          if (insertError) {
            return new Response(JSON.stringify({ 
              error: insertError.message,
              migratedSoFar: totalMigrated 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          totalMigrated += data.length;
          offset += batchSize;

          if (data.length < batchSize) {
            hasMore = false;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          table: tableName,
          migrated: totalMigrated,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'verify': {
        // Verify migration by comparing counts
        const tablesToCheck = tables || [
          'subscription_plans', 'profiles', 'user_roles', 
          'notification_templates', 'iptv_channels'
        ];

        for (const table of tablesToCheck) {
          const { count: sourceCount } = await sourceClient
            .from(table)
            .select('*', { count: 'exact', head: true });

          const { count: destCount } = await destClient
            .from(table)
            .select('*', { count: 'exact', head: true });

          results[table] = {
            source: sourceCount || 0,
            destination: destCount || 0,
            match: sourceCount === destCount,
          };
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'verify',
          results,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          validActions: ['migrate-all', 'migrate-table', 'verify'],
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
