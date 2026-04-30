import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { MusicTrack } from '../../types'

interface MusicPlayerProps {
  track: MusicTrack
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getProxyUrl(previewUrl: string): string {
  return `/api/music/proxy-audio?url=${encodeURIComponent(previewUrl)}`
}

export default function MusicPlayer({ track }: MusicPlayerProps) {
  const setSelectedTrack = useAppStore((s) => s.setSelectedTrack)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(track.duration)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (track.previewUrl) {
      audio.src = getProxyUrl(track.previewUrl)
      audio.load()
      setPlaying(false)
      setCurrentTime(0)
    }
  }, [track.id, track.previewUrl])

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
    if (!audio || !track.previewUrl) return

    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
    setPlaying(!playing)
  }, [playing, track.previewUrl])

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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {track.coverUrl && (
            <img src={track.coverUrl} alt="" className="size-8 rounded-md object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-text truncate">{track.title}</div>
            <div className="text-[11px] text-text-dim truncate">{track.artist}</div>
          </div>
        </div>
        <button
          onClick={() => setSelectedTrack(track)}
          className="bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1 text-[11px] font-display font-semibold transition-colors duration-150 shrink-0 ml-2"
        >
          Use this track
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button className="text-text-dim hover:text-text transition-colors duration-150" aria-label="Previous">
          <SkipBack size={13} />
        </button>
        <button
          onClick={togglePlay}
          className="size-8 rounded-full bg-accent-dim flex items-center justify-center hover:bg-accent/30 transition-colors duration-150"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <Pause size={12} className="text-accent" />
          ) : (
            <Play size={12} className="text-accent ml-0.5" />
          )}
        </button>
        <button className="text-text-dim hover:text-text transition-colors duration-150" aria-label="Next">
          <SkipForward size={13} />
        </button>
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
