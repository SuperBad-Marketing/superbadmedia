import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Send, Loader2, Sparkles, ArrowDownCircle, MessageSquare } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendRevision, type RevisionResult } from '../../lib/api'

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  changes?: string[]
  learned?: { category: string; instruction: string }[]
}

export default function RevisionChat() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const clips = useAppStore((s) => s.clips)
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const currentProject = useAppStore((s) => s.currentProject)
  const setStoryboardClips = useAppStore((s) => s.setStoryboardClips)
  const setSfxPlacements = useAppStore((s) => s.setSfxPlacements)
  const setEditTransitions = useAppStore((s) => s.setEditTransitions)


  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const applyUpdates = useCallback((result: RevisionResult) => {
    const changeLog: string[] = []

    if (result.storyboardUpdates?.length) {
      let updated = [...storyboardClips]

      for (const update of result.storyboardUpdates) {
        switch (update.action) {
          case 'remove': {
            updated = updated.filter(sc => sc.id !== update.clipId && sc.clipId !== update.clipId)
            changeLog.push(`Removed a clip`)
            break
          }
          case 'reorder': {
            const idx = updated.findIndex(sc => sc.id === update.clipId || sc.clipId === update.clipId)
            if (idx !== -1) {
              const [moved] = updated.splice(idx, 1)
              updated.splice(Math.min(update.newPosition, updated.length), 0, moved)
              changeLog.push(`Reordered a clip to position ${update.newPosition + 1}`)
            }
            break
          }
          case 'trim': {
            updated = updated.map(sc => {
              if (sc.id === update.clipId || sc.clipId === update.clipId) {
                changeLog.push(`Trimmed ${sc.clip.fileName} to ${update.startTime.toFixed(1)}s–${update.endTime.toFixed(1)}s`)
                return { ...sc, startTime: update.startTime, endTime: update.endTime }
              }
              return sc
            })
            break
          }
          case 'swap': {
            const sourceClip = clips.find(c => c.id === update.replaceWithClipId)
            if (sourceClip) {
              updated = updated.map(sc => {
                if (sc.id === update.clipId || sc.clipId === update.clipId) {
                  changeLog.push(`Swapped ${sc.clip.fileName} for ${sourceClip.fileName}`)
                  return {
                    ...sc,
                    clipId: sourceClip.id,
                    clip: sourceClip,
                    startTime: 0,
                    endTime: sourceClip.duration,
                  }
                }
                return sc
              })
            }
            break
          }
          case 'add': {
            const addClip = clips.find(c => c.id === update.clipId)
            if (addClip) {
              const newSc = {
                id: crypto.randomUUID(),
                clipId: addClip.id,
                clip: addClip,
                startTime: update.startTime ?? 0,
                endTime: update.endTime ?? addClip.duration,
                position: update.position ?? updated.length,
                audioOffset: 0,
              }
              updated.splice(newSc.position, 0, newSc)
              changeLog.push(`Added ${addClip.fileName}`)
            }
            break
          }
        }
      }

      updated = updated.map((sc, i) => ({ ...sc, position: i }))
      setStoryboardClips(updated)
    }

    if (result.transitionUpdates?.length) {
      let updated = [...editTransitions]
      for (const tu of result.transitionUpdates) {
        if (tu.action === 'remove') {
          updated = updated.filter(t => t.afterClipPosition !== tu.afterClipPosition)
          changeLog.push(`Removed transition after clip ${tu.afterClipPosition + 1}`)
        } else if (tu.action === 'add') {
          updated.push({
            id: crypto.randomUUID(),
            afterClipPosition: tu.afterClipPosition,
            presetId: tu.presetId || 'dissolve-soft',
            presetName: tu.presetName || tu.presetId || 'Dissolve',
            duration: tu.duration || 0.5,
            reason: 'Added from revision feedback',
          })
          changeLog.push(`Added ${tu.presetName || tu.presetId || 'transition'} after clip ${tu.afterClipPosition + 1}`)
        }
      }
      setEditTransitions(updated)
    }

    if (result.sfxUpdates?.length) {
      let updated = [...sfxPlacements]
      for (const su of result.sfxUpdates) {
        if (su.action === 'remove') {
          updated = updated.filter(s => s.id !== su.sfxId)
          changeLog.push(`Removed a sound effect`)
        } else if (su.action === 'add') {
          updated.push({
            id: crypto.randomUUID(),
            category: su.category || 'ambient',
            role: su.role || 'atmosphere',
            searchQuery: su.searchQuery || '',
            timelineStart: su.timelineStart || 0,
            timelineEnd: su.timelineEnd,
            volume: su.volume ?? 0.5,
            fadeIn: su.fadeIn ?? 0,
            fadeOut: su.fadeOut ?? 0,
            reason: 'Added from revision feedback',
          })
          changeLog.push(`Added SFX: "${su.searchQuery || su.category}"`)
        }
      }
      setSfxPlacements(updated)
    }

    return changeLog
  }, [storyboardClips, clips, editTransitions, sfxPlacements, setStoryboardClips, setEditTransitions, setSfxPlacements])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const userEntry: ChatEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    setMessages(prev => [...prev, userEntry])
    setInput('')
    setSending(true)

    try {
      const context = {
        projectId: currentProject?.id || 'unknown',
        clientId: undefined,
        storyboardClips,
        clips,
        sfxPlacements,
        transitions: editTransitions,
        brief: {},
        narrative: '',
      }

      const history = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const result = await sendRevision(context, text, history)

      const changeLog = applyUpdates(result)

      const assistantEntry: ChatEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.response,
        changes: changeLog.length > 0 ? changeLog : undefined,
        learned: result.learnedInstructions?.length ? result.learnedInstructions : undefined,
      }

      setMessages(prev => [...prev, assistantEntry])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Something went wrong processing your feedback. Try again.',
        },
      ])
    } finally {
      setSending(false)
    }
  }, [input, sending, messages, storyboardClips, clips, sfxPlacements, editTransitions, currentProject, applyUpdates])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (storyboardClips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="size-16 rounded-2xl bg-surface-active/40 flex items-center justify-center mb-8">
            <MessageSquare size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Revisions
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            Build an edit first, then come here to give feedback and refine.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="size-10 rounded-xl bg-surface-active/40 flex items-center justify-center mb-4">
              <Sparkles size={18} className="text-text-dim/50" />
            </div>
            <p className="text-text-muted text-sm font-medium mb-1">
              Describe what you'd change.
            </p>
            <p className="text-text-dim text-xs max-w-[280px]">
              Reorder clips, adjust timing, swap footage, add or remove transitions. The AI adjusts the Resolve timeline data and learns your preferences for future projects.
            </p>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent/90 text-white'
                    : 'bg-surface-active/60 text-text'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.changes && msg.changes.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/70 mb-1.5">
                      Changes applied
                    </p>
                    <ul className="space-y-0.5">
                      {msg.changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-text-muted">
                          <ArrowDownCircle size={10} className="mt-0.5 shrink-0 text-accent/70" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {msg.learned && msg.learned.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/70 mb-1.5">
                      Learned for future edits
                    </p>
                    <ul className="space-y-0.5">
                      {msg.learned.map((l, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-text-muted">
                          <Sparkles size={10} className="mt-0.5 shrink-0 text-amber-400/70" />
                          <span>
                            <span className="font-medium text-text-muted">[{l.category}]</span>{' '}
                            {l.instruction}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-surface-active/60 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-text-dim" />
              <span className="text-[12px] text-text-dim">Reviewing your feedback...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-4 pt-2">
        <div className="flex items-end gap-2 bg-surface-active/40 rounded-2xl px-3 py-2 border border-border focus-within:border-border-active transition-colors duration-200">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. &quot;Move the drone shot to the opening and trim the interview to just the punchline&quot;"
            rows={1}
            className="flex-1 bg-transparent text-text text-[13px] placeholder:text-text-dim/50 resize-none outline-none min-h-[24px] max-h-[120px] leading-relaxed"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0 p-1.5 rounded-lg text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
