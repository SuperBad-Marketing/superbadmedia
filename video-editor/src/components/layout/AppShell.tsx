import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import HeaderBar from './HeaderBar'
import Dock from './Dock'
import FloatingPanelLayer from './FloatingPanel'
import { useAppStore } from '../../stores/appStore'
import type { WorkflowPhase } from '../../types'

const HomeScreen = lazy(() => import('../home/HomeScreen'))
const ImportScreen = lazy(() => import('../import/ImportScreen'))
const BriefBuilder = lazy(() => import('../brief/BriefBuilder'))
const StoryboardView = lazy(() => import('../storyboard/StoryboardView'))
const PreviewView = lazy(() => import('../preview/PreviewView'))
const ExportView = lazy(() => import('../export/ExportView'))

function ViewFallback() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-dim text-xs">
      One moment.
    </div>
  )
}

function WorkspaceView({ phase }: { phase: WorkflowPhase }) {
  switch (phase) {
    case 'home':
      return <Suspense fallback={<ViewFallback />}><HomeScreen /></Suspense>
    case 'import':
      return <Suspense fallback={<ViewFallback />}><ImportScreen /></Suspense>
    case 'brief':
      return <Suspense fallback={<ViewFallback />}><BriefBuilder /></Suspense>
    case 'assemble':
      return <Suspense fallback={<ViewFallback />}><StoryboardView /></Suspense>
    case 'refine':
      return (
        <Suspense fallback={<ViewFallback />}>
          <PreviewView />
        </Suspense>
      )
    case 'deliver':
      return (
        <Suspense fallback={<ViewFallback />}>
          <div className="flex-1 flex flex-col min-h-0">
            <ExportView />
          </div>
        </Suspense>
      )
  }
}

const showChromePhases: WorkflowPhase[] = ['brief', 'assemble', 'refine', 'deliver']

export default function AppShell() {
  const workflowPhase = useAppStore((s) => s.workflowPhase)
  const showChrome = showChromePhases.includes(workflowPhase)

  return (
    <div className="flex flex-col h-dvh bg-bg text-text overflow-hidden">
      {showChrome && <HeaderBar />}

      <div className={`flex-1 flex flex-col min-h-0 relative ${showChrome ? 'pb-16' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={workflowPhase}
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <WorkspaceView phase={workflowPhase} />
          </motion.div>
        </AnimatePresence>
      </div>

      {showChrome && <Dock />}

      <FloatingPanelLayer />
    </div>
  )
}
