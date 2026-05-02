import { lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Film, MessageCircle, Music, Volume2, Layers, Type, BookOpen,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { DockPanel } from '../../types'

const TransportStrip = lazy(() => import('./TransportStrip'))

const DOCK_ITEMS: { id: DockPanel; icon: typeof Film; label: string }[] = [
  { id: 'media', icon: Film, label: 'Media' },
  { id: 'ai', icon: MessageCircle, label: 'AI' },
  { id: 'music', icon: Music, label: 'Music' },
  { id: 'sound', icon: Volume2, label: 'Sound' },
  { id: 'transitions', icon: Layers, label: 'Trans.' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'knowledge', icon: BookOpen, label: 'Learn' },
]

const TRANSPORT_PHASES = new Set(['assemble', 'refine', 'polish', 'deliver'])

export default function Dock() {
  const activeDockPanel = useAppStore((s) => s.activeDockPanel)
  const toggleDockPanel = useAppStore((s) => s.toggleDockPanel)
  const workflowPhase = useAppStore((s) => s.workflowPhase)
  const showTransport = TRANSPORT_PHASES.has(workflowPhase)

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
    >
      <div className="dock rounded-2xl px-2 py-1.5 flex items-center gap-0.5">
        <AnimatePresence>
          {showTransport && (
            <Suspense fallback={null}>
              <TransportStrip />
            </Suspense>
          )}
        </AnimatePresence>
        {DOCK_ITEMS.map((item) => {
          const isActive = activeDockPanel === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => toggleDockPanel(item.id)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors duration-200 group"
              aria-label={item.label}
            >
              <div
                className={`size-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-dim group-hover:text-text-muted group-hover:bg-surface-hover/50'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
              </div>
              <span
                className={`text-[9px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-accent' : 'text-text-dim group-hover:text-text-muted'
                }`}
              >
                {item.label}
              </span>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="dock-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
