import { useEffect, useRef, useCallback } from 'react'
import { Upload, FolderPlus, BookOpen, Music } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendChatMessage } from '../../lib/api'
import ChatMessageComponent from './ChatMessage'
import ChatInput from './ChatInput'

const quickActions = [
  { label: 'Import footage', icon: Upload, view: 'ingest' as const },
  { label: 'Start a new project', icon: FolderPlus, view: 'ingest' as const },
  { label: 'Learn from a video', icon: BookOpen, tab: 'knowledge' as const },
  { label: 'Browse music', icon: Music, tab: 'music' as const },
]

function WelcomeScreen({ onQuickAction }: { onQuickAction: (action: typeof quickActions[number]) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-10 gap-12">
      <div className="text-center space-y-2">
        <h1 className="font-display text-2xl font-semibold text-text tracking-tight">SuperEdits</h1>
        <p className="text-[11px] text-text-dim">What are you working on?</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5 max-w-[300px]">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onQuickAction(action)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-active/50 text-text-dim text-xs hover:bg-surface-hover hover:text-text transition-colors duration-150"
          >
            <action.icon size={14} className="shrink-0" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const { chatMessages, addChatMessage, updateChatMessage, setCentreView, setRightPanelTab, currentProject } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [chatMessages])

  const handleQuickAction = useCallback((action: typeof quickActions[number]) => {
    if (action.view) {
      setCentreView(action.view)
    }
    if (action.tab) {
      setRightPanelTab(action.tab)
    }

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: action.label,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)

    const loadingId = crypto.randomUUID()
    addChatMessage({ id: loadingId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isLoading: true })

    sendChatMessage(action.label, currentProject?.id)
      .then((response) => {
        updateChatMessage(loadingId, { content: response.content, isLoading: false, action: response.action })
      })
      .catch(() => {
        updateChatMessage(loadingId, { content: 'Something went wrong. Try again.', isLoading: false })
      })
  }, [addChatMessage, updateChatMessage, setCentreView, setRightPanelTab, currentProject?.id])

  return (
    <div className="flex flex-col h-full">
      {chatMessages.length === 0 ? (
        <WelcomeScreen onQuickAction={handleQuickAction} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-5 space-y-0.5">
          {chatMessages.map((msg) => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <ChatInput />
    </div>
  )
}
