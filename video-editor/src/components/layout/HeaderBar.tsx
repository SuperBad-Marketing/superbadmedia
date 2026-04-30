import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="relative flex items-center justify-between h-12 px-5 bg-surface shrink-0 select-none border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-sm tracking-tight text-text">SuperEdits</span>
          <span className="text-[9px] font-semibold text-pink/50 tracking-[0.2em] uppercase">SuperBad</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          {currentProject ? (
            <span className="text-xs font-medium text-text-muted">{currentProject.name}</span>
          ) : (
            <span className="text-xs text-text-dim">No project</span>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
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
