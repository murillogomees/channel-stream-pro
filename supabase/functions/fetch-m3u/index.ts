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

    // Try to fetch with multiple strategies
    let content: string | null = null;
    let lastError: Error | null = null;

    // List of URLs to try (original, and protocol swap if applicable)
    const urlsToTry: string[] = [url];
    
    // If URL has unusual port (like 8880), try HTTP version too
    if (url.startsWith("https://")) {
      urlsToTry.push(url.replace("https://", "http://"));
    } else if (url.startsWith("http://")) {
      urlsToTry.push(url.replace("http://", "https://"));
    }

    for (const tryUrl of urlsToTry) {
      try {
        console.log("[fetch-m3u] Trying URL:", tryUrl);
        
        const response = await fetch(tryUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        content = await response.text();
        console.log("[fetch-m3u] Success with URL:", tryUrl, "Content length:", content.length);
        break;
      } catch (err) {
        console.log("[fetch-m3u] Failed with URL:", tryUrl, "Error:", err.message);
        lastError = err;
      }
    }

    if (!content) {
      throw lastError || new Error("Failed to fetch M3U from all URLs");
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-m3u] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
