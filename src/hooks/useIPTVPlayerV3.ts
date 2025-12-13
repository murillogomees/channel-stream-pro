/**
 * useIPTVPlayerV3 - Enterprise IPTV Player Hook with Auto Token Refresh
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { PlayerEngineV3, PlayerState, PlayerError } from '@/components/player/core/PlayerEngineV3'

export interface UseIPTVPlayerV3Options {
  autoPlay?: boolean
}

export interface UseIPTVPlayerV3Return {
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
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  loadSource: (url: string) => void
}

export function useIPTVPlayerV3(options: UseIPTVPlayerV3Options = {}): UseIPTVPlayerV3Return {
  const { autoPlay = true } = options
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<PlayerEngineV3 | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  const [state, setState] = useState<PlayerState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Initialize engine
  useEffect(() => {
    engineRef.current = new PlayerEngineV3({
      onStateChange: (newState) => {
        setState(newState)
        setIsReconnecting(newState === 'reconnecting')
        if (newState !== 'reconnecting' && newState !== 'error') {
          setError(null)
        }
      },
      onError: (err) => {
        setError(err)
        setIsReconnecting(false)
      },
      onReconnecting: (attempt) => {
        setReconnectAttempt(attempt)
        setIsReconnecting(true)
      },
      onTokenRefresh: () => {
        console.log('[useIPTVPlayerV3] Token refreshed')
      }
    })

    return () => {
      engineRef.current?.destroy()
    }
  }, [])

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

    // Set container for fullscreen
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

  const loadSource = useCallback(async (url: string) => {
    if (!videoRef.current || !engineRef.current) return
    
    setError(null)
    setIsReconnecting(false)
    setReconnectAttempt(0)
    
    await engineRef.current.attach(videoRef.current, url)
  }, [])

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
      console.error('[useIPTVPlayerV3] Fullscreen error:', err)
    }
  }, [])

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
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    loadSource
  }
}
