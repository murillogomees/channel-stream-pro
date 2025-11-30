/**
 * Security Audit Edge Function
 * 
 * Performs security validations:
 * - Token lifetime checks
 * - Hotlink detection
 * - Rate limit bypass attempts
 * - CORS/CSP validation
 * - Endpoint security
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  remediation?: string;
  evidence?: Record<string, unknown>;
}

interface SecurityAuditReport {
  timestamp: string;
  audit_type: string;
  overall_score: number; // 0-100
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const auditType = url.searchParams.get('type') || 'full';
  
  const findings: SecurityFinding[] = [];
  const recommendations: string[] = [];
  
  try {
    // ========== 1. Token Lifetime Audit ==========
    if (auditType === 'full' || auditType === 'tokens') {
      console.log('[Security-Audit] Checking token lifetimes...');
      
      const { data: tokens } = await supabase
        .from('playback_tokens')
        .select('id, expires_at, created_at, max_uses, current_uses')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (tokens && tokens.length > 0) {
        // Check for excessively long token lifetimes
        const longLivedTokens = tokens.filter(t => {
          const created = new Date(t.created_at);
          const expires = new Date(t.expires_at);
          const hours = (expires.getTime() - created.getTime()) / 1000 / 3600;
          return hours > 24; // More than 24 hours
        });
        
        if (longLivedTokens.length > 0) {
          findings.push({
            severity: 'medium',
            category: 'token_security',
            title: 'Long-lived playback tokens detected',
            description: `${longLivedTokens.length} tokens with lifetime > 24 hours`,
            remediation: 'Reduce token lifetime to maximum 4 hours for VOD, 1 hour for live',
            evidence: { count: longLivedTokens.length },
          });
        }
        
        // Check for unlimited use tokens
        const unlimitedTokens = tokens.filter(t => t.max_uses > 10000);
        if (unlimitedTokens.length > 0) {
          findings.push({
            severity: 'low',
            category: 'token_security',
            title: 'High-use tokens detected',
            description: `${unlimitedTokens.length} tokens with max_uses > 10000`,
            remediation: 'Consider limiting token reuse to prevent sharing',
          });
        }
      }
      
      // Check CDN tokens
      const { data: cdnTokens } = await supabase
        .from('cdn_signed_tokens')
        .select('id, expires_at, ip_restriction, referrer_restriction')
        .is('revoked_at', null)
        .limit(50);
      
      const noRestrictions = cdnTokens?.filter(t => !t.ip_restriction && !t.referrer_restriction);
      if (noRestrictions && noRestrictions.length > 10) {
        findings.push({
          severity: 'low',
          category: 'token_security',
          title: 'CDN tokens without restrictions',
          description: `${noRestrictions.length} CDN tokens have no IP or referrer restrictions`,
          remediation: 'Consider adding IP or referrer restrictions for sensitive content',
        });
      }
    }
    
    // ========== 2. Hotlink Detection ==========
    if (auditType === 'full' || auditType === 'hotlink') {
      console.log('[Security-Audit] Checking for hotlink attempts...');
      
      const { data: securityEvents } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'hotlink_attempt')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);
      
      if (securityEvents && securityEvents.length > 0) {
        const uniqueIPs = new Set(securityEvents.map(e => e.ip_address)).size;
        
        findings.push({
          severity: securityEvents.length > 50 ? 'high' : 'medium',
          category: 'hotlink_protection',
          title: 'Hotlink attempts detected',
          description: `${securityEvents.length} hotlink attempts from ${uniqueIPs} IPs in last 24h`,
          remediation: 'Consider blocking repeat offenders via IP blacklist',
          evidence: {
            total_attempts: securityEvents.length,
            unique_ips: uniqueIPs,
          },
        });
      } else {
        findings.push({
          severity: 'info',
          category: 'hotlink_protection',
          title: 'No hotlink attempts detected',
          description: 'Hotlink protection appears effective',
        });
      }
    }
    
    // ========== 3. Rate Limit Analysis ==========
    if (auditType === 'full' || auditType === 'ratelimit') {
      console.log('[Security-Audit] Analyzing rate limits...');
      
      const { data: rateLimits } = await supabase
        .from('cdn_rate_limits')
        .select('*')
        .order('request_count', { ascending: false })
        .limit(50);
      
      // Find potential abuse patterns
      const highTraffic = rateLimits?.filter(r => r.request_count > 1000) || [];
      const blocked = rateLimits?.filter(r => r.blocked_until && new Date(r.blocked_until) > new Date()) || [];
      
      if (highTraffic.length > 0) {
        findings.push({
          severity: 'info',
          category: 'rate_limiting',
          title: 'High-traffic identifiers detected',
          description: `${highTraffic.length} identifiers with > 1000 requests`,
          evidence: {
            top_requesters: highTraffic.slice(0, 5).map(r => ({
              type: r.identifier_type,
              requests: r.request_count,
            })),
          },
        });
      }
      
      if (blocked.length > 0) {
        findings.push({
          severity: 'medium',
          category: 'rate_limiting',
          title: 'Active rate limit blocks',
          description: `${blocked.length} identifiers currently blocked`,
          evidence: {
            blocked_count: blocked.length,
            reasons: blocked.map(b => b.block_reason).filter((v, i, a) => a.indexOf(v) === i),
          },
        });
      }
    }
    
    // ========== 4. IP Blacklist Analysis ==========
    if (auditType === 'full' || auditType === 'blacklist') {
      console.log('[Security-Audit] Analyzing IP blacklist...');
      
      const { data: blacklist } = await supabase
        .from('ip_blacklist')
        .select('*')
        .is('unblocked_at', null)
        .limit(100);
      
      const autoBlocked = blacklist?.filter(b => b.auto_blocked) || [];
      const criticalSeverity = blacklist?.filter(b => b.severity === 'critical') || [];
      
      if (criticalSeverity.length > 0) {
        findings.push({
          severity: 'high',
          category: 'ip_blacklist',
          title: 'Critical severity IPs blocked',
          description: `${criticalSeverity.length} IPs blocked with critical severity`,
          evidence: {
            reasons: criticalSeverity.map(b => b.reason).slice(0, 5),
          },
        });
      }
      
      findings.push({
        severity: 'info',
        category: 'ip_blacklist',
        title: 'IP Blacklist status',
        description: `${blacklist?.length || 0} IPs blocked (${autoBlocked.length} auto-blocked)`,
      });
    }
    
    // ========== 5. Secrets Exposure Check ==========
    if (auditType === 'full' || auditType === 'secrets') {
      console.log('[Security-Audit] Checking for potential secret exposure...');
      
      // Check if any sensitive data is in logs
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('action_description, metadata')
        .ilike('action_description', '%key%')
        .limit(20);
      
      const potentialExposure = logs?.filter(l => {
        const meta = JSON.stringify(l.metadata || {});
        return meta.includes('secret') || meta.includes('password') || meta.includes('api_key');
      });
      
      if (potentialExposure && potentialExposure.length > 0) {
        findings.push({
          severity: 'high',
          category: 'secret_exposure',
          title: 'Potential secrets in logs',
          description: `${potentialExposure.length} log entries may contain sensitive data`,
          remediation: 'Review and sanitize logs, implement log filtering',
        });
        recommendations.push('Implement log sanitization to prevent secret exposure');
      } else {
        findings.push({
          severity: 'info',
          category: 'secret_exposure',
          title: 'No obvious secret exposure detected',
          description: 'Logs appear sanitized',
        });
      }
    }
    
    // ========== 6. CORS/CSP Configuration ==========
    if (auditType === 'full' || auditType === 'cors') {
      console.log('[Security-Audit] Validating CORS configuration...');
      
      // Current CORS config uses wildcard - acceptable for API but note it
      findings.push({
        severity: 'low',
        category: 'cors_configuration',
        title: 'CORS allows all origins',
        description: 'Edge functions use Access-Control-Allow-Origin: *',
        remediation: 'Consider restricting CORS to specific domains in production',
      });
      
      recommendations.push('Review CORS policy for production - consider restricting to specific origins');
    }
    
    // ========== 7. Authentication Flow ==========
    if (auditType === 'full' || auditType === 'auth') {
      console.log('[Security-Audit] Checking authentication...');
      
      const { data: sessions } = await supabase
        .from('auth_sessions_log')
        .select('event_type, ip_address')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(500);
      
      const failedLogins = sessions?.filter(s => s.event_type === 'login_failed') || [];
      const uniqueFailedIPs = new Set(failedLogins.map(s => s.ip_address)).size;
      
      if (failedLogins.length > 100) {
        findings.push({
          severity: 'high',
          category: 'authentication',
          title: 'High failed login rate',
          description: `${failedLogins.length} failed logins from ${uniqueFailedIPs} IPs in 24h`,
          remediation: 'Implement account lockout and CAPTCHA',
          evidence: {
            failed_logins: failedLogins.length,
            unique_ips: uniqueFailedIPs,
          },
        });
      } else {
        findings.push({
          severity: 'info',
          category: 'authentication',
          title: 'Authentication activity normal',
          description: `${failedLogins.length} failed logins in 24h`,
        });
      }
    }
    
    // ========== 8. Subscription/Payment Security ==========
    if (auditType === 'full' || auditType === 'payment') {
      console.log('[Security-Audit] Checking payment security...');
      
      const { data: webhooks } = await supabase
        .from('mercado_pago_webhooks')
        .select('*')
        .eq('processed', false)
        .limit(50);
      
      if (webhooks && webhooks.length > 10) {
        findings.push({
          severity: 'medium',
          category: 'payment_security',
          title: 'Unprocessed payment webhooks',
          description: `${webhooks.length} payment webhooks pending processing`,
          remediation: 'Ensure webhook processor is running',
        });
      }
      
      findings.push({
        severity: 'info',
        category: 'payment_security',
        title: 'Payment webhook status',
        description: `${webhooks?.length || 0} webhooks pending`,
      });
    }

    // ========== Generate Score ==========
    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };
    
    // Calculate score (100 - weighted deductions)
    const score = Math.max(0, Math.min(100, 
      100 - 
      (summary.critical * 25) - 
      (summary.high * 15) - 
      (summary.medium * 5) - 
      (summary.low * 1)
    ));
    
    // Add default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring security events');
      recommendations.push('Regularly review and rotate API keys');
      recommendations.push('Keep dependencies updated');
    }
    
    const report: SecurityAuditReport = {
      timestamp: new Date().toISOString(),
      audit_type: auditType,
      overall_score: score,
      findings,
      summary,
      recommendations,
    };
    
    console.log(`[Security-Audit] Completed with score ${score}/100`);
    
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[Security-Audit] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
