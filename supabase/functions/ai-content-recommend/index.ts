import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { favorites = [], recentlyWatched = [] } = await req.json();

    console.log("[AI Recommend] Buscando playlist 'live' para EXCLUIR...");

    // Buscar ID da playlist "live" para EXCLUIR seus canais
    const { data: livePlaylist } = await supabase
      .from("iptv_playlists")
      .select("id")
      .eq("slug", "live")
      .single();

    // Buscar TODOS os IDs dos canais da playlist "live"
    const { data: liveChannels } = await supabase
      .from("iptv_playlist_channels")
      .select("channel_id")
      .eq("playlist_id", livePlaylist?.id || 0);

    const liveChannelIds = new Set((liveChannels || []).map(pc => pc.channel_id));
    console.log(`[AI Recommend] Total canais LIVE a excluir: ${liveChannelIds.size}`);

    // Buscar canais healthy
    const { data: allChannels, error: detailsError } = await supabase
      .from("iptv_channels")
      .select("id, name, category, logo_url, content_type, is_series")
      .eq("is_healthy", true)
      .limit(3000);

    if (detailsError) {
      console.error("[AI Recommend] Erro ao buscar canais:", detailsError);
      throw detailsError;
    }

    // Filtrar EXCLUINDO canais da playlist live
    const channels = (allChannels || []).filter(ch => !liveChannelIds.has(ch.id));
    console.log(`[AI Recommend] Total canais após excluir live: ${channels.length}`);

    // Criar lista de conteúdo disponível
    const availableContent = channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      type: ch.is_series ? "series" : "movie",
      logo_url: ch.logo_url,
    }));

    console.log(`[AI Recommend] Conteúdo disponível para IA: ${availableContent.length} itens`);

    if (availableContent.length === 0) {
      return new Response(JSON.stringify({ groups: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar IA para recomendar conteúdo
    const systemPrompt = `Você é um assistente de recomendação de filmes e séries. 
Analise o conteúdo disponível e selecione os melhores títulos para recomendar ao usuário.
Considere variedade de gêneros, popularidade implícita (nome conhecido), e qualidade.
Priorize conteúdo que pareça ser de alta qualidade baseado no nome.
Retorne APENAS os IDs dos itens recomendados, sem explicações.`;

    const userPrompt = `Conteúdo disponível (${availableContent.length} itens):
${JSON.stringify(availableContent.slice(0, 80).map(c => ({ id: c.id, name: c.name, category: c.category, type: c.type })), null, 2)}

${favorites.length > 0 ? `Favoritos do usuário: ${JSON.stringify(favorites)}` : ""}
${recentlyWatched.length > 0 ? `Assistidos recentemente: ${JSON.stringify(recentlyWatched)}` : ""}

Selecione os 30 melhores títulos para recomendar, priorizando:
1. Filmes e séries famosos/populares
2. Variedade de gêneros/categorias
3. Conteúdo de qualidade

IMPORTANTE: Retorne APENAS um JSON com os IDs no formato: {"recommended_ids": [1, 2, 3, ...]}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";

    // Extrair IDs recomendados do texto da IA
    let recommendedIds: number[] = [];
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*"recommended_ids"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendedIds = parsed.recommended_ids || [];
      }
    } catch {
      // Se falhar, usar os primeiros itens como fallback
      recommendedIds = availableContent.slice(0, 30).map(c => c.id);
    }

    // Filtrar e organizar conteúdo recomendado
    const recommendedContent = recommendedIds
      .map(id => availableContent.find(c => c.id === id))
      .filter(Boolean);

    // Agrupar por categoria
    const groupedByCategory: Record<string, any[]> = {};
    for (const item of recommendedContent) {
      if (!item) continue;
      const cat = item.category || "Recomendados";
      if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
      if (groupedByCategory[cat].length < 20) {
        groupedByCategory[cat].push(item);
      }
    }

    // Se não houver recomendações suficientes, adicionar conteúdo aleatório
    if (Object.keys(groupedByCategory).length < 3) {
      const shuffled = [...availableContent].sort(() => Math.random() - 0.5);
      for (const item of shuffled.slice(0, 50)) {
        const cat = item.category || "Destaques";
        if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
        if (groupedByCategory[cat].length < 20) {
          groupedByCategory[cat].push(item);
        }
      }
    }

    // Criar grupos de exibição
    const groups = Object.entries(groupedByCategory)
      .slice(0, 6)
      .map(([name, items]) => ({
        name: `🎬 ${name}`,
        channels: items.map(item => ({
          id: item.id,
          name: item.name,
          logo_url: item.logo_url,
          category: item.category,
          content_type: item.type === "series" ? "series" : "vod",
          is_series: item.type === "series",
        })),
      }));

    console.log(`[AI Recommend] Retornando ${groups.length} grupos com recomendações`);

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI recommend error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
