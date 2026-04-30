import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendChatMessage } from '../../lib/api'

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i

export default function ChatInput() {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addChatMessage, updateChatMessage, currentProject } = useAppStore()

  const hasYouTubeLink = YOUTUBE_REGEX.test(text)
  const trimmed = text.trim()

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 6 * 24
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [text, resizeTextarea])

  const handleSubmit = useCallback(async () => {
    if (!trimmed || isSending) return

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMessage)
    setText('')

    const loadingId = crypto.randomUUID()
    addChatMessage({
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    })

    setIsSending(true)

    try {
      const response = await sendChatMessage(trimmed, currentProject?.id)
      updateChatMessage(loadingId, {
        content: response.content,
        isLoading: false,
        action: response.action,
      })
    } catch {
      updateChatMessage(loadingId, {
        content: 'Something went wrong. Try again.',
        isLoading: false,
      })
    } finally {
      setIsSending(false)
    }
  }, [trimmed, isSending, addChatMessage, updateChatMessage, currentProject?.id])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-3 pb-3 pt-2">
      <div className="relative flex items-end gap-1 bg-surface-active/50 rounded-lg focus-within:ring-1 focus-within:ring-border-active transition-all duration-150">
        <button
          type="button"
          className="p-3 text-text-dim hover:text-text-muted transition-colors duration-150 shrink-0 self-end"
          aria-label="Attach file"
        >
          <Paperclip size={15} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command, drop a link, or ask anything..."
          rows={1}
          className="flex-1 bg-transparent text-text text-xs py-3 resize-none outline-none placeholder:text-text-dim leading-6"
        />
        {trimmed && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSending}
            className="p-1.5 m-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors duration-150 disabled:opacity-50 shrink-0 self-end"
            aria-label="Send message"
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>
      {hasYouTubeLink && (
        <div className="mt-2 px-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-pink bg-pink-dim px-2.5 py-1 rounded-lg font-medium">
            YouTube link detected — will create a skill file
          </span>
        </div>
      )}
    </div>
  )
}
