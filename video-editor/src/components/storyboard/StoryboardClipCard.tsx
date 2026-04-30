import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Film, GripVertical } from 'lucide-react'
import type { StoryboardClip } from '../../types'

interface StoryboardClipCardProps {
  storyboardClip: StoryboardClip
  index: number
}

export default function StoryboardClipCard({ storyboardClip }: StoryboardClipCardProps) {
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
      className={`w-40 min-w-40 bg-surface border rounded-lg overflow-hidden transition-colors ${
        isDragging
          ? 'opacity-50 ring-2 ring-accent border-accent'
          : 'border-border hover:border-border-active'
      }`}
    >
      <div className="aspect-video bg-surface-active flex items-center justify-center">
        {storyboardClip.clip.thumbnailPath ? (
          <img
            src={storyboardClip.clip.thumbnailPath}
            alt={storyboardClip.clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Film size={20} className="text-text-dim" />
        )}
      </div>

      <div className="p-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-text truncate">
            {storyboardClip.clip.fileName}
          </span>
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="shrink-0 text-text-dim hover:text-text cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </button>
        </div>
        <span className="font-mono text-text-dim text-xs">
          {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
