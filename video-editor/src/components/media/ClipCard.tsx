import { Film, Plus, Check, Smile, User } from 'lucide-react'
import type { Clip } from '../../types'
import { useAppStore } from '../../stores/appStore'
import { thumbUrl } from '../../lib/thumbUrl'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
  const a = clip.analysis

  return (
    <div
      onClick={onClick}
      className={`group rounded-lg overflow-hidden cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'ring-1 ring-accent/50 bg-accent-dim'
          : 'hover:bg-surface-hover'
      }`}
    >
      <div className="aspect-video bg-bg flex items-center justify-center overflow-hidden relative">
        {clip.thumbnailPath ? (
          <img
            src={thumbUrl(clip.thumbnailPath)}
            alt={clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Film size={16} className="text-text-dim/40" />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isInStoryboard) addToStoryboard(clip)
          }}
          className={`absolute top-1 right-1 size-5 rounded-full flex items-center justify-center transition-all duration-150 ${
            isInStoryboard
              ? 'bg-green/90 text-white'
              : 'bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-accent/90 hover:text-white'
          }`}
          title={isInStoryboard ? 'In storyboard' : 'Add to storyboard'}
        >
          {isInStoryboard ? <Check size={9} /> : <Plus size={9} />}
        </button>

        {/* Vision badges */}
        <div className="absolute top-1 left-1 flex gap-0.5">
          {a?.hasSmiles && (
            <span className="size-4 rounded-full bg-black/50 flex items-center justify-center" title="Smiles detected">
              <Smile size={9} className="text-orange" />
            </span>
          )}
          {a?.hasFaces && !a?.hasSmiles && (
            <span className="size-4 rounded-full bg-black/50 flex items-center justify-center" title={`${a.faceCount} face${a.faceCount !== 1 ? 's' : ''}`}>
              <User size={9} className="text-pink" />
            </span>
          )}
        </div>

        {/* Scene type badge */}
        {a?.sceneType && a.visionAnalyzed && (
          <span className="absolute bottom-1 left-1 text-[8px] text-white/80 bg-black/50 rounded px-1 py-px font-mono uppercase">
            {a.sceneType}
          </span>
        )}

        <span className="absolute bottom-1 right-1 font-mono text-[9px] text-white/70 bg-black/50 rounded px-1 py-px tabular-nums">
          {formatDuration(clip.duration)}
        </span>
      </div>

      <div className="px-1.5 py-1.5">
        <span className="text-[10px] text-text-muted truncate block leading-tight">{clip.fileName}</span>
        {a?.visionAnalyzed && a.description ? (
          <p className="text-[9px] text-text-dim mt-0.5 leading-snug line-clamp-2">{a.description}</p>
        ) : a && a.contentTags.length > 0 ? (
          <div className="flex gap-1 mt-1">
            {a.contentTags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[8px] text-text-dim font-mono uppercase">{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
