import { lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { DockPanel } from '../../types'

const MediaBrowser = lazy(() => import('../media/MediaBrowser'))
const ChatPanel = lazy(() => import('../chat/ChatPanel'))
const MusicBrowser = lazy(() => import('../music/MusicBrowser'))
const SfxBrowser = lazy(() => import('../sfx/SfxBrowser'))
const TransitionBrowser = lazy(() => import('../transitions/TransitionBrowser'))
const TitleCardBrowser = lazy(() => import('../titleCards/TitleCardBrowser'))
const CaptionsView = lazy(() => import('../captions/CaptionsView'))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel'))

const PANEL_CONFIG: Record<DockPanel, { title: string; width: number }> = {
  media: { title: 'Media', width: 320 },
  ai: { title: 'Assistant', width: 380 },
  music: { title: 'Music', width: 360 },
  sound: { title: 'Sound Effects', width: 340 },
  transitions: { title: 'Transitions', width: 320 },
  text: { title: 'Text & Titles', width: 340 },
  knowledge: { title: 'Knowledge', width: 360 },
}

function PanelContent({ panel }: { panel: DockPanel }) {
  const fallback = (
    <div className="flex items-center justify-center h-32 text-text-dim text-xs">
      Pulling that up.
    </div>
  )

  switch (panel) {
    case 'media':
      return <Suspense fallback={fallback}><MediaBrowser /></Suspense>
    case 'ai':
      return <Suspense fallback={fallback}><ChatPanel /></Suspense>
    case 'music':
      return <Suspense fallback={fallback}><MusicBrowser /></Suspense>
    case 'sound':
      return <Suspense fallback={fallback}><SfxBrowser /></Suspense>
    case 'transitions':
      return <Suspense fallback={fallback}><TransitionBrowser /></Suspense>
    case 'text':
      return (
        <Suspense fallback={fallback}>
          <div className="flex flex-col gap-4">
            <TitleCardBrowser />
            <CaptionsView />
          </div>
        </Suspense>
      )
    case 'knowledge':
      return <Suspense fallback={fallback}><KnowledgePanel /></Suspense>
  }
}

export default function FloatingPanelLayer() {
  const activeDockPanel = useAppStore((s) => s.activeDockPanel)
  const setActiveDockPanel = useAppStore((s) => s.setActiveDockPanel)

  return (
    <AnimatePresence>
      {activeDockPanel && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setActiveDockPanel(null)}
          />

          <motion.div
            key="panel"
            className="fixed z-35 bottom-20 right-6 max-h-[65vh] flex flex-col floating-panel rounded-2xl overflow-hidden"
            style={{ width: PANEL_CONFIG[activeDockPanel].width }}
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-xs font-display font-semibold text-text tracking-tight">
                {PANEL_CONFIG[activeDockPanel].title}
              </span>
              <button
                onClick={() => setActiveDockPanel(null)}
                className="size-6 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
                aria-label="Close panel"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-0">
              <PanelContent panel={activeDockPanel} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
