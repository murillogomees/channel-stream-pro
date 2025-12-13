/**
 * useIPTVPlayer - Hook para o Player IPTV Modular
 * 
 * Encapsula o PlayerController para uso em React
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { PlayerController, PlayerState } from '../modules/PlayerController'
import { PlayerError } from '../modules/ErrorManager'
import { SessionMetrics } from '../modules/MetricsCollector'

export interface UseIPTVPlayerOptions {
  userId?: string
  contentId?: string
  autoPlay?: boolean
}

export interface UseIPTVPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  containerRef: React.RefObject<HTMLDivElement>
  state: PlayerState
  error: PlayerError | null
  isRecovering: boolean
  recoveryAttempt: number
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  metrics: SessionMetrics | null
  
  // Actions
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  reload: () => void
  loadSource: (url: string) => void
}

export function useIPTVPlayer(options: UseIPTVPlayerOptions = {}): UseIPTVPlayerReturn {
  const { userId, contentId, autoPlay = true } = options
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<PlayerController | null>(null)

  const [state, setState] = useState<PlayerState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null)

  // Initialize controller
  useEffect(() => {
    controllerRef.current = new PlayerController({
      onStateChange: (newState) => {
        setState(newState)
        setIsRecovering(newState === 'recovering')
        if (newState !== 'recovering' && newState !== 'error') {
          setError(null)
          setRecoveryAttempt(0)
        }
      },
      onError: (err) => {
        setError(err)
        setIsRecovering(false)
      },
      onRecovering: (attempt) => {
        setRecoveryAttempt(attempt)
        setIsRecovering(true)
      },
      onMetrics: () => {
        if (controllerRef.current) {
          setMetrics(controllerRef.current.getMetrics())
        }
      }
    })

    return () => {
      controllerRef.current?.destroy()
    }
  }, [])

  // Video time/volume updates
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

  const loadSource = useCallback(async (url: string) => {
    if (!videoRef.current || !controllerRef.current) return
    
    setError(null)
    setIsRecovering(false)
    setRecoveryAttempt(0)
    
    await controllerRef.current.init(videoRef.current, url, userId, contentId)
  }, [userId, contentId])

  const play = useCallback(() => {
    controllerRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    controllerRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay()
  }, [])

  const seek = useCallback((time: number) => {
    controllerRef.current?.seek(time)
  }, [])

  const setVolume = useCallback((vol: number) => {
    controllerRef.current?.setVolume(vol)
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
      console.error('[useIPTVPlayer] Fullscreen error:', err)
    }
  }, [])

  const reload = useCallback(async () => {
    await controllerRef.current?.reloadStream()
  }, [])

  return {
    videoRef,
    containerRef,
    state,
    error,
    isRecovering,
    recoveryAttempt,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    metrics,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    reload,
    loadSource
  }
}
