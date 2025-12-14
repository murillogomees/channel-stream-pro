/**
 * useIPTVPlayerEnterprise - Enterprise IPTV Player Hook
 * 
 * Features:
 * - Shaka Player Enterprise
 * - Stream group selection
 * - Session validation
 * - Auto token refresh
 * - Minimum egress
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { ShakaPlayerEngineEnterprise, PlayerState, PlayerError } from '@/components/player/engines/ShakaPlayerEngineEnterprise'
import { useStreamGroupSelection } from './useStreamGroupSelection'
import { useStreamSession } from './useStreamSession'

export interface UseIPTVPlayerEnterpriseOptions {
  autoPlay?: boolean
  isLive?: boolean
}

export interface UseIPTVPlayerEnterpriseReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  state: PlayerState
  error: PlayerError | null
  isReconnecting: boolean
  reconnectAttempt: number
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  egressBytes: number
  sessionValid: boolean
  sessionError: string | null
  // Actions
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  loadChannel: (channelId: number) => Promise<boolean>
  switchToFallback: () => Promise<boolean>
  destroy: () => void
}

export function useIPTVPlayerEnterprise(options: UseIPTVPlayerEnterpriseOptions = {}): UseIPTVPlayerEnterpriseReturn {
  const { autoPlay = true, isLive = true } = options
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<ShakaPlayerEngineEnterprise | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const currentChannelId = useRef<number | null>(null)

  const [state, setState] = useState<PlayerState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [egressBytes, setEgressBytes] = useState(0)
  const [sessionValid, setSessionValid] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const { selectBestSource, markSourceFailed, currentSource, resetFailedSources } = useStreamGroupSelection()
  const { validateSession, registerStream, endStream, refreshToken } = useStreamSession()

  // Initialize engine
  useEffect(() => {
    engineRef.current = new ShakaPlayerEngineEnterprise({
      isLive,
      onStateChange: (newState) => {
        setState(newState)
        setIsReconnecting(newState === 'reconnecting')
        if (newState !== 'reconnecting' && newState !== 'error') {
          setError(null)
        }
      },
      onError: (err, isFatal) => {
        setError(err)
        setIsReconnecting(false)
        
        // If fatal 403/auth error, try fallback source
        if (isFatal && err.code === 'SESSION_EXPIRED' && currentChannelId.current) {
          switchToFallback()
        }
      },
      onReconnecting: (attempt) => {
        setReconnectAttempt(attempt)
        setIsReconnecting(true)
      },
      onTokenExpired: async () => {
        const newToken = await refreshToken()
        return newToken || ''
      },
      onMetrics: (metrics) => {
        setEgressBytes(metrics.egressBytes)
      }
    })

    return () => {
      engineRef.current?.destroy()
      endStream()
    }
  }, [isLive, refreshToken, endStream])

  // Video time update
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration || 0)
    const handleVolumeChange = () => {
      setVolumeState(video.volume)
      setIsMuted(video.muted)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)

    containerRef.current = video.parentElement

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [])

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  /**
   * Load channel with full validation
   */
  const loadChannel = useCallback(async (channelId: number): Promise<boolean> => {
    if (!videoRef.current || !engineRef.current) return false
    
    currentChannelId.current = channelId
    resetFailedSources()
    setError(null)
    setSessionError(null)

    // Step 1: Validate session BEFORE anything (zero egress if invalid)
    const validation = await validateSession()
    setSessionValid(validation.isValid)
    
    if (!validation.canPlay) {
      setSessionError(validation.error)
      return false
    }

    // Step 2: Register stream
    const token = await registerStream(channelId)
    if (token) {
      engineRef.current.setToken(token)
    }

    // Step 3: Select best source
    const source = await selectBestSource(channelId)
    if (!source) {
      setError({ code: 'NO_SOURCE', message: 'Nenhuma fonte disponível', recoverable: false })
      return false
    }

    // Step 4: Load stream
    await engineRef.current.attach(videoRef.current, source.url, token || undefined)
    
    return true
  }, [validateSession, registerStream, selectBestSource, resetFailedSources])

  /**
   * Switch to fallback source
   */
  const switchToFallback = useCallback(async (): Promise<boolean> => {
    if (!currentSource || !currentChannelId.current) return false

    console.log('[Enterprise] Switching to fallback source')
    
    const nextSource = await markSourceFailed(currentSource.channelId)
    
    if (!nextSource) {
      setError({ code: 'ALL_SOURCES_FAILED', message: 'Todas as fontes falharam', recoverable: false })
      return false
    }

    if (videoRef.current && engineRef.current) {
      await engineRef.current.attach(videoRef.current, nextSource.url)
      return true
    }

    return false
  }, [currentSource, markSourceFailed])

  const play = useCallback(() => {
    engineRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    engineRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    if (state === 'playing') {
      pause()
    } else {
      play()
    }
  }, [state, play, pause])

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time)
  }, [])

  const setVolume = useCallback((vol: number) => {
    engineRef.current?.setVolume(vol)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.muted = !video.muted
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await container.requestFullscreen()
      }
    } catch (err) {
      console.error('[Enterprise] Fullscreen error:', err)
    }
  }, [])

  const destroy = useCallback(() => {
    engineRef.current?.destroy()
    endStream()
    currentChannelId.current = null
  }, [endStream])

  return {
    videoRef,
    state,
    error,
    isReconnecting,
    reconnectAttempt,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    egressBytes,
    sessionValid,
    sessionError,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    loadChannel,
    switchToFallback,
    destroy
  }
}
