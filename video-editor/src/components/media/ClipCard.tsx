import { Film, Star } from 'lucide-react'
import type { Clip } from '../../types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const energyColors: Record<string, string> = {
  static: 'bg-text-dim',
  low: 'bg-green',
  medium: 'bg-amber',
  high: 'bg-accent',
}

interface ClipCardProps {
  clip: Clip
  onClick?: () => void
  isSelected?: boolean
}

export default function ClipCard({ clip, onClick, isSelected }: ClipCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-lg border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-accent ring-1 ring-accent'
          : 'border-border hover:border-border-active'
      } hover:brightness-110`}
    >
      <div className="aspect-video bg-surface-active rounded-t-lg flex items-center justify-center overflow-hidden">
        {clip.thumbnailPath ? (
          <img
            src={clip.thumbnailPath}
            alt={clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Film size={24} className="text-text-dim" />
        )}
      </div>

      <div className="p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text truncate">{clip.fileName}</span>
          <span className="font-mono text-text-dim text-xs shrink-0">
            {formatDuration(clip.duration)}
          </span>
        </div>

        {clip.analysis && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={10}
                    className={
                      i < clip.analysis!.qualityRating
                        ? 'text-amber fill-amber'
                        : 'text-text-dim'
                    }
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-6 rounded-full ${
                    energyColors[clip.analysis.movementLevel] || 'bg-text-dim'
                  }`}
                />
                <span className="text-[10px] text-text-dim capitalize">
                  {clip.analysis.movementLevel}
                </span>
              </div>
            </div>

            {clip.analysis.contentTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {clip.analysis.contentTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface text-text-dim text-[10px] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </button>
  )
}
