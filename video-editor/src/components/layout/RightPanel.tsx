import { lazy, Suspense } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { RightPanelTab } from '../../types'

const ChatPanel = lazy(() => import('../chat/ChatPanel'))
const MusicBrowser = lazy(() => import('../music/MusicBrowser'))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel'))

const tabs: { id: RightPanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'music', label: 'Music' },
  { id: 'knowledge', label: 'Knowledge' },
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
    case 'knowledge':
      return <Suspense fallback={<PanelFallback />}><KnowledgePanel /></Suspense>
  }
}

export default function RightPanel() {
  const rightPanelTab = useAppStore((s) => s.rightPanelTab)
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab)

  return (
    <div className="w-[380px] bg-surface border-l border-border shrink-0 flex flex-col">
      <div className="flex items-center gap-1 px-4 h-11 border-b border-border shrink-0 select-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={`relative px-3.5 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors duration-150 ${
              rightPanelTab === tab.id
                ? 'text-text after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-accent after:rounded-full'
                : 'text-text-dim hover:text-text-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ActivePanel tab={rightPanelTab} />
    </div>
  )
}
