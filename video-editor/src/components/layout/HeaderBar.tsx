import { useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between h-14 px-6 bg-surface border-b border-accent/20 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="font-display font-extrabold text-xl tracking-tight text-text">SuperEdits</span>
          <span className="text-[11px] font-semibold text-pink tracking-widest uppercase">by SuperBad</span>
        </div>

        <div>
          {currentProject ? (
            <span className="font-display font-semibold text-text text-sm tracking-wide">{currentProject.name}</span>
          ) : (
            <span className="text-text-dim text-sm italic">No project</span>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-accent-dim transition-colors duration-150"
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
