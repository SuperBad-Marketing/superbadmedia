import { lazy, Suspense } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { CentreView } from '../../types'

const IngestView = lazy(() => import('../ingest/IngestView'))
const StoryboardView = lazy(() => import('../storyboard/StoryboardView'))
const GradingView = lazy(() => import('../grading/GradingView'))
const ExportView = lazy(() => import('../export/ExportView'))
const AdVariationsView = lazy(() => import('../ads/AdVariationsView'))

const tabs: { id: CentreView; label: string }[] = [
  { id: 'ingest', label: 'Ingest' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'preview', label: 'Preview' },
  { id: 'grading', label: 'Grading' },
  { id: 'export', label: 'Export' },
  { id: 'ads', label: 'Ads' },
]

function ViewFallback() {
  return <div className="flex-1 flex items-center justify-center text-text-dim text-sm">Loading...</div>
}

function ActiveView({ view }: { view: CentreView }) {
  switch (view) {
    case 'ingest':
      return <Suspense fallback={<ViewFallback />}><IngestView /></Suspense>
    case 'storyboard':
      return <Suspense fallback={<ViewFallback />}><StoryboardView /></Suspense>
    case 'preview':
      return <div className="flex-1 flex items-center justify-center text-text-dim text-sm">Preview</div>
    case 'grading':
      return <Suspense fallback={<ViewFallback />}><GradingView /></Suspense>
    case 'export':
      return <Suspense fallback={<ViewFallback />}><ExportView /></Suspense>
    case 'ads':
      return <Suspense fallback={<ViewFallback />}><AdVariationsView /></Suspense>
  }
}

export default function CentrePanel() {
  const centreView = useAppStore((s) => s.centreView)
  const setCentreView = useAppStore((s) => s.setCentreView)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-1 px-4 h-9 border-b border-border shrink-0 select-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCentreView(tab.id)}
            className={`relative px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
              centreView === tab.id
                ? 'text-text'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {centreView === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      <ActiveView view={centreView} />
    </div>
  )
}
