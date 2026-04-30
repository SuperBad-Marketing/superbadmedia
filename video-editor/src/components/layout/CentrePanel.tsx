import { lazy, Suspense } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { CentreView } from '../../types'

const IngestView = lazy(() => import('../ingest/IngestView'))
const StoryboardView = lazy(() => import('../storyboard/StoryboardView'))
const PreviewView = lazy(() => import('../preview/PreviewView'))
const GradingView = lazy(() => import('../grading/GradingView'))
const CaptionsView = lazy(() => import('../captions/CaptionsView'))
const ExportView = lazy(() => import('../export/ExportView'))
const AdVariationsView = lazy(() => import('../ads/AdVariationsView'))

const tabs: { id: CentreView; label: string }[] = [
  { id: 'ingest', label: 'Ingest' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'preview', label: 'Preview' },
  { id: 'grading', label: 'Grading' },
  { id: 'captions', label: 'Captions' },
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
      return <Suspense fallback={<ViewFallback />}><PreviewView /></Suspense>
    case 'grading':
      return <Suspense fallback={<ViewFallback />}><GradingView /></Suspense>
    case 'captions':
      return <Suspense fallback={<ViewFallback />}><CaptionsView /></Suspense>
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
      <div className="flex items-center gap-0.5 px-3 h-9 border-b border-border shrink-0 select-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCentreView(tab.id)}
            className={`relative px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors duration-150 rounded-md ${
              centreView === tab.id
                ? 'text-text bg-surface-active'
                : 'text-text-dim hover:text-text-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ActiveView view={centreView} />
    </div>
  )
}
