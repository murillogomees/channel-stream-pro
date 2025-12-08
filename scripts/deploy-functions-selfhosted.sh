#!/bin/bash
#
# Deploy Edge Functions to Self-Hosted Supabase on Hostinger VPS
# 
# USAGE:
#   1. Copy this entire script to your VPS
#   2. Run: chmod +x deploy-functions-selfhosted.sh
#   3. Run: ./deploy-functions-selfhosted.sh
#
# This script will:
#   - Create the functions directory structure
#   - Configure docker-compose for Edge Functions
#   - Set up all environment variables
#   - Restart the functions service
#

set -e

echo "============================================="
echo "  Self-Hosted Supabase Edge Functions Deploy"
echo "============================================="

# Configuration - UPDATE THESE VALUES
SUPABASE_DIR="${SUPABASE_DIR:-$HOME/supabase/docker}"
FUNCTIONS_DIR="$SUPABASE_DIR/volumes/functions"
COMPOSE_FILE="$SUPABASE_DIR/docker-compose.yml"

# Self-hosted URLs - UPDATE THESE
SUPABASE_URL="${SUPABASE_URL:-https://srv1182856.hstgr.cloud}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key-here}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-role-key-here}"
JWT_SECRET="${JWT_SECRET:-your-jwt-secret-here}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:your-password@localhost:5432/postgres}"

# External service keys - UPDATE THESE
MERCADO_PAGO_ACCESS_TOKEN="${MERCADO_PAGO_ACCESS_TOKEN:-}"
MERCADO_PAGO_PUBLIC_KEY="${MERCADO_PAGO_PUBLIC_KEY:-}"
WHATSAPP_APPKEY="${WHATSAPP_APPKEY:-}"
WHATSAPP_AUTHKEY="${WHATSAPP_AUTHKEY:-}"
WHATSAPP_WEBHOOK_SECRET="${WHATSAPP_WEBHOOK_SECRET:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-iptvlink-cdn}"
STREAM_PROXY_SECRET="${STREAM_PROXY_SECRET:-}"
TMDB_API_KEY="${TMDB_API_KEY:-}"

echo ""
echo "[1/5] Creating functions directory structure..."
mkdir -p "$FUNCTIONS_DIR"

# Create shared utilities
mkdir -p "$FUNCTIONS_DIR/_shared"
cat > "$FUNCTIONS_DIR/_shared/cors.ts" << 'SHARED_CORS'
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id, x-webhook-signature, range, accept-encoding, x-playback-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
SHARED_CORS

