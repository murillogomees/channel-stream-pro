import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max content size: 100MB (increased for large playlists)
const MAX_CONTENT_SIZE = 100 * 1024 * 1024;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-m3u] Fetching M3U from:", url);

    // Normalize URL - force HTTP for common Xtream ports
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);
      const httpPorts = ['8880', '8000', '25461', '25462', '8080'];
      if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
        fetchUrl = url.replace('https://', 'http://');
        console.log("[fetch-m3u] Using HTTP for port:", urlObj.port);
      }
    } catch (e) {
      console.log("[fetch-m3u] URL parse warning:", e.message);
    }

    // Single attempt with VLC user agent
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
    });

    console.log("[fetch-m3u] Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        throw new Error("Servidor bloqueou a requisição. Use 'Colar M3U' para importar.");
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // Check content-length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
      const sizeMB = Math.round(parseInt(contentLength) / 1024 / 1024);
      throw new Error(`Arquivo muito grande (${sizeMB}MB). Limite máximo: 100MB.`);
    }

    // Stream response and check size
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Não foi possível ler a resposta");
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    console.log("[fetch-m3u] Starting stream read...");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > MAX_CONTENT_SIZE) {
        reader.cancel();
        const sizeMB = Math.round(totalSize / 1024 / 1024);
        throw new Error(`Arquivo muito grande (>${sizeMB}MB). Limite máximo: 100MB.`);
      }
      
      chunks.push(value);
      
      // Log progress for large files
      if (chunks.length % 100 === 0) {
        console.log(`[fetch-m3u] Progress: ${Math.round(totalSize / 1024 / 1024)}MB`);
      }
    }

    console.log(`[fetch-m3u] Download complete: ${Math.round(totalSize / 1024 / 1024)}MB`);

    const allChunks = new Uint8Array(totalSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    const content = new TextDecoder().decode(allChunks);
    console.log("[fetch-m3u] Content length:", content.length, "chars");

    // Basic validation
    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      throw new Error("Conteúdo não parece ser M3U válido");
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
