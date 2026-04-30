import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Film, GripVertical, X } from 'lucide-react'
import type { StoryboardClip } from '../../types'
import { useAppStore } from '../../stores/appStore'

interface StoryboardClipCardProps {
  storyboardClip: StoryboardClip
  index: number
}

export default function StoryboardClipCard({ storyboardClip }: StoryboardClipCardProps) {
  const removeFromStoryboard = useAppStore((s) => s.removeFromStoryboard)
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: storyboardClip.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const duration = storyboardClip.endTime - storyboardClip.startTime

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-40 min-w-40 bg-surface rounded-lg overflow-hidden transition-all duration-150 ${
        isDragging
          ? 'opacity-50 ring-2 ring-accent'
          : 'hover:bg-surface-hover'
      }`}
    >
      <div className="aspect-video bg-bg flex items-center justify-center relative group/thumb">
        {storyboardClip.clip.thumbnailPath ? (
          <img
            src={storyboardClip.clip.thumbnailPath}
            alt={storyboardClip.clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Film size={16} className="text-text-dim" />
        )}
        <button
          onClick={() => removeFromStoryboard(storyboardClip.id)}
          className="absolute top-1.5 right-1.5 size-5 rounded-full bg-black/50 text-text-muted opacity-0 group-hover/thumb:opacity-100 hover:bg-accent hover:text-white flex items-center justify-center transition-all duration-150"
          title="Remove from storyboard"
        >
          <X size={10} />
        </button>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] text-text-muted truncate">
            {storyboardClip.clip.fileName}
          </span>
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="shrink-0 text-text-dim hover:text-text-muted cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={11} />
          </button>
        </div>
        <span className="font-mono text-text-dim text-[10px] tabular-nums">
          {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
