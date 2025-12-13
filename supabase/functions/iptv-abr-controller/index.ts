import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * IPTV Adaptive Bitrate Controller
 * Handles quality adaptation based on real-time network conditions
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NetworkConditions {
  bandwidth: number; // kbps
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
}

interface QualityLevel {
  id: string;
  bitrate: number;
  width: number;
  height: number;
  codec: string;
}

interface AdaptationDecision {
  targetQuality: QualityLevel;
  switchReason: string;
  confidence: number;
  bufferRecommendation: number;
}

// Quality ladder definition
const QUALITY_LADDER: QualityLevel[] = [
  { id: '4k', bitrate: 15000, width: 3840, height: 2160, codec: 'h264' },
  { id: '1080p', bitrate: 5000, width: 1920, height: 1080, codec: 'h264' },
  { id: '720p', bitrate: 2500, width: 1280, height: 720, codec: 'h264' },
  { id: '480p', bitrate: 1000, width: 854, height: 480, codec: 'h264' },
  { id: '360p', bitrate: 500, width: 640, height: 360, codec: 'h264' },
  { id: '240p', bitrate: 300, width: 426, height: 240, codec: 'h264' },
];

// ABR algorithm: BOLA-inspired (Buffer Occupancy based Lyapunov Algorithm)
function calculateBOLAQuality(
  bufferLevel: number, // seconds
  bandwidth: number, // kbps
  qualities: QualityLevel[]
): { quality: QualityLevel; utility: number } {
  const BUFFER_TARGET = 30; // seconds
  const GAMMA = 5; // utility scaling parameter
  
  // Calculate utility for each quality level
  const utilities = qualities.map((q, index) => {
    const utility = Math.log(q.bitrate / qualities[0].bitrate + 1);
    const V = (BUFFER_TARGET - 1) / (utility + GAMMA);
    const qualityScore = (V * utility + GAMMA * V - bufferLevel) / q.bitrate;
    
    return {
      quality: q,
      utility,
      score: qualityScore,
      feasible: q.bitrate <= bandwidth * 0.8, // 80% safety margin
    };
  });

  // Filter feasible qualities and select highest utility
  const feasible = utilities.filter(u => u.feasible);
  
  if (feasible.length === 0) {
    return { quality: qualities[qualities.length - 1], utility: 0 };
  }

  const selected = feasible.reduce((best, current) => 
    current.score > best.score ? current : best
  );

  return { quality: selected.quality, utility: selected.utility };
}

// Throughput estimation using exponential weighted moving average
function estimateThroughput(
  currentThroughput: number,
  previousEstimate: number,
  alpha: number = 0.3
): number {
  if (previousEstimate === 0) return currentThroughput;
  return alpha * currentThroughput + (1 - alpha) * previousEstimate;
}

// Calculate safe switching point based on buffer and segment duration
function calculateSafeSwitchPoint(
  bufferLevel: number,
  segmentDuration: number,
  currentBitrate: number,
  targetBitrate: number
): { canSwitch: boolean; waitTime: number } {
  const minSafeBuffer = segmentDuration * 3;
  
  if (targetBitrate > currentBitrate) {
    // Switching up - need more buffer safety
    const required = minSafeBuffer * 1.5;
    return {
      canSwitch: bufferLevel >= required,
      waitTime: bufferLevel < required ? (required - bufferLevel) * 1000 : 0,
    };
  } else {
    // Switching down - can do immediately
    return { canSwitch: true, waitTime: 0 };
  }
}

