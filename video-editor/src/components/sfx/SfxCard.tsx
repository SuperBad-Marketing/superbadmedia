import { Play } from 'lucide-react'
import type { EpidemicSfx } from '../../types'

interface SfxCardProps {
  sfx: EpidemicSfx
  isSelected?: boolean
  onSelect: (sfx: EpidemicSfx) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SfxCard({ sfx, isSelected, onSelect }: SfxCardProps) {
  return (
    <button
      onClick={() => onSelect(sfx)}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-left transition-colors duration-150 ${
        isSelected
          ? 'bg-surface-active border border-accent/40'
          : 'border border-transparent hover:bg-surface-hover'
      }`}
    >
      <div className={`size-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 ${
        isSelected ? 'bg-accent-dim' : 'bg-surface-active'
      }`}>
        <Play size={12} className={`ml-0.5 transition-colors duration-150 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{sfx.title}</div>
        <div className="flex gap-1.5 mt-1">
          <span className="text-[10px] text-pink font-mono">{sfx.category}</span>
          {sfx.subCategory && sfx.subCategory !== sfx.category && (
            <span className="text-[10px] text-text-dim font-mono">{sfx.subCategory}</span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatDuration(sfx.duration)}</span>
      </div>
    </button>
  )
}
