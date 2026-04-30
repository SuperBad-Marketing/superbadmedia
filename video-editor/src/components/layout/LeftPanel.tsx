import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import MediaBrowser from '../media/MediaBrowser'

const statusColors: Record<string, string> = {
  ingesting: 'bg-amber-dim text-amber',
  ready: 'bg-green-dim text-green',
  editing: 'bg-accent-dim text-accent',
  grading: 'bg-accent-dim text-accent',
  exporting: 'bg-amber-dim text-amber',
  delivered: 'bg-green-dim text-green',
}

export default function LeftPanel() {
  const currentProject = useAppStore((s) => s.currentProject)
  const leftPanelCollapsed = useAppStore((s) => s.leftPanelCollapsed)
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel)

  if (leftPanelCollapsed) {
    return (
      <div className="w-10 bg-surface border-r border-border shrink-0 flex flex-col items-center pt-3">
        <button
          onClick={toggleLeftPanel}
          className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-all duration-200"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-[280px] bg-surface border-r border-border shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {currentProject ? (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium text-text truncate">{currentProject.clientName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${statusColors[currentProject.status] || 'bg-surface-hover text-text-dim'}`}>
              {currentProject.status}
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-dim">No project loaded</span>
        )}
        <button
          onClick={toggleLeftPanel}
          className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-all duration-200 shrink-0"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <MediaBrowser />
    </div>
  )
}
