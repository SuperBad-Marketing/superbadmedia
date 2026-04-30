import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import MediaBrowser from '../media/MediaBrowser'

export default function LeftPanel() {
  const currentProject = useAppStore((s) => s.currentProject)
  const leftPanelCollapsed = useAppStore((s) => s.leftPanelCollapsed)
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel)

  if (leftPanelCollapsed) {
    return (
      <div className="w-10 panel-sidebar border-r border-border shrink-0 flex flex-col items-center pt-3">
        <button
          onClick={toggleLeftPanel}
          className="size-6 rounded-md flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
          aria-label="Expand panel"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-[260px] panel-sidebar border-r border-border shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {currentProject ? (
            <span className="text-xs font-medium text-text truncate">{currentProject.clientName}</span>
          ) : (
            <span className="text-xs text-text-dim">Media</span>
          )}
        </div>
        <button
          onClick={toggleLeftPanel}
          className="size-6 rounded-md flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150 shrink-0"
          aria-label="Collapse panel"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      <MediaBrowser />
    </div>
  )
}