cat > "$FUNCTIONS_DIR/_shared/supabase-client.ts" << 'SHARED_CLIENT'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabaseClient(req?: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseClientWithAuth(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
SHARED_CLIENT

echo "[2/5] Creating individual function files..."

# ==========================================
# HEALTH CHECK
# ==========================================
mkdir -p "$FUNCTIONS_DIR/health-check"
cat > "$FUNCTIONS_DIR/health-check/index.ts" << 'FUNC_HEALTH'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const startTime = Date.now();
    
    // Test database connection
    const { error: dbError } = await supabase.from('profiles').select('count').limit(1);
    const dbLatency = Date.now() - startTime;
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'self-hosted',
      database: {
        status: dbError ? 'error' : 'ok',
        latency_ms: dbLatency,
        error: dbError?.message
      },
      version: '2.1.0'
    };
    
    return new Response(JSON.stringify(health), {
      status: dbError ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_HEALTH

# ==========================================
# STREAM PROXY
# ==========================================
mkdir -p "$FUNCTIONS_DIR/stream-proxy"
cat > "$FUNCTIONS_DIR/stream-proxy/index.ts" << 'FUNC_STREAM_PROXY'
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const decoded = decodeURIComponent(targetUrl);
    console.log(`[stream-proxy] Proxying: ${decoded.substring(0, 100)}...`);
    
    const headers: Record<string, string> = {
      'User-Agent': 'VLC/3.0.18',
      'Accept': '*/*',
    };
    
    // Forward range header for seeking
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(decoded, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Cache-Control': 'no-cache',
    };
    
    // Forward content headers
    const contentType = response.headers.get('content-type');
    if (contentType) responseHeaders['Content-Type'] = contentType;
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    
    const contentRange = response.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[stream-proxy] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_STREAM_PROXY

# ==========================================
# MERCADO PAGO CHECKOUT
# ==========================================
mkdir -p "$FUNCTIONS_DIR/mercado-pago-checkout"
cat > "$FUNCTIONS_DIR/mercado-pago-checkout/index.ts" << 'FUNC_MP_CHECKOUT'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!MP_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'MercadoPago not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { planId, userId, email, couponCode } = body;
    
    const supabase = getSupabaseClient();
    
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();
      
    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let finalPrice = plan.price;
    let couponId = null;
    
    // Apply coupon if provided
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .single();
        
      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          finalPrice = finalPrice * (1 - coupon.discount_value / 100);
        } else {
          finalPrice = Math.max(0, finalPrice - coupon.discount_value);
        }
        couponId = coupon.id;
      }
    }
    
    // Create MercadoPago preference
    const preference = {
      items: [{
        title: plan.name,
        unit_price: finalPrice,
        quantity: 1,
        currency_id: 'BRL',
      }],
      payer: { email },
      external_reference: JSON.stringify({ userId, planId, couponId }),
      back_urls: {
        success: `${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/checkout/success`,
        failure: `${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/checkout/failure`,
        pending: `${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/checkout/pending`,
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-webhook`,
    };
    
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });
    
    const mpData = await mpResponse.json();
    
    if (!mpResponse.ok) {
      console.error('MercadoPago error:', mpData);
      return new Response(JSON.stringify({ error: 'Failed to create preference' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_MP_CHECKOUT

# ==========================================
# MERCADO PAGO WEBHOOK
# ==========================================
mkdir -p "$FUNCTIONS_DIR/mercado-pago-webhook"
cat > "$FUNCTIONS_DIR/mercado-pago-webhook/index.ts" << 'FUNC_MP_WEBHOOK'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[MP Webhook] Received:', JSON.stringify(body));
    
    if (body.type !== 'payment' || !body.data?.id) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get payment details from MercadoPago
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${body.data.id}`,
      {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      }
    );
    
    const payment = await paymentResponse.json();
    console.log('[MP Webhook] Payment status:', payment.status);
    
    if (payment.status === 'approved') {
      const externalRef = JSON.parse(payment.external_reference || '{}');
      const { userId, planId, couponId } = externalRef;
      
      if (userId && planId) {
        const supabase = getSupabaseClient();
        
        // Get plan details
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();
          
        if (plan) {
          // Calculate expiration based on plan duration
          const now = new Date();
          let expirationDate = new Date(now);
          
          switch (plan.billing_interval) {
            case 'month': expirationDate.setMonth(now.getMonth() + 1); break;
            case 'quarter': expirationDate.setMonth(now.getMonth() + 3); break;
            case 'semester': expirationDate.setMonth(now.getMonth() + 6); break;
            case 'year': expirationDate.setFullYear(now.getFullYear() + 1); break;
          }
          
          // Update profile
          await supabase
            .from('profiles')
            .update({
              situacao: 'Ativo',
              plano: plan.name,
              data_vencimento: expirationDate.toISOString(),
              data_ultimo_pagamento: now.toISOString(),
              valor_pago: payment.transaction_amount,
              forma_ultimo_pagamento: 'MercadoPago',
              cliente_ativo: true,
            })
            .eq('id', userId);
            
          // Update subscription
          await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              plan_id: planId,
              status: 'active',
              current_period_start: now.toISOString(),
              current_period_end: expirationDate.toISOString(),
            });
            
          // Record coupon usage if applicable
          if (couponId) {
            await supabase.from('coupon_usage').insert({
              coupon_id: couponId,
              client_id: userId,
              order_value: payment.transaction_amount,
            });
          }
          
          console.log('[MP Webhook] User activated:', userId);
        }
      }
    }
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[MP Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_MP_WEBHOOK

# ==========================================
# WHATSAPP WEBHOOK
# ==========================================
mkdir -p "$FUNCTIONS_DIR/whatsapp-webhook"
cat > "$FUNCTIONS_DIR/whatsapp-webhook/index.ts" << 'FUNC_WA_WEBHOOK'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

const WHATSAPP_APPKEY = Deno.env.get('WHATSAPP_APPKEY');
const WHATSAPP_AUTHKEY = Deno.env.get('WHATSAPP_AUTHKEY');

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  if (!WHATSAPP_APPKEY || !WHATSAPP_AUTHKEY) {
    console.error('WhatsApp credentials not configured');
    return false;
  }
  
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const response = await fetch('https://api.wzap.chat/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Key': WHATSAPP_APPKEY,
        'Auth-Key': WHATSAPP_AUTHKEY,
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message,
        check_status: true,
      }),
    });
    
    const result = await response.json();
    console.log('[WhatsApp] Send result:', result);
    return response.ok;
  } catch (error) {
    console.error('[WhatsApp] Send error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, phone, message, template, variables, userId } = body;
    
    let finalMessage = message;
    
    // Process template if provided
    if (template && variables) {
      finalMessage = template;
      for (const [key, value] of Object.entries(variables)) {
        finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }
    
    if (!phone || !finalMessage) {
      return new Response(JSON.stringify({ error: 'Missing phone or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const success = await sendWhatsAppMessage(phone, finalMessage);
    
    // Log the notification
    const supabase = getSupabaseClient();
    await supabase.from('notification_logs').insert({
      user_id: userId,
      notification_type: 'whatsapp',
      recipient: phone,
      message: finalMessage,
      status: success ? 'sent' : 'failed',
    });
    
    return new Response(JSON.stringify({ success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_WA_WEBHOOK

# ==========================================
# FETCH M3U URL
# ==========================================
mkdir -p "$FUNCTIONS_DIR/fetch-m3u-url"
cat > "$FUNCTIONS_DIR/fetch-m3u-url/index.ts" << 'FUNC_FETCH_M3U'
import { corsHeaders } from '../_shared/cors.ts';

const MAX_SIZE = 60 * 1024 * 1024; // 60MB

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[fetch-m3u-url] Fetching: ${url.substring(0, 100)}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `Failed to fetch: ${response.status} ${response.statusText}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File too large (${Math.round(parseInt(contentLength) / 1024 / 1024)}MB). Max: 60MB` 
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const content = await response.text();
    
    if (content.length > MAX_SIZE) {
      return new Response(JSON.stringify({ 
        error: `Content too large. Max: 60MB` 
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      content,
      size: content.length,
      contentType: response.headers.get('content-type')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[fetch-m3u-url] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_FETCH_M3U

# ==========================================
# STREAM URL RESOLVE
# ==========================================
mkdir -p "$FUNCTIONS_DIR/stream-url-resolve"
cat > "$FUNCTIONS_DIR/stream-url-resolve/index.ts" << 'FUNC_STREAM_RESOLVE'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, entryId, userId } = await req.json();
    
    if (!channelId && !entryId) {
      return new Response(JSON.stringify({ error: 'channelId or entryId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // Verify user has valid subscription
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_ativo, data_vencimento')
        .eq('id', userId)
        .single();
        
      if (!profile?.cliente_ativo || (profile.data_vencimento && new Date(profile.data_vencimento) < new Date())) {
        return new Response(JSON.stringify({ error: 'Subscription expired' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    let streamUrl: string | null = null;
    let metadata: any = null;
    
    // Get from m3u_channels or m3u_sync_entries
    if (channelId) {
      const { data: channel } = await supabase
        .from('m3u_channels')
        .select('stream_url, r2_url, name, tvg_logo, group_title')
        .eq('id', channelId)
        .single();
        
      if (channel) {
        streamUrl = channel.r2_url || channel.stream_url;
        metadata = channel;
      }
    } else if (entryId) {
      const { data: entry } = await supabase
        .from('m3u_sync_entries')
        .select('stream_url, r2_url, title, tvg_logo, group_title')
        .eq('id', entryId)
        .single();
        
      if (entry) {
        streamUrl = entry.r2_url || entry.stream_url;
        metadata = entry;
      }
    }
    
    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Wrap HTTP URLs through proxy
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    if (streamUrl.startsWith('http://')) {
      streamUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
    }
    
    return new Response(JSON.stringify({
      url: streamUrl,
      metadata,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[stream-url-resolve] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_STREAM_RESOLVE

# ==========================================
# IPTV PLAYLIST
# ==========================================
mkdir -p "$FUNCTIONS_DIR/iptv-playlist"
cat > "$FUNCTIONS_DIR/iptv-playlist/index.ts" << 'FUNC_IPTV_PLAYLIST'
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '500');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const contentType = url.searchParams.get('type'); // live, vod, series
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('m3u_sync_entries')
      .select('id, title, stream_url, tvg_logo, tvg_id, tvg_name, group_title, content_type, is_vod', { count: 'exact' });
    
    if (category) {
      query = query.eq('group_title', category);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,group_title.ilike.%${search}%`);
    }
    
    if (contentType === 'live') {
      query = query.eq('is_vod', false);
    } else if (contentType === 'vod') {
      query = query.eq('is_vod', true);
    }
    
    const { data, error, count } = await query
      .order('group_title')
      .order('title')
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return new Response(JSON.stringify({
      items: data || [],
      total: count || 0,
      limit,
      offset,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[iptv-playlist] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_IPTV_PLAYLIST

# ==========================================
# CREATE ADMIN USER
# ==========================================
mkdir -p "$FUNCTIONS_DIR/create-admin-user"
cat > "$FUNCTIONS_DIR/create-admin-user/index.ts" << 'FUNC_CREATE_ADMIN'
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Verify requester is admin/master
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user: requester } } = await userClient.auth.getUser();
    if (!requester) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: requesterRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requester.id);
      
    const requesterRole = requesterRoles?.[0]?.role;
    if (!['admin', 'master'].includes(requesterRole)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { email, password, nome, telefone, role = 'client' } = body;
    
    // Only master can create admin/master users
    if (['admin', 'master'].includes(role) && requesterRole !== 'master') {
      return new Response(JSON.stringify({ error: 'Only master can create admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, telefone },
    });
    
    if (createError) throw createError;
    
    // Assign role
    await adminClient.from('user_roles').insert({
      user_id: newUser.user.id,
      role,
    });
    
    return new Response(JSON.stringify({
      success: true,
      userId: newUser.user.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[create-admin-user] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
FUNC_CREATE_ADMIN

echo "[3/5] Creating docker-compose functions service..."

# Create env file for functions
cat > "$SUPABASE_DIR/.env.functions" << ENV_FILE
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET=$JWT_SECRET
SUPABASE_DB_URL=$SUPABASE_DB_URL
MERCADO_PAGO_ACCESS_TOKEN=$MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_PUBLIC_KEY=$MERCADO_PAGO_PUBLIC_KEY
WHATSAPP_APPKEY=$WHATSAPP_APPKEY
WHATSAPP_AUTHKEY=$WHATSAPP_AUTHKEY
WHATSAPP_WEBHOOK_SECRET=$WHATSAPP_WEBHOOK_SECRET
R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID=$R2_ACCOUNT_ID
R2_BUCKET_NAME=$R2_BUCKET_NAME
STREAM_PROXY_SECRET=$STREAM_PROXY_SECRET
TMDB_API_KEY=$TMDB_API_KEY
ENV_FILE

echo "[4/5] Adding functions service to docker-compose..."

# Check if functions service already exists
if grep -q "functions:" "$COMPOSE_FILE" 2>/dev/null; then
  echo "  Functions service already exists in docker-compose.yml"
else
  # Add functions service to docker-compose
  cat >> "$COMPOSE_FILE" << 'DOCKER_FUNCTIONS'

  functions:
    container_name: supabase-edge-functions
    image: supabase/edge-runtime:v1.56.0
    restart: unless-stopped
    depends_on:
      - db
      - kong
    env_file:
      - .env.functions
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    command:
      - start
      - --main-service
      - /home/deno/functions/main
    networks:
      - supabase-network
DOCKER_FUNCTIONS
  echo "  Added functions service to docker-compose.yml"
fi

# Create main router function
mkdir -p "$FUNCTIONS_DIR/main"
cat > "$FUNCTIONS_DIR/main/index.ts" << 'FUNC_MAIN'
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Self-hosted Edge Functions Active',
    version: '2.1.0'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
FUNC_MAIN

echo "[5/5] Restarting functions service..."

cd "$SUPABASE_DIR"
docker compose up -d functions

echo ""
echo "============================================="
echo "  Deployment Complete!"
echo "============================================="
echo ""
echo "Functions deployed:"
echo "  - health-check"
echo "  - stream-proxy"
echo "  - mercado-pago-checkout"
echo "  - mercado-pago-webhook"
echo "  - whatsapp-webhook"
echo "  - fetch-m3u-url"
echo "  - stream-url-resolve"
echo "  - iptv-playlist"
echo "  - create-admin-user"
echo "  - main (router)"
echo ""
echo "Test with:"
echo "  curl $SUPABASE_URL/functions/v1/health-check"
echo ""
echo "View logs:"
echo "  docker logs -f supabase-edge-functions"
echo ""
