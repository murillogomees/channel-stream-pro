/**
 * useShakaPlayer - React hook for Shaka Player integration
 * 
 * Features:
 * - Auto token refresh
 * - Proxy integration
 * - Quality selection
 * - Metrics collection
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { ShakaPlayerEngine, PlayerState, EngineMetrics } from '../engines/ShakaPlayerEngine'
import { tokenManager } from '../modules/TokenManager'

export interface UseShakaPlayerOptions {
  autoPlay?: boolean
  onMetrics?: (metrics: EngineMetrics) => void
}

export interface UseShakaPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  containerRef: React.RefObject<HTMLDivElement>
  state: PlayerState
  error: Error | null
  isRecovering: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  bufferLevel: number
  qualityLevels: QualityLevel[]
  currentQuality: number
  loadSource: (url: string) => Promise<void>
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  selectQuality: (index: number) => void
  reload: () => Promise<void>
}

export interface QualityLevel {
  index: number
  height: number
  bandwidth: number
  label: string
}

export function useShakaPlayer(options: UseShakaPlayerOptions = {}): UseShakaPlayerReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ShakaPlayerEngine | null>(null)

  // State
  const [state, setState] = useState<PlayerState>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [bufferLevel, setBufferLevel] = useState(0)
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)

  // Initialize engine
  useEffect(() => {
    engineRef.current = new ShakaPlayerEngine({
      onStateChange: (newState) => {
        setState(newState)
        if (newState === 'playing') {
          setIsRecovering(false)
          setError(null)
        }
      },
      onError: (err, isFatal) => {
        console.error('[useShakaPlayer] Error:', err.message, 'Fatal:', isFatal)
        if (isFatal) {
          setError(err)
          setIsRecovering(false)
        } else {
          setIsRecovering(true)
        }
      },
      onTokenExpired: async () => {
        console.log('[useShakaPlayer] Token expired, refreshing...')
        setIsRecovering(true)
        const token = await tokenManager.refreshToken()
        return token
      },
      onMetrics: (metrics) => {
        setBufferLevel(metrics.bufferLevel)
        options.onMetrics?.(metrics)
      }
    })

    return () => {
      engineRef.current?.destroy()
    }
  }, [])

  // Video element events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration)
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

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // ============ ACTIONS ============

  const loadSource = useCallback(async (url: string) => {
    if (!videoRef.current || !engineRef.current) {
      console.error('[useShakaPlayer] No video element or engine')
      return
    }

    setError(null)
    setIsRecovering(false)

    try {
      // Get fresh token
      const token = await tokenManager.getToken()
      
      // Attach engine
      await engineRef.current.attach(videoRef.current, url, token)

      // Update quality levels
      updateQualityLevels()
    } catch (err) {
      console.error('[useShakaPlayer] Load failed:', err)
      setError(err as Error)
    }
  }, [])

  const updateQualityLevels = useCallback(() => {
    const tracks = engineRef.current?.getVariantTracks() || []
    
    const levels: QualityLevel[] = tracks
      .filter((t, i, arr) => arr.findIndex(x => x.height === t.height) === i) // Unique heights
      .map((track, index) => ({
        index,
        height: track.height || 0,
        bandwidth: track.bandwidth || 0,
        label: track.height ? `${track.height}p` : 'Auto'
      }))
      .sort((a, b) => b.height - a.height)

    setQualityLevels(levels)
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
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((vol: number) => {
    engineRef.current?.setVolume(vol)
    if (videoRef.current) {
      videoRef.current.muted = false
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }, [])

  const selectQuality = useCallback((index: number) => {
    const tracks = engineRef.current?.getVariantTracks() || []
    if (tracks[index]) {
      engineRef.current?.selectVariantTrack(tracks[index])
      setCurrentQuality(index)
    }
  }, [])

  const reload = useCallback(async () => {
    await engineRef.current?.reload()
  }, [])

  return {
    videoRef,
    containerRef,
    state,
    error,
    isRecovering,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    bufferLevel,
    qualityLevels,
    currentQuality,
    loadSource,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    selectQuality,
    reload
  }
}

export default useShakaPlayer
