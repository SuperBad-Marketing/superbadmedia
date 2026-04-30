import { lazy, Suspense } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { RightPanelTab } from '../../types'

const ChatPanel = lazy(() => import('../chat/ChatPanel'))
const MusicBrowser = lazy(() => import('../music/MusicBrowser'))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel'))
const SfxBrowser = lazy(() => import('../sfx/SfxBrowser'))
const TransitionBrowser = lazy(() => import('../transitions/TransitionBrowser'))
const TitleCardBrowser = lazy(() => import('../titleCards/TitleCardBrowser'))

const tabs: { id: RightPanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'music', label: 'Music' },
  { id: 'sfx', label: 'SFX' },
  { id: 'transitions', label: 'Trans.' },
  { id: 'titles', label: 'Titles' },
  { id: 'knowledge', label: 'Learn' },
]

function PanelFallback() {
  return <div className="flex-1 flex items-center justify-center text-text-dim text-sm">Loading...</div>
}

function ActivePanel({ tab }: { tab: RightPanelTab }) {
  switch (tab) {
    case 'chat':
      return <Suspense fallback={<PanelFallback />}><ChatPanel /></Suspense>
    case 'music':
      return <Suspense fallback={<PanelFallback />}><MusicBrowser /></Suspense>
    case 'sfx':
      return <Suspense fallback={<PanelFallback />}><SfxBrowser /></Suspense>
    case 'transitions':
      return <Suspense fallback={<PanelFallback />}><TransitionBrowser /></Suspense>
    case 'titles':
      return <Suspense fallback={<PanelFallback />}><TitleCardBrowser /></Suspense>
    case 'knowledge':
      return <Suspense fallback={<PanelFallback />}><KnowledgePanel /></Suspense>
  }
}

export default function RightPanel() {
  const rightPanelTab = useAppStore((s) => s.rightPanelTab)
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab)

  return (
    <div className="w-[360px] panel-sidebar border-l border-border shrink-0 flex flex-col">
      <div className="flex items-center justify-center px-3 h-10 border-b border-border shrink-0 select-none">
        <div className="segmented-control">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id)}
              data-active={rightPanelTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ActivePanel tab={rightPanelTab} />
    </div>
  )
}
