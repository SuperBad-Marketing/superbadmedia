import { useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Package, Layers } from 'lucide-react'
import { ViewLoader } from '../shared/LoadingPulse'

const ExportView = lazy(() => import('../export/ExportView'))
const AdVariationsView = lazy(() => import('../ads/AdVariationsView'))

type DeliverMode = 'export' | 'ads'

const MODES: { id: DeliverMode; label: string; icon: typeof Package }[] = [
  { id: 'export', label: 'Export', icon: Package },
  { id: 'ads', label: 'Ad Variations', icon: Layers },
]

function ModeFallback() {
  return <ViewLoader />
}

export default function DeliverView() {
  const [mode, setMode] = useState<DeliverMode>('export')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-mode tabs */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 flex items-center justify-center gap-1 px-6 pt-4 pb-2"
      >
        <div className="flex items-center gap-0.5 bg-surface-active/30 rounded-xl p-0.5">
          {MODES.map((m) => {
            const isActive = mode === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-text bg-surface-active/80'
                    : 'text-text-dim hover:text-text-muted'
                }`}
              >
                <Icon size={12} />
                {m.label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Active mode content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="flex-1 flex flex-col min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Suspense fallback={<ModeFallback />}>
            {mode === 'export' && <ExportView />}
            {mode === 'ads' && <AdVariationsView />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
