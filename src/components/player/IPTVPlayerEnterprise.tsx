/**
 * IPTVPlayerEnterprise - Enterprise White Label Player
 * 
 * Features:
 * - Session validation before play
 * - Silent reconnection
 * - Fallback switching
 * - Egress tracking
 * - TV remote support
 */

import React, { useEffect, useCallback } from 'react'
import { useIPTVPlayerEnterprise } from '@/hooks/useIPTVPlayerEnterprise'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, WifiOff, RefreshCw, Lock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BrandConfig {
  name?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface IPTVPlayerEnterpriseProps {
  channelId: number
  title?: string
  brand?: BrandConfig
  className?: string
  isLive?: boolean
  onBack?: () => void
  onChannelChange?: (channelId: number) => void
}

export function IPTVPlayerEnterprise({
  channelId,
  title,
  brand,
  className,
  isLive = true,
  onBack,
  onChannelChange
}: IPTVPlayerEnterpriseProps) {
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
    egressBytes,
    sessionValid,
    sessionError,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    loadChannel,
    switchToFallback,
    destroy
  } = useIPTVPlayerEnterprise({ isLive })

  // Load channel on mount or channelId change
  useEffect(() => {
    if (channelId) {
      loadChannel(channelId)
    }

    return () => {
      destroy()
    }
  }, [channelId, loadChannel, destroy])

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

  const formatEgress = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const showLoading = state === 'loading' || state === 'buffering'
  const showReconnecting = isReconnecting
  const showError = state === 'error' && error
  const showSessionError = sessionError && !sessionValid

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

      {/* Session Error Overlay (blocks everything) */}
      {showSessionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <Lock className="w-16 h-16 text-yellow-500" />
            <h3 className="text-white text-xl font-semibold">Acesso Bloqueado</h3>
            <p className="text-white/70 text-sm">{sessionError}</p>
            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: brand?.primaryColor || '#3b82f6' }}
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {showLoading && !showReconnecting && !showSessionError && (
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

      {/* Reconnecting Overlay */}
      {showReconnecting && !showSessionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-lg bg-black/60 backdrop-blur-sm">
            <RefreshCw 
              className="w-8 h-8 animate-spin" 
              style={{ color: brand?.accentColor || '#3b82f6' }}
            />
            <span className="text-white/90 text-sm">
              Reconectando... ({reconnectAttempt}/2)
            </span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {showError && !showSessionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            {error.code === 'SESSION_EXPIRED' ? (
              <Lock className="w-16 h-16 text-red-400" />
            ) : error.code === 'ALL_SOURCES_FAILED' ? (
              <AlertTriangle className="w-16 h-16 text-orange-400" />
            ) : (
              <WifiOff className="w-16 h-16 text-red-400" />
            )}
            <h3 className="text-white text-xl font-semibold">
              {error.code === 'SESSION_EXPIRED' && 'Sessão Expirada'}
              {error.code === 'ALL_SOURCES_FAILED' && 'Fontes Esgotadas'}
              {error.code !== 'SESSION_EXPIRED' && error.code !== 'ALL_SOURCES_FAILED' && 'Erro de Conexão'}
            </h3>
            <p className="text-white/70 text-sm">{error.message}</p>
            <div className="flex gap-3">
              {error.recoverable && (
                <button
                  onClick={() => loadChannel(channelId)}
                  className="px-6 py-2 rounded-lg text-white font-medium transition-colors"
                  style={{ backgroundColor: brand?.primaryColor || '#3b82f6' }}
                >
                  Tentar Novamente
                </button>
              )}
              <button
                onClick={() => switchToFallback()}
                className="px-6 py-2 rounded-lg text-white font-medium bg-orange-600 hover:bg-orange-700 transition-colors"
              >
                Trocar Fonte
              </button>
            </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand?.logo && (
              <img src={brand.logo} alt={brand.name} className="h-8 w-auto" />
            )}
            {title && (
              <h2 className="text-white text-lg font-medium truncate">{title}</h2>
            )}
          </div>
          {/* Egress indicator */}
          <div className="text-white/50 text-xs">
            Egress: {formatEgress(egressBytes)}
          </div>
        </div>
      </div>

      {/* Controls (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-5">
        {/* Progress bar (only for VOD) */}
        {!isLive && (
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
        )}

        {/* Live indicator */}
        {isLive && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/80 text-xs uppercase">Ao Vivo</span>
          </div>
        )}

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

export default IPTVPlayerEnterprise
