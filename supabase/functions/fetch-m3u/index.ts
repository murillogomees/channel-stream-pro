import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Normalize URL - ensure HTTP for non-standard ports like 8880
    let normalizedUrl = url;
    try {
      const urlObj = new URL(url);
      // Ports like 8880, 8000, 25461 are typically HTTP on Xtream servers
      const httpPorts = ['8880', '8000', '25461', '25462', '8080', '80'];
      if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
        normalizedUrl = url.replace('https://', 'http://');
        console.log("[fetch-m3u] Normalized to HTTP:", normalizedUrl);
      }
    } catch (e) {
      console.log("[fetch-m3u] URL parse error, using original:", e.message);
    }

    // Try with different user agents - Xtream servers are picky
    const userAgents = [
      'VLC/3.0.18 LibVLC/3.0.18',
      'Lavf/60.3.100',
      'IPTVnator/0.14.0',
      'Kodi/20.0 (Windows NT 10.0; Win64; x64)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ];

    let content: string | null = null;
    let lastError: Error | null = null;

    for (const userAgent of userAgents) {
      try {
        console.log("[fetch-m3u] Trying with User-Agent:", userAgent.substring(0, 30));
        
        const response = await fetch(normalizedUrl, {
          method: 'GET',
          headers: {
            "User-Agent": userAgent,
            "Accept": "audio/x-mpegurl, application/vnd.apple.mpegurl, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
          },
        });

        console.log("[fetch-m3u] Response status:", response.status);

        if (response.ok) {
          content = await response.text();
          console.log("[fetch-m3u] Success! Content length:", content.length);
          break;
        } else {
          lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.log("[fetch-m3u] Error with this UA:", err.message);
        lastError = err;
      }
    }

    if (!content) {
      throw lastError || new Error("Failed to fetch M3U");
    }

    // Validate it looks like M3U content
    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      console.log("[fetch-m3u] Warning: Content doesn't look like M3U, first 200 chars:", content.substring(0, 200));
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-m3u] Final error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
