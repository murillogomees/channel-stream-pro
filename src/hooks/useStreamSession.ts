/**
 * useStreamSession - Controle de sessão e concorrência
 * 
 * Features:
 * - Valida autenticação
 * - Valida plano ativo
 * - Controla streams simultâneos
 * - Bloqueia antes do play (zero egress)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface SessionValidation {
  isValid: boolean
  error: string | null
  canPlay: boolean
}

export interface SessionLimits {
  maxConcurrentStreams: number
  currentStreams: number
  planActive: boolean
  planExpiry: string | null
}

const MAX_CONCURRENT_STREAMS = 2 // Default limit

export function useStreamSession() {
  const { user } = useAuth()
  const [sessionId] = useState(() => `stream_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`)
  const [limits, setLimits] = useState<SessionLimits | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const heartbeatInterval = useRef<number | null>(null)

  /**
   * Validate session before playing
   */
  const validateSession = useCallback(async (): Promise<SessionValidation> => {
    if (!user) {
      return {
        isValid: false,
        error: 'Usuário não autenticado',
        canPlay: false
      }
    }

    setIsValidating(true)

    try {
      // Get user profile with subscription info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, plano, data_vencimento, cliente_ativo')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return {
          isValid: false,
          error: 'Perfil não encontrado',
          canPlay: false
        }
      }

      // Check if plan is active
      if (!profile.cliente_ativo) {
        return {
          isValid: false,
          error: 'Sua conta está inativa',
          canPlay: false
        }
      }

      // Check expiry
      if (profile.data_vencimento) {
        const expiry = new Date(profile.data_vencimento)
        if (expiry < new Date()) {
          return {
            isValid: false,
            error: 'Sua assinatura expirou',
            canPlay: false
          }
        }
      }

      // Check concurrent streams (via stream tokens)
      const { count: activeStreams } = await supabase
        .from('iptv_stream_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())

      const currentStreams = activeStreams || 0

      if (currentStreams >= MAX_CONCURRENT_STREAMS) {
        return {
          isValid: false,
          error: `Limite de ${MAX_CONCURRENT_STREAMS} streams simultâneos atingido`,
          canPlay: false
        }
      }

      setLimits({
        maxConcurrentStreams: MAX_CONCURRENT_STREAMS,
        currentStreams,
        planActive: true,
        planExpiry: profile.data_vencimento
      })

      return {
        isValid: true,
        error: null,
        canPlay: true
      }
    } catch (err) {
      console.error('[StreamSession] Validation error:', err)
      return {
        isValid: false,
        error: 'Erro ao validar sessão',
        canPlay: false
      }
    } finally {
      setIsValidating(false)
    }
  }, [user])

  /**
   * Register stream session (creates token)
   */
  const registerStream = useCallback(async (channelId: number): Promise<string | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('iptv_stream_tokens')
        .insert({
          user_id: user.id,
          channel_id: channelId,
          token: sessionId,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours
        })
        .select()
        .single()

      if (error) {
        console.error('[StreamSession] Register error:', error)
        return null
      }

      console.log('[StreamSession] Registered stream:', data.id)
      
      // Start heartbeat
      startHeartbeat()
      
      return data.token
    } catch (err) {
      console.error('[StreamSession] Register error:', err)
      return null
    }
  }, [user, sessionId])

  /**
   * Heartbeat to keep session alive
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) return

    heartbeatInterval.current = window.setInterval(async () => {
      if (!user) return

      await supabase
        .from('iptv_stream_tokens')
        .update({
          used_at: new Date().toISOString()
        })
        .eq('token', sessionId)
    }, 60000) // Every minute
  }, [user, sessionId])

  /**
   * End stream session
   */
  const endStream = useCallback(async () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }

    if (!user) return

    try {
      await supabase
        .from('iptv_stream_tokens')
        .delete()
        .eq('token', sessionId)

      console.log('[StreamSession] Stream ended')
    } catch (err) {
      console.error('[StreamSession] End error:', err)
    }
  }, [user, sessionId])

  /**
   * Refresh stream token
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null

    try {
      const newToken = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      
      await supabase
        .from('iptv_stream_tokens')
        .update({
          token: newToken,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        })
        .eq('token', sessionId)

      console.log('[StreamSession] Token refreshed')
      return newToken
    } catch (err) {
      console.error('[StreamSession] Refresh error:', err)
      return null
    }
  }, [user, sessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endStream()
    }
  }, [endStream])

  return {
    sessionId,
    limits,
    isValidating,
    validateSession,
    registerStream,
    endStream,
    refreshToken
  }
}
