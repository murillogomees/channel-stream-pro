/**
 * IPTVPlayerWhiteLabelV3 - Enterprise White Label Player with Auto Token Refresh
 * 
 * Features:
 * - Silent reconnection (no popup during refresh)
 * - Elegant loading states
 * - Human-friendly error messages
 * - TV remote navigation support
 * - Responsive design
 */

import React, { useEffect, useCallback } from 'react'
import { useIPTVPlayerV3 } from '@/hooks/useIPTVPlayerV3'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BrandConfig {
  name?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface IPTVPlayerWhiteLabelV3Props {
  streamUrl: string
  title?: string
  brand?: BrandConfig
  className?: string
  onBack?: () => void
}

export function IPTVPlayerWhiteLabelV3({
  streamUrl,
  title,
  brand,
  className,
  onBack
}: IPTVPlayerWhiteLabelV3Props) {
  const {
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
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    loadSource
  } = useIPTVPlayerV3()

  // Load source on mount or URL change
  useEffect(() => {
    if (streamUrl) {
      loadSource(streamUrl)
    }
  }, [streamUrl, loadSource])

  // Keyboard navigation (TV remote support)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        seek(Math.max(0, currentTime - 10))
        break
      case 'ArrowRight':
        seek(Math.min(duration, currentTime + 10))
        break
      case 'ArrowUp':
        setVolume(Math.min(1, volume + 0.1))
        break
      case 'ArrowDown':
        setVolume(Math.max(0, volume - 0.1))
        break
      case 'm':
        toggleMute()
        break
      case 'f':
        toggleFullscreen()
        break
      case 'Escape':
        onBack?.()
        break
    }
  }, [togglePlay, seek, currentTime, duration, volume, setVolume, toggleMute, toggleFullscreen, onBack])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Determine overlay state
  const showLoading = state === 'loading' || state === 'buffering'
  const showReconnecting = isReconnecting
  const showError = state === 'error' && error

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-black overflow-hidden group",
        className
      )}
      style={{ fontFamily: brand?.fontFamily }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
      />

      {/* Loading Overlay - Elegant spinner */}
      {showLoading && !showReconnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 
              className="w-12 h-12 animate-spin" 
              style={{ color: brand?.primaryColor || '#fff' }}
            />
            <span className="text-white/80 text-sm">Carregando...</span>
          </div>
        </div>
      )}

      {/* Reconnecting Overlay - Silent, minimal */}
      {showReconnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-lg bg-black/60 backdrop-blur-sm">
            <RefreshCw 
              className="w-8 h-8 animate-spin" 
              style={{ color: brand?.accentColor || '#3b82f6' }}
            />
            <span className="text-white/90 text-sm">
              Reconectando... ({reconnectAttempt}/3)
            </span>
          </div>
        </div>
      )}

      {/* Error Overlay - Human friendly */}
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <WifiOff className="w-16 h-16 text-red-400" />
            <h3 className="text-white text-xl font-semibold">
              {error.code === 'SESSION_EXPIRED' 
                ? 'Sessão Expirada' 
                : 'Erro de Conexão'}
            </h3>
            <p className="text-white/70 text-sm">
              {error.message}
            </p>
            {error.recoverable && (
              <button
                onClick={() => loadSource(streamUrl)}
                className="px-6 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ 
                  backgroundColor: brand?.primaryColor || '#3b82f6',
                }}
              >
                Tentar Novamente
              </button>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-white/60 hover:text-white text-sm"
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Title & Brand (top) */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-5">
        <div className="flex items-center gap-3">
          {brand?.logo && (
            <img src={brand.logo} alt={brand.name} className="h-8 w-auto" />
          )}
          {title && (
            <h2 className="text-white text-lg font-medium truncate">{title}</h2>
          )}
        </div>
      </div>

      {/* Controls (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-5">
        {/* Progress bar */}
        <div className="mb-3">
          <div 
            className="h-1 bg-white/20 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const percent = (e.clientX - rect.left) / rect.width
              seek(percent * duration)
            }}
          >
            <div 
              className="h-full rounded-full transition-all"
              style={{ 
                width: `${progress}%`,
                backgroundColor: brand?.primaryColor || '#3b82f6'
              }}
            />
          </div>
          <div className="flex justify-between text-white/60 text-xs mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {state === 'playing' ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Volume slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${brand?.primaryColor || '#3b82f6'} ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
              }}
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
