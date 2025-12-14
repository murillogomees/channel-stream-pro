/**
 * useStreamGroupSelection - Seleção inteligente de stream por grupo
 * 
 * Features:
 * - Score baseado em erros recentes
 * - Fallback automático
 * - Nunca repete fonte com erro
 */

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface StreamSource {
  channelId: number
  url: string
  healthScore: number
  lastError: string | null
  lastErrorAt: string | null
  isCanonical: boolean
}

export interface StreamGroup {
  groupId: string
  sources: StreamSource[]
}

interface SourceScore {
  channelId: number
  score: number
  url: string
}

export function useStreamGroupSelection() {
  const [currentSource, setCurrentSource] = useState<StreamSource | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const failedSources = useRef<Set<number>>(new Set())

  /**
   * Get all sources for a stream group
   */
  const getStreamGroup = useCallback(async (channelId: number): Promise<StreamGroup | null> => {
    try {
      // Get the channel
      const { data: channel, error: channelError } = await supabase
        .from('iptv_channels')
        .select('id, original_url, health_score, probe_error, last_probe_at')
        .eq('id', channelId)
        .single()

      if (channelError || !channel) {
        console.error('[StreamGroupSelection] Channel not found:', channelId)
        return null
      }

      // Return single source (stream_group_id support pending migration)
      return {
        groupId: `single_${channelId}`,
        sources: [{
          channelId: channel.id,
          url: channel.original_url,
          healthScore: channel.health_score || 100,
          lastError: channel.probe_error,
          lastErrorAt: channel.last_probe_at,
          isCanonical: true
        }]
      }
    } catch (err) {
      console.error('[StreamGroupSelection] Error:', err)
      return null
    }
  }, [])

  /**
   * Calculate score for a source
   */
  const calculateScore = useCallback((source: StreamSource): number => {
    let score = source.healthScore

    // Penalize if has recent error (last 1 hour)
    if (source.lastError && source.lastErrorAt) {
      const errorAge = Date.now() - new Date(source.lastErrorAt).getTime()
      const oneHour = 60 * 60 * 1000

      if (errorAge < oneHour) {
        score -= 50 // Heavy penalty for recent errors
      } else if (errorAge < oneHour * 24) {
        score -= 20 // Lighter penalty for older errors
      }
    }

    // Penalize if failed in this session
    if (failedSources.current.has(source.channelId)) {
      score -= 100 // Never retry failed source in same session
    }

    // Bonus for canonical
    if (source.isCanonical) {
      score += 10
    }

    return Math.max(0, score)
  }, [])

  /**
   * Select best source from group
   */
  const selectBestSource = useCallback(async (channelId: number): Promise<StreamSource | null> => {
    setIsLoading(true)

    try {
      const group = await getStreamGroup(channelId)
      
      if (!group || group.sources.length === 0) {
        console.error('[StreamGroupSelection] No sources available')
        return null
      }

      // Score all sources
      const scoredSources: SourceScore[] = group.sources.map(source => ({
        channelId: source.channelId,
        score: calculateScore(source),
        url: source.url
      }))

      // Sort by score descending
      scoredSources.sort((a, b) => b.score - a.score)

      // Filter out sources with 0 score (failed in session)
      const validSources = scoredSources.filter(s => s.score > 0)

      if (validSources.length === 0) {
        console.error('[StreamGroupSelection] All sources exhausted')
        // Reset failed sources and try again with original
        failedSources.current.clear()
        const best = group.sources.find(s => s.isCanonical) || group.sources[0]
        setCurrentSource(best)
        return best
      }

      const bestSourceId = validSources[0].channelId
      const best = group.sources.find(s => s.channelId === bestSourceId)!

      console.log('[StreamGroupSelection] Selected:', best.channelId, 'score:', validSources[0].score)
      setCurrentSource(best)
      return best
    } catch (err) {
      console.error('[StreamGroupSelection] Error selecting source:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [getStreamGroup, calculateScore])

  /**
   * Mark source as failed and get next best
   */
  const markSourceFailed = useCallback(async (channelId: number): Promise<StreamSource | null> => {
    console.log('[StreamGroupSelection] Marking failed:', channelId)
    failedSources.current.add(channelId)

    // Update database with failure
    await supabase
      .from('iptv_channels')
      .update({
        health_score: 0,
        probe_error: 'Playback failed',
        last_probe_at: new Date().toISOString()
      })
      .eq('id', channelId)

    // Get next best source
    return selectBestSource(channelId)
  }, [selectBestSource])

  /**
   * Reset failed sources (for new session)
   */
  const resetFailedSources = useCallback(() => {
    failedSources.current.clear()
    setCurrentSource(null)
  }, [])

  return {
    currentSource,
    isLoading,
    selectBestSource,
    markSourceFailed,
    resetFailedSources,
    failedCount: failedSources.current.size
  }
}
