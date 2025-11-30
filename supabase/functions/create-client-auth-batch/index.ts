import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientData {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface BatchResult {
  success: boolean;
  clientId: string;
  email: string;
  userId?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated and is admin
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin", "master"]);

    if (roleError || !roleData || roleData.length === 0) {
      console.error("Permission check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Sem permissão de administrador", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin verified:", user.email, "roles:", roleData.map(r => r.role));

    // Get request body
    const { defaultPassword, clientIds } = await req.json();

    if (!defaultPassword || defaultPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha padrão deve ter no mínimo 6 caracteres", code: "INVALID_PASSWORD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for creating users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get clients without auth accounts
    let query = adminClient
      .from("clientes")
      .select("id, nome, email, telefone")
      .is("user_id", null)
      .not("email", "is", null);

    // If specific clientIds provided, filter by them
    if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
      query = query.in("id", clientIds);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar clientes", details: clientsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "Nenhum cliente sem conta de acesso encontrado",
          results: [],
          summary: { total: 0, success: 0, failed: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${clients.length} clients...`);

    const results: BatchResult[] = [];

    for (const client of clients as ClientData[]) {
      if (!client.email) {
        results.push({
          success: false,
          clientId: client.id,
          email: "",
          error: "Cliente sem email"
        });
        continue;
      }

      try {
        // Create auth user
        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
          email: client.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            nome: client.nome,
            telefone: client.telefone,
          },
        });

        if (createError) {
          console.error(`Error creating user for ${client.email}:`, createError);
          
          // Check if user already exists
          if (createError.message?.includes("already been registered")) {
            // Try to find existing user
            const { data: existingUsers } = await adminClient.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === client.email);
            
            if (existingUser) {
              // Link existing user to client
              const { error: updateError } = await adminClient
                .from("clientes")
                .update({ user_id: existingUser.id })
                .eq("id", client.id);

              if (!updateError) {
                results.push({
                  success: true,
                  clientId: client.id,
                  email: client.email,
                  userId: existingUser.id,
                });
                console.log(`Linked existing user ${client.email} to client ${client.id}`);
                continue;
              }
            }
          }

          results.push({
            success: false,
            clientId: client.id,
            email: client.email,
            error: createError.message
          });
          continue;
        }

        if (authData.user) {
          // Update client with user_id
          const { error: updateError } = await adminClient
            .from("clientes")
            .update({ user_id: authData.user.id })
            .eq("id", client.id);

          if (updateError) {
            console.error(`Error updating client ${client.id}:`, updateError);
            results.push({
              success: false,
              clientId: client.id,
              email: client.email,
              userId: authData.user.id,
              error: `Usuário criado mas erro ao vincular: ${updateError.message}`
            });
            continue;
          }

          // Add client role
          await adminClient.from("user_roles").upsert({
            user_id: authData.user.id,
            role: "client"
          }, { onConflict: "user_id,role" });

          results.push({
            success: true,
            clientId: client.id,
            email: client.email,
            userId: authData.user.id,
          });
          console.log(`Created auth account for ${client.email}`);
        }
      } catch (err) {
        console.error(`Unexpected error for ${client.email}:`, err);
        results.push({
          success: false,
          clientId: client.id,
          email: client.email,
          error: err instanceof Error ? err.message : "Erro desconhecido"
        });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    console.log("Batch complete:", summary);

    return new Response(
      JSON.stringify({ 
        message: `Processados ${summary.total} clientes: ${summary.success} sucesso, ${summary.failed} falhas`,
        results,
        summary
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Batch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
