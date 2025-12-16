import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ViewingPattern {
  channelId: number
  category: string
  viewCount: number
  avgDuration: number
  lastViewed: string
  timeOfDay: number // 0-23
  dayOfWeek: number // 0-6
}

interface PredictionResult {
  channelId: number
  channelName: string
  category: string
  confidence: number
  reason: string
}

// Simple ML-like scoring based on user patterns
function calculatePredictionScore(
  pattern: ViewingPattern,
  currentHour: number,
  currentDay: number
): number {
  let score = 0

  // Frequency score (0-30 points)
  score += Math.min(pattern.viewCount * 3, 30)

  // Recency score (0-25 points)
  const daysSinceViewed = (Date.now() - new Date(pattern.lastViewed).getTime()) / (1000 * 60 * 60 * 24)
  score += Math.max(25 - daysSinceViewed * 2, 0)

  // Time of day match (0-25 points)
  const hourDiff = Math.abs(pattern.timeOfDay - currentHour)
  score += Math.max(25 - hourDiff * 3, 0)

  // Day of week match (0-20 points)
  if (pattern.dayOfWeek === currentDay) {
    score += 20
  } else if (Math.abs(pattern.dayOfWeek - currentDay) === 1) {
    score += 10
  }

  return Math.min(score, 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { userId, currentChannelId, limit = 5 } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()

    console.log(`[predictive-preload] Generating predictions for user ${userId}`)

    // Get user viewing history
    const { data: history, error: historyError } = await supabase
      .from('user_viewing_history')
      .select('channel_id, category, watch_duration, watched_at')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(100)

    if (historyError) {
      console.error('History error:', historyError)
    }

    // Aggregate patterns
    const patterns = new Map<number, ViewingPattern>()

    for (const entry of history || []) {
      const existing = patterns.get(entry.channel_id)
      const watchedDate = new Date(entry.watched_at)

      if (existing) {
        existing.viewCount++
        existing.avgDuration = (existing.avgDuration + (entry.watch_duration || 0)) / 2
        if (watchedDate > new Date(existing.lastViewed)) {
          existing.lastViewed = entry.watched_at
          existing.timeOfDay = watchedDate.getHours()
          existing.dayOfWeek = watchedDate.getDay()
        }
      } else {
        patterns.set(entry.channel_id, {
          channelId: entry.channel_id,
          category: entry.category || 'unknown',
          viewCount: 1,
          avgDuration: entry.watch_duration || 0,
          lastViewed: entry.watched_at,
          timeOfDay: watchedDate.getHours(),
          dayOfWeek: watchedDate.getDay()
        })
      }
    }

    // Calculate predictions
    const predictions: PredictionResult[] = []

    for (const [channelId, pattern] of patterns) {
      // Skip current channel
      if (channelId === currentChannelId) continue

      const score = calculatePredictionScore(pattern, currentHour, currentDay)

      if (score > 30) { // Minimum threshold
        predictions.push({
          channelId,
          channelName: '', // Will be filled below
          category: pattern.category,
          confidence: score / 100,
          reason: score > 70 
            ? 'frequently_watched' 
            : score > 50 
              ? 'time_pattern_match'
              : 'category_preference'
        })
      }
    }

    // Sort by confidence and limit
    predictions.sort((a, b) => b.confidence - a.confidence)
    const topPredictions = predictions.slice(0, limit)

    // Get channel names for predictions
    if (topPredictions.length > 0) {
      const channelIds = topPredictions.map(p => p.channelId)
      const { data: channels } = await supabase
        .from('iptv_channels')
        .select('id, name')
        .in('id', channelIds)

      for (const prediction of topPredictions) {
        const channel = channels?.find(c => c.id === prediction.channelId)
        if (channel) {
          prediction.channelName = channel.name
        }
      }
    }

    // Also get category-based suggestions if not enough predictions
    if (topPredictions.length < limit) {
      // Find most watched categories
      const categoryCount = new Map<string, number>()
      for (const pattern of patterns.values()) {
        const count = categoryCount.get(pattern.category) || 0
        categoryCount.set(pattern.category, count + pattern.viewCount)
      }

      const topCategories = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat)

      if (topCategories.length > 0) {
        const { data: categoryChannels } = await supabase
          .from('iptv_channels')
          .select('id, name, category')
          .in('category', topCategories)
          .eq('is_healthy', true)
          .limit(limit - topPredictions.length)

        for (const channel of categoryChannels || []) {
          if (!topPredictions.find(p => p.channelId === channel.id) && channel.id !== currentChannelId) {
            topPredictions.push({
              channelId: channel.id,
              channelName: channel.name,
              category: channel.category || 'unknown',
              confidence: 0.3,
              reason: 'category_preference'
            })
          }
        }
      }
    }

    console.log(`[predictive-preload] Generated ${topPredictions.length} predictions`)

    return new Response(
      JSON.stringify({
        predictions: topPredictions.slice(0, limit),
        metadata: {
          totalPatterns: patterns.size,
          currentHour,
          currentDay
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[predictive-preload] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
