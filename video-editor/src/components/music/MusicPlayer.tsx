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
    <div className="bg-surface-active border-t border-border p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text truncate">{track.title}</div>
          <div className="text-xs text-text-muted truncate">{track.artist}</div>
        </div>
        <button
          onClick={() => setSelectedTrack(track)}
          className="bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1 text-xs font-semibold transition-colors shrink-0 ml-2"
        >
          Use this track
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button className="text-text-dim hover:text-text transition-colors">
          <SkipBack size={14} />
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="w-7 h-7 rounded-full bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors"
        >
          {playing ? (
            <Pause size={12} className="text-text" />
          ) : (
            <Play size={12} className="text-text ml-0.5" />
          )}
        </button>
        <button className="text-text-dim hover:text-text transition-colors">
          <SkipForward size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${(progress / track.duration) * 100}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-xs text-text-dim">{formatTime(progress)}</span>
          <span className="font-mono text-xs text-text-dim">{formatTime(track.duration)}</span>
        </div>
      </div>
    </div>
  )
}
