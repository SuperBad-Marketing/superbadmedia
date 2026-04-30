import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between h-10 px-4 bg-surface border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-text tracking-tight">SuperEdits</span>
          <span className="text-xs text-text-dim">by SuperBad</span>
        </div>

        <div className="text-sm">
          {currentProject ? (
            <span className="text-text-muted">{currentProject.name}</span>
          ) : (
            <span className="text-text-dim">No project</span>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-all duration-200"
        >
          <Settings size={16} />
        </button>
      </div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
