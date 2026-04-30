import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between h-11 px-5 bg-surface border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <span className="font-display font-bold text-sm tracking-tight text-text">SuperEdits</span>
          <span className="text-[10px] font-medium text-text-dim tracking-wide uppercase">by SuperBad</span>
        </div>

        <div className="text-sm">
          {currentProject ? (
            <span className="font-display font-semibold text-text-muted text-xs tracking-wide">{currentProject.name}</span>
          ) : (
            <span className="text-text-dim text-xs">No project</span>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
          aria-label="Settings"
        >
          <Settings size={15} />
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
