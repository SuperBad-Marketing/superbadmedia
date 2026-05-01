import { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Play, Pause, Plus, Zap, Volume2, Send, Loader2, Music, X, ChevronRight, Film } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve, submitTasteFeedback } from '../../lib/api'
import { thumbUrl } from '../../lib/thumbUrl'
import type { StoryboardClip } from '../../types'

const TRANSITION_PRESETS = [
  { id: 'cut', name: 'Cut' },
  { id: 'dissolve-soft', name: 'Dissolve' },
  { id: 'impact-shake', name: 'Impact' },
  { id: 'wipe-whip', name: 'Whip Pan' },
  { id: 'zoom-blur-in', name: 'Zoom Blur' },
  { id: 'dissolve-light-leak', name: 'Light Leak' },
  { id: 'glitch-digital', name: 'Glitch' },
  { id: 'film-grain', name: 'Film Grain' },
] as const

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function TransitionDot({
  index,
  assignedTransition,
}: {
  index: number
  assignedTransition?: { presetName: string; reason: string }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const displayName =
    assignedTransition?.presetName ||
    (selected ? TRANSITION_PRESETS.find((p) => p.id === selected)?.name : null)
  const hasTransition = !!displayName

  return (
    <div className="flex items-center justify-center shrink-0 relative mx-[-4px] z-10">
      <button
        onClick={() => setOpen(!open)}
        className={`size-5 rounded-full flex items-center justify-center transition-all duration-200 ${
          hasTransition
            ? 'bg-accent text-white shadow-sm shadow-accent/30'
            : 'bg-surface-active/80 text-text-dim hover:bg-surface-raised hover:text-text-muted'
        }`}
        title={
          hasTransition
            ? `${displayName}${assignedTransition?.reason ? ` — ${assignedTransition.reason}` : ''}`
            : 'Add transition'
        }
      >
        {hasTransition ? (
          <span className="text-[7px] font-bold">{displayName!.charAt(0)}</span>
        ) : (
          <Zap size={8} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full mt-2 z-30 floating-panel rounded-xl p-1 min-w-[130px]"
          >
            {TRANSITION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelected(preset.id === selected ? null : preset.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-colors duration-150 ${
                  preset.id === selected
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MusicWaveform({ clipCount }: { clipCount: number }) {
  const rand = useMemo(() => seededRandom(42), [])
  const barCount = Math.max(clipCount * 12, 60)
  const bars = useMemo(
    () => Array.from({ length: barCount }, () => 10 + rand() * 90),
    [barCount, rand],
  )

  return (
    <div className="h-6 flex items-end gap-px px-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 min-w-[1px] bg-pink/25 rounded-t-sm"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

export default function StoryboardView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const reorderStoryboardClip = useAppStore((s) => s.reorderStoryboardClip)
  const lastAssemblyId = useAppStore((s) => s.lastAssemblyId)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const isPlaying = useAppStore((s) => s.isPlaying)
  const setIsPlaying = useAppStore((s) => s.setIsPlaying)
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const toggleDockPanel = useAppStore((s) => s.toggleDockPanel)
  const [sending, setSending] = useState(false)

  const handleSendToResolve = useCallback(async () => {
    if (sending) return
    setSending(true)
    try {
      const uniquePaths = [...new Set(storyboardClips.map((c) => c.clip.filePath))]
      const importResult = await sendToResolve('import_media', { file_paths: uniquePaths })

      if (importResult.error) {
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Failed to send to Resolve: ${importResult.error}`,
          timestamp: new Date().toISOString(),
        })
      } else {
        await sendToResolve('create_timeline', { name: 'SuperEdits Assembly' })

        const clipData = storyboardClips.map((c) => ({
          filePath: c.clip.filePath,
          startTime: c.startTime,
          endTime: c.endTime,
          audioOffset: c.audioOffset || 0,
        }))
        await sendToResolve('add_clips_with_timing', { clips: clipData })

        for (const t of editTransitions) {
          await sendToResolve('add_transition', {
            clip_index: t.afterClipPosition,
            type: t.presetName,
            duration: t.duration,
          })
        }

        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Sent ${storyboardClips.length} clips to Resolve with in/out points${editTransitions.length > 0 ? ` and ${editTransitions.length} transitions` : ''}. Timeline "SuperEdits Assembly" created.`,
          timestamp: new Date().toISOString(),
        })

        if (lastAssemblyId) {
          const feedbackClips = storyboardClips.map((c) => ({
            clipId: c.clipId,
            startTime: c.startTime,
            endTime: c.endTime,
            position: c.position,
          }))
          const feedbackTransitions = editTransitions.map((t) => ({
            afterPosition: t.afterClipPosition,
            presetId: t.presetId,
          }))
          const totalDur = storyboardClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
          submitTasteFeedback(lastAssemblyId, feedbackClips, feedbackTransitions, totalDur).catch(() => {})
        }
      }
    } catch {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Could not reach Resolve. Make sure it is running and connected.',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }, [sending, storyboardClips, editTransitions, addChatMessage, lastAssemblyId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const clipIds = useMemo(
    () => storyboardClips.map((c) => c.id),
    [storyboardClips],
  )

  const totalDuration = useMemo(
    () => storyboardClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0),
    [storyboardClips],
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = storyboardClips.findIndex((c) => c.id === active.id)
    const toIndex = storyboardClips.findIndex((c) => c.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderStoryboardClip(fromIndex, toIndex)
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
            <Film size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Build your story
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs mb-10">
            Head back to the brief and describe what you want, or add clips manually from the media dock.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setWorkflowPhase('brief')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors duration-200 cursor-pointer"
            >
              Write a brief
              <ChevronRight size={12} />
            </button>
            <button
              onClick={() => toggleDockPanel('media')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted text-xs font-medium transition-all duration-200 cursor-pointer"
            >
              <Plus size={12} />
              Add clips
            </button>
          </div>

          {!selectedTrack && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              onClick={() => toggleDockPanel('music')}
              className="mt-6 flex items-center gap-1.5 text-pink text-[11px] font-medium hover:text-pink/80 transition-colors duration-200 cursor-pointer"
            >
              <Music size={11} />
              Pick your track first
            </motion.button>
          )}
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
      {/* Music track header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 px-6 pt-4 pb-2"
      >
        {selectedTrack ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Music size={12} className="text-pink shrink-0" />
              <span className="text-[11px] font-display font-semibold text-text truncate">
                {selectedTrack.title}
              </span>
              <span className="text-[11px] text-text-dim truncate">
                {selectedTrack.artist}
              </span>
              <span className="font-mono text-[10px] text-text-dim tabular-nums shrink-0">
                {selectedTrack.bpm} BPM
              </span>
            </div>
            <button
              onClick={() => toggleDockPanel('music')}
              className="text-text-dim text-[11px] hover:text-text-muted transition-colors duration-150 shrink-0 cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-text-dim">No music selected</span>
            <button
              onClick={() => toggleDockPanel('music')}
              className="text-pink text-[11px] font-medium hover:text-pink/80 transition-colors duration-150 cursor-pointer"
            >
              Browse music
            </button>
          </div>
        )}
      </motion.div>

      {/* Proportional timeline — the hero */}
      <div className="flex-1 flex flex-col min-h-0 px-6 py-2">
        {/* Waveform backdrop */}
        {selectedTrack && (
          <div className="mb-1">
            <MusicWaveform clipCount={storyboardClips.length} />
          </div>
        )}

        {/* Timeline strip — proportional widths */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex items-stretch min-h-full py-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
                {storyboardClips.map((clip, index) => {
                  const clipDur = clip.endTime - clip.startTime
                  const widthPx = Math.max(clipDur * 16, 80)
                  const assignedT = editTransitions.find(
                    (t) => t.afterClipPosition === index - 1,
                  )
                  return (
                    <motion.div
                      key={clip.id}
                      className="flex items-stretch shrink-0"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.03,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {index > 0 && (
                        <TransitionDot
                          index={index}
                          assignedTransition={
                            assignedT
                              ? {
                                  presetName: assignedT.presetName,
                                  reason: assignedT.reason,
                                }
                              : undefined
                          }
                        />
                      )}
                      <TimelineClip
                        clip={clip}
                        width={widthPx}
                        index={index}
                      />
                    </motion.div>
                  )
                })}
              </SortableContext>
            </DndContext>

            <button
              onClick={() => toggleDockPanel('media')}
              className="ml-2 w-16 min-w-16 rounded-xl border border-dashed border-border hover:border-border-active flex items-center justify-center shrink-0 hover:bg-surface-hover/50 transition-all duration-200 cursor-pointer"
            >
              <Plus size={14} className="text-text-dim" />
            </button>
          </div>
        </div>
      </div>

      {/* SFX layer */}
      <AnimatePresence>
        {sfxPlacements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 px-6 py-2 border-t border-border/30"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Volume2 size={10} className="text-orange" />
              <span className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase">
                SFX ({sfxPlacements.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {sfxPlacements.map((sfx) => (
                <span
                  key={sfx.id}
                  className="text-[9px] bg-surface-active/60 rounded-md px-2 py-0.5 text-text-dim font-mono"
                  title={`${sfx.reason} | ${sfx.timelineStart.toFixed(1)}s${sfx.timelineEnd ? `–${sfx.timelineEnd.toFixed(1)}s` : ''} | vol ${Math.round(sfx.volume * 100)}%`}
                >
                  <span className="text-orange uppercase">{sfx.category}</span>{' '}
                  {sfx.epidemicTrack?.title || sfx.searchQuery}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transport bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 px-6 py-3 flex items-center justify-between border-t border-border/30"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="size-8 rounded-full bg-surface-active hover:bg-surface-raised flex items-center justify-center transition-colors duration-150 cursor-pointer"
          >
            {isPlaying ? (
              <Pause size={13} className="text-text" />
            ) : (
              <Play size={13} className="text-text ml-0.5" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-text tabular-nums">
              {formatDuration(totalDuration)}
            </span>
            <span className="text-[10px] text-text-dim">
              · {storyboardClips.length} clips
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWorkflowPhase('refine')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 cursor-pointer"
          >
            Preview
            <ChevronRight size={12} />
          </button>
          <button
            onClick={handleSendToResolve}
            disabled={sending || !resolveConnected}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl px-4 py-2 text-xs font-semibold transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={12} />
                {resolveConnected ? 'Send to Resolve' : 'Connect Resolve'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TimelineClip({
  clip,
  width,
  index,
}: {
  clip: StoryboardClip
  width: number
  index: number
}) {
  const removeFromStoryboard = useAppStore((s) => s.removeFromStoryboard)
  const duration = clip.endTime - clip.startTime

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-surface hover:bg-surface-hover transition-all duration-200 cursor-pointer"
      style={{ width, minWidth: width }}
    >
      {/* Thumbnail fills the card */}
      <div className="absolute inset-0">
        {clip.clip.thumbnailPath ? (
          <img
            src={thumbUrl(clip.clip.thumbnailPath)}
            alt={clip.clip.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-active flex items-center justify-center">
            <Film size={16} className="text-text-dim/30" />
          </div>
        )}
      </div>

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-bg/30" />

      {/* Remove button — top right, hidden until hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          removeFromStoryboard(clip.id)
        }}
        className="absolute top-1.5 right-1.5 size-5 rounded-full bg-black/40 text-text-muted opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white flex items-center justify-center transition-all duration-150"
        title="Remove"
      >
        <X size={9} />
      </button>

      {/* Clip info — bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 flex items-end justify-between">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] text-white/90 font-medium truncate">
            {clip.clip.fileName}
          </span>
        </div>
        <span className="font-mono text-[9px] text-white/60 tabular-nums shrink-0 ml-1">
          {duration.toFixed(1)}s
        </span>
      </div>

      {/* Position badge — top left */}
      <div className="absolute top-1.5 left-1.5 size-4 rounded bg-black/40 flex items-center justify-center">
        <span className="text-[8px] font-mono text-white/70 tabular-nums">{index + 1}</span>
      </div>
    </div>
  )
}
