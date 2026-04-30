import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between h-14 px-6 bg-surface border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-lg tracking-tight text-text">SuperEdits</span>
          <span className="text-[11px] font-medium text-text-dim tracking-widest uppercase">by SuperBad</span>
        </div>

        <div>
          {currentProject ? (
            <span className="font-display font-semibold text-text-muted text-sm tracking-wide">{currentProject.name}</span>
          ) : (
            <span className="text-text-dim text-sm">No project</span>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
          aria-label="Settings"
        >
          <Settings size={18} />
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
