import {
  Upload,
  Layers,
  ArrowRightLeft,
  Volume2,
  Palette,
  Download,
  BookOpen,
  Music,
  Crop,
  Captions,
  Type,
  Search,
  Sparkles,
  Check,
  X,
  Loader2,
  MonitorPlay,
  FolderOpen,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendChatMessage } from '../../lib/api'
import type { ChatMessage as ChatMessageType, ChatAction } from '../../types'

const actionIcons: Record<ChatAction['type'], React.ElementType> = {
  ingest: Upload,
  assemble: Layers,
  transition: ArrowRightLeft,
  sfx: Volume2,
  grade: Palette,
  export: Download,
  learn: BookOpen,
  'music-search': Music,
  reframe: Crop,
  caption: Captions,
  'title-card': Type,
  'find-clips': Search,
  effects: Sparkles,
  'effects-discovery': Sparkles,
  resolve_connect: MonitorPlay,
  resolve_project: FolderOpen,
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-text">
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <code
          key={match.index}
          className="bg-surface-active/60 px-1.5 py-0.5 rounded text-pink font-mono text-[0.85em]"
        >
          {match[3]}
        </code>
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function SuggestionButtons({ suggestions }: { suggestions: { label: string; message: string }[] }) {
  const { addChatMessage, updateChatMessage, addAppliedEffect, currentProject } = useAppStore()

  const handleClick = async (suggestion: { label: string; message: string }) => {
    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: suggestion.message,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)

    const loadingId = crypto.randomUUID()
    addChatMessage({
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    })

    try {
      const response = await sendChatMessage(suggestion.message, currentProject?.id)
      updateChatMessage(loadingId, {
        content: response.content,
        isLoading: false,
        action: response.action,
      })
      if (response.action?.data?.appliedEffects) {
        for (const effect of response.action.data.appliedEffects) {
          addAppliedEffect(effect)
        }
      }
    } catch {
      updateChatMessage(loadingId, {
        content: 'Something went wrong. Try again.',
        isLoading: false,
      })
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((s) => (
        <button
          key={s.message}
          onClick={() => handleClick(s)}
          className="px-3 py-1.5 text-[11px] font-medium text-text-muted bg-surface-active/60 hover:bg-surface-active hover:text-text rounded-lg transition-all duration-150 cursor-pointer"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function ActionCard({ action }: { action: ChatAction }) {
  const Icon = actionIcons[action.type]
  const suggestions = action.data?.suggestions as { label: string; message: string }[] | undefined

  return (
    <div className="mt-2 bg-surface-active/40 rounded-lg p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 text-text-dim shrink-0" />
        <span className="text-[11px] text-text-muted flex-1">{action.description}</span>
        {action.status === 'running' && (
          <Loader2 className="w-3.5 h-3.5 text-orange animate-spin shrink-0" />
        )}
        {action.status === 'complete' && (
          <Check className="w-3.5 h-3.5 text-green shrink-0" />
        )}
        {action.status === 'error' && (
          <X className="w-3.5 h-3.5 text-accent shrink-0" />
        )}
        {action.status === 'pending' && (
          <span className="w-1.5 h-1.5 rounded-full bg-text-dim shrink-0" />
        )}
      </div>
      {action.status === 'running' && action.progress != null && (
        <div className="w-full h-0.5 bg-surface-active rounded-full overflow-hidden">
          <div
            className="h-full bg-orange rounded-full transition-all duration-300"
            style={{ width: `${action.progress}%` }}
          />
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <SuggestionButtons suggestions={suggestions} />
      )}
    </div>
  )
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-1.5 items-center h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-text-dim"
          style={{
            animation: `pulse 1.6s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center px-5 py-1">
        <span className="text-text-dim text-[10px]">
          {parseInlineFormatting(message.content)}
        </span>
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-5 py-1.5`}>
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-accent text-white rounded-2xl rounded-br-md'
              : 'bg-surface-active/50 text-text-muted rounded-2xl rounded-bl-md'
          }`}
        >
          {message.isLoading ? <LoadingDots /> : parseInlineFormatting(message.content)}
        </div>
        {message.action && <ActionCard action={message.action} />}
        <span className="text-text-dim text-[10px] mt-1.5 px-1 font-mono tabular-nums">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
