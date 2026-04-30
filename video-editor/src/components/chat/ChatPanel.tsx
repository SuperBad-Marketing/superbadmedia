import { useEffect, useRef } from 'react'
import { Upload, FolderPlus, BookOpen, Music } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import ChatMessageComponent from './ChatMessage'
import ChatInput from './ChatInput'

const quickActions = [
  { label: 'Import footage', icon: Upload },
  { label: 'Start a new project', icon: FolderPlus },
  { label: 'Learn from a video', icon: BookOpen },
  { label: 'Browse music', icon: Music },
]

function WelcomeScreen({ onQuickAction }: { onQuickAction: (label: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text tracking-tight">SuperEdits</h1>
        <p className="text-text-muted text-sm mt-1">What are you working on?</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {quickActions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => onQuickAction(label)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-text-muted text-sm hover:border-accent hover:text-accent transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const { chatMessages, addChatMessage } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [chatMessages])

  const handleQuickAction = (label: string) => {
    addChatMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: label,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className="flex flex-col h-full">
      {chatMessages.length === 0 ? (
        <WelcomeScreen onQuickAction={handleQuickAction} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-1">
          {chatMessages.map((msg) => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <ChatInput />
    </div>
  )
}
