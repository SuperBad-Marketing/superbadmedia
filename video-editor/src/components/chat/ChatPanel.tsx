import { useEffect, useRef, useCallback } from 'react'
import { Sparkles, Film, BookOpen, Music } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendChatMessage } from '../../lib/api'
import ChatMessageComponent from './ChatMessage'
import ChatInput from './ChatInput'
import type { DockPanel } from '../../types'

const quickActions = [
  { label: 'Browse my footage', icon: Film, panel: 'media' as DockPanel },
  { label: 'Find music', icon: Music, panel: 'music' as DockPanel },
  { label: 'Learn something new', icon: BookOpen, panel: 'knowledge' as DockPanel },
]

function EmptyChat({ onQuickAction }: { onQuickAction: (action: typeof quickActions[number]) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
      <div className="size-10 rounded-xl bg-accent/10 flex items-center justify-center">
        <Sparkles size={18} className="text-accent" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs text-text font-medium">What can I help with?</p>
        <p className="text-[10px] text-text-dim">Ask me anything about your edit.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onQuickAction(action)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-active/40 text-text-dim text-[10px] hover:bg-surface-hover hover:text-text-muted transition-colors duration-150 cursor-pointer"
          >
            <action.icon size={11} className="shrink-0" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const chatMessages = useAppStore((s) => s.chatMessages)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const updateChatMessage = useAppStore((s) => s.updateChatMessage)
  const currentProject = useAppStore((s) => s.currentProject)
  const setActiveDockPanel = useAppStore((s) => s.setActiveDockPanel)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [chatMessages])

  const handleQuickAction = useCallback((action: typeof quickActions[number]) => {
    if (action.panel) {
      setActiveDockPanel(action.panel)
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
  }, [addChatMessage, updateChatMessage, setActiveDockPanel, currentProject?.id])

  return (
    <div className="flex flex-col h-full">
      {chatMessages.length === 0 ? (
        <EmptyChat onQuickAction={handleQuickAction} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {chatMessages.map((msg) => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <ChatInput />
    </div>
  )
}
