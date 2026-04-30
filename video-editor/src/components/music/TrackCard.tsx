import { Play } from 'lucide-react'
import type { MusicTrack } from '../../types'

interface TrackCardProps {
  track: MusicTrack
  isSelected?: boolean
  onSelect: (track: MusicTrack) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrackCard({ track, isSelected, onSelect }: TrackCardProps) {
  return (
    <button
      onClick={() => onSelect(track)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-surface-active border border-accent'
          : 'border border-transparent hover:bg-surface-hover'
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-surface-active flex items-center justify-center shrink-0">
        <Play size={12} className="text-text ml-0.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{track.title}</div>
        <div className="text-xs text-text-muted truncate">{track.artist}</div>
        {track.mood.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {track.mood.slice(0, 2).map((m) => (
              <span key={m} className="text-[10px] text-text-dim">{m}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="font-mono text-xs text-text-dim">{track.bpm}</span>
        <span className="text-xs text-text-dim">{formatDuration(track.duration)}</span>
      </div>
    </button>
  )
}