async function handleAdapt(params: {
  currentQuality: string;
  bufferLevel: number;
  network: NetworkConditions;
  segmentDuration?: number;
  previousEstimate?: number;
}): Promise<Response> {
  const {
    currentQuality,
    bufferLevel,
    network,
    segmentDuration = 4,
    previousEstimate = 0,
  } = params;

  console.log('[abr-controller] Adapting:', { currentQuality, bufferLevel, bandwidth: network.bandwidth });

  // Estimate throughput
  const estimatedThroughput = estimateThroughput(network.bandwidth, previousEstimate);

  // Apply network penalty for poor conditions
  let effectiveBandwidth = estimatedThroughput;
  if (network.jitter > 50) effectiveBandwidth *= 0.9;
  if (network.packetLoss > 2) effectiveBandwidth *= 0.85;
  if (network.latency > 200) effectiveBandwidth *= 0.9;

  // Calculate optimal quality using BOLA
  const { quality: targetQuality, utility } = calculateBOLAQuality(
    bufferLevel,
    effectiveBandwidth,
    QUALITY_LADDER
  );

  const currentQualityObj = QUALITY_LADDER.find(q => q.id === currentQuality) || QUALITY_LADDER[3];
  
  // Check if we can safely switch
  const switchSafety = calculateSafeSwitchPoint(
    bufferLevel,
    segmentDuration,
    currentQualityObj.bitrate,
    targetQuality.bitrate
  );

  // Determine switch reason
  let switchReason = 'stable';
  if (targetQuality.id !== currentQuality) {
    if (targetQuality.bitrate > currentQualityObj.bitrate) {
      switchReason = 'upgrade_bandwidth_available';
    } else if (bufferLevel < 10) {
      switchReason = 'downgrade_buffer_low';
    } else if (network.bandwidth < currentQualityObj.bitrate) {
      switchReason = 'downgrade_bandwidth_insufficient';
    }
  }

  // Calculate buffer recommendation
  const bufferRecommendation = targetQuality.bitrate > 2500 ? 30 : 20;

  const decision: AdaptationDecision = {
    targetQuality,
    switchReason,
    confidence: Math.min(100, Math.round(utility * 100)),
    bufferRecommendation,
  };

  return new Response(JSON.stringify({
    success: true,
    decision,
    canSwitch: switchSafety.canSwitch,
    waitTime: switchSafety.waitTime,
    throughputEstimate: Math.round(estimatedThroughput),
    effectiveBandwidth: Math.round(effectiveBandwidth),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetLadder(): Promise<Response> {
  return new Response(JSON.stringify({
    success: true,
    ladder: QUALITY_LADDER,
    segments: {
      defaultDuration: 4,
      minBufferTime: 10,
      maxBufferTime: 60,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSimulate(params: {
  duration: number; // seconds
  scenarios: Array<{ time: number; bandwidth: number; latency: number }>;
}): Promise<Response> {
  const { duration, scenarios } = params;

  const timeline: Array<{
    time: number;
    quality: string;
    buffer: number;
    bandwidth: number;
    switchEvent?: string;
  }> = [];

  let currentBuffer = 30;
  let currentQuality = '720p';
  let previousEstimate = 5000;

  for (let t = 0; t < duration; t++) {
    // Find applicable scenario
    const scenario = scenarios
      .filter(s => s.time <= t)
      .sort((a, b) => b.time - a.time)[0] || { bandwidth: 5000, latency: 50 };

    // Simulate buffer drain (1 second per second)
    currentBuffer = Math.max(0, currentBuffer - 1);

    // Simulate download (based on quality and bandwidth)
    const currentBitrate = QUALITY_LADDER.find(q => q.id === currentQuality)?.bitrate || 2500;
    const downloadTime = 4 * currentBitrate / scenario.bandwidth; // segment download time
    
    if (downloadTime < 4) {
      currentBuffer = Math.min(60, currentBuffer + (4 - downloadTime));
    }

    // Adapt quality
    const { quality } = calculateBOLAQuality(
      currentBuffer,
      estimateThroughput(scenario.bandwidth, previousEstimate),
      QUALITY_LADDER
    );

    const switchEvent = quality.id !== currentQuality ? `switch_to_${quality.id}` : undefined;
    currentQuality = quality.id;
    previousEstimate = estimateThroughput(scenario.bandwidth, previousEstimate);

    timeline.push({
      time: t,
      quality: currentQuality,
      buffer: Math.round(currentBuffer * 10) / 10,
      bandwidth: scenario.bandwidth,
      switchEvent,
    });
  }

  // Calculate stats
  const switches = timeline.filter(t => t.switchEvent).length;
  const rebuffers = timeline.filter(t => t.buffer === 0).length;
  const avgQuality = timeline.reduce((sum, t) => {
    const q = QUALITY_LADDER.find(q => q.id === t.quality);
    return sum + (q?.bitrate || 0);
  }, 0) / timeline.length;

  return new Response(JSON.stringify({
    success: true,
    timeline,
    stats: {
      totalSwitches: switches,
      rebufferEvents: rebuffers,
      avgBitrate: Math.round(avgQuality),
      avgBuffer: Math.round(timeline.reduce((s, t) => s + t.buffer, 0) / timeline.length * 10) / 10,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    console.log('[abr-controller] Action:', action);

    switch (action) {
      case 'adapt':
        return handleAdapt(params);
      case 'ladder':
        return handleGetLadder();
      case 'simulate':
        return handleSimulate(params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[abr-controller] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
