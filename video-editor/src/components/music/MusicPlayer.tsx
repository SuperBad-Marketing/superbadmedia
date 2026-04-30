import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useState } from 'react'
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

export default function MusicPlayer({ track }: MusicPlayerProps) {
  const setSelectedTrack = useAppStore((s) => s.setSelectedTrack)
  const [playing, setPlaying] = useState(false)
  const [progress] = useState(0)

  return (
    <div className="bg-bg border-t border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-text truncate">{track.title}</div>
          <div className="text-[11px] text-text-dim truncate">{track.artist}</div>
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
          onClick={() => setPlaying(!playing)}
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
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-pink rounded-full transition-all"
            style={{ width: `${(progress / track.duration) * 100}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatTime(progress)}</span>
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatTime(track.duration)}</span>
        </div>
      </div>
    </div>
  )
}
