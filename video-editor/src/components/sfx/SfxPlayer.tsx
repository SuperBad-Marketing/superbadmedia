import { Play, Pause } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { EpidemicSfx } from '../../types'

interface SfxPlayerProps {
  sfx: EpidemicSfx
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getProxyUrl(previewUrl: string): string {
  return `/api/music/proxy-audio?url=${encodeURIComponent(previewUrl)}`
}

export default function SfxPlayer({ sfx }: SfxPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(sfx.duration)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (sfx.previewUrl) {
      audio.src = getProxyUrl(sfx.previewUrl)
      audio.load()
      setPlaying(false)
      setCurrentTime(0)
    }
  }, [sfx.id, sfx.previewUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !sfx.previewUrl) return

    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
    setPlaying(!playing)
  }, [playing, sfx.previewUrl])

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar) return

    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-bg border-t border-border p-4 flex flex-col gap-3">
      <audio ref={audioRef} preload="none" />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="size-8 rounded-full bg-accent-dim flex items-center justify-center hover:bg-accent/30 transition-colors duration-150 shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <Pause size={12} className="text-accent" />
          ) : (
            <Play size={12} className="text-accent ml-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-text truncate">{sfx.title}</div>
          <div className="text-[11px] text-text-dim truncate">{sfx.category}{sfx.subCategory !== sfx.category ? ` · ${sfx.subCategory}` : ''}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="h-1 bg-border rounded-full overflow-hidden cursor-pointer"
        >
          <div
            className="h-full bg-pink rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatTime(currentTime)}</span>
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}
