import { Film, Star, Plus, Check } from 'lucide-react'
import type { Clip } from '../../types'
import { useAppStore } from '../../stores/appStore'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const energyColors: Record<string, string> = {
  static: 'bg-text-dim',
  low: 'bg-green',
  medium: 'bg-amber',
  high: 'bg-orange',
}

interface ClipCardProps {
  clip: Clip
  onClick?: () => void
  isSelected?: boolean
}

export default function ClipCard({ clip, onClick, isSelected }: ClipCardProps) {
  const addToStoryboard = useAppStore((s) => s.addToStoryboard)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const isInStoryboard = storyboardClips.some((sc) => sc.clipId === clip.id)

  return (
    <div
      onClick={onClick}
      className={`group w-full text-left rounded-lg border transition-colors duration-150 overflow-hidden cursor-pointer ${
        isSelected
          ? 'border-accent ring-1 ring-accent/30'
          : 'border-border hover:border-border-active'
      }`}
    >
      <div className="aspect-video bg-bg flex items-center justify-center overflow-hidden relative">
        {clip.thumbnailPath ? (
          <img
            src={clip.thumbnailPath}
            alt={clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Film size={20} className="text-text-dim" />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isInStoryboard) addToStoryboard(clip)
          }}
          className={`absolute top-1 right-1 size-6 rounded-full flex items-center justify-center transition-all duration-150 ${
            isInStoryboard
              ? 'bg-green text-white'
              : 'bg-bg/70 text-text-muted opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white'
          }`}
          title={isInStoryboard ? 'In storyboard' : 'Add to storyboard'}
        >
          {isInStoryboard ? <Check size={11} /> : <Plus size={11} />}
        </button>

        <span className="absolute bottom-1 right-1 font-mono text-[10px] text-white/80 bg-black/50 rounded px-1 py-0.5 tabular-nums">
          {formatDuration(clip.duration)}
        </span>
      </div>

      <div className="p-2 space-y-1.5">
        <span className="text-xs text-text truncate block">{clip.fileName}</span>

        {clip.analysis && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={9}
                    className={
                      i < clip.analysis!.qualityRating
                        ? 'text-amber fill-amber'
                        : 'text-border'
                    }
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1 w-5 rounded-full ${
                    energyColors[clip.analysis.movementLevel] || 'bg-text-dim'
                  }`}
                />
                <span className="text-[9px] text-text-dim capitalize font-mono">
                  {clip.analysis.movementLevel}
                </span>
              </div>
            </div>

            {clip.analysis.contentTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {clip.analysis.contentTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface-active text-text-dim text-[9px] rounded px-1.5 py-0.5 font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
