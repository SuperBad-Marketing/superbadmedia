import { useState, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Palette, Type, MessageSquare, Send, Loader2, CheckCircle2, Volume2,
  ArrowLeft, Film, Clock, Sparkles,
} from 'lucide-react'
import { ViewLoader } from '../shared/LoadingPulse'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve, saveProject, applyGrading, applyAudioMix, applyTitles } from '../../lib/api'

const GradingView = lazy(() => import('../grading/GradingView'))
const CaptionsView = lazy(() => import('../captions/CaptionsView'))
const RevisionChat = lazy(() => import('../revision/RevisionChat'))

type FocusedMode = 'grade' | 'captions' | 'revise' | null

function ModeFallback() {
  return <ViewLoader message="Setting up the tools." />
}

const ACTION_CARDS: { id: Exclude<FocusedMode, null>; label: string; subtitle: string; icon: typeof Palette }[] = [
  { id: 'grade', label: 'Grade', subtitle: 'Color, look, and camera matching', icon: Palette },
  { id: 'captions', label: 'Captions', subtitle: 'Subtitles, text overlays, titles', icon: Type },
  { id: 'revise', label: 'Revise', subtitle: 'Chat-driven edits and tweaks', icon: MessageSquare },
]

export default function RefineView() {
  const [focusedMode, setFocusedMode] = useState<FocusedMode>(null)
  const [sending, setSending] = useState(false)
  const [approving, setApproving] = useState(false)
  const [applyingPipeline, setApplyingPipeline] = useState<string | null>(null)

  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const currentProject = useAppStore((s) => s.currentProject)
  const lastEditIntent = useAppStore((s) => s.lastEditIntent)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const editPreferences = useAppStore((s) => s.editPreferences)

  const pushTimelineToResolve = useCallback(async () => {
    const uniquePaths = [...new Set(storyboardClips.map((c) => c.clip.filePath))]
    const importResult = await sendToResolve('import_media', { file_paths: uniquePaths })

    if (importResult.error) {
      throw new Error(importResult.error)
    }

    const projectName = currentProject?.name || 'SuperEdits Assembly'
    await sendToResolve('create_timeline', { name: projectName })

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

    return { clipCount: storyboardClips.length, transitionCount: editTransitions.length }
  }, [storyboardClips, editTransitions, currentProject])

  const handlePushToResolve = useCallback(async () => {
    if (sending) return
    setSending(true)
    try {
      const result = await pushTimelineToResolve()
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Pushed ${result.clipCount} clips to Resolve${result.transitionCount > 0 ? ` with ${result.transitionCount} transitions` : ''}. Timeline updated.`,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: err?.message?.includes('Bridge')
          ? 'Could not reach Resolve. Make sure it is running and connected.'
          : `Failed to send to Resolve: ${err?.message || 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }, [sending, pushTimelineToResolve, addChatMessage])

  const handleApproveRoughCut = useCallback(async () => {
    if (approving) return
    setApproving(true)
    try {
      if (resolveConnected) {
        const result = await pushTimelineToResolve()
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Rough cut approved. Pushed ${result.clipCount} clips${result.transitionCount > 0 ? ` with ${result.transitionCount} transitions` : ''} to Resolve timeline "${currentProject?.name || 'SuperEdits Assembly'}".`,
          timestamp: new Date().toISOString(),
        })
      }

      if (currentProject?.id) {
        const state = saveCurrentProject()
        await saveProject(
          currentProject.id,
          currentProject.name,
          currentProject.clientName,
          state,
        ).catch(() => {})
      }

      setWorkflowPhase('polish')
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Resolve push failed: ${err?.message || 'Unknown error'}. You can still continue polishing.`,
        timestamp: new Date().toISOString(),
      })
      setWorkflowPhase('polish')
    } finally {
      setApproving(false)
    }
  }, [approving, resolveConnected, pushTimelineToResolve, currentProject, saveCurrentProject, addChatMessage, setWorkflowPhase])

  const handleApplyPipeline = useCallback(async (pipeline: 'grade' | 'audio' | 'titles') => {
    if (!lastEditIntent || !resolveConnected || applyingPipeline) return
    setApplyingPipeline(pipeline)

    try {
      let message = ''
      if (pipeline === 'grade') {
        const result = await applyGrading(undefined, lastEditIntent)
        message = `Graded ${result.graded} clips (${lastEditIntent.grading.look || 'natural'} look).`
      } else if (pipeline === 'audio') {
        const result = await applyAudioMix(undefined, lastEditIntent)
        message = `Mixed ${result.clipsProcessed} clips${result.musicLevel != null ? `, music at ${result.musicLevel}dB` : ''}.`
      } else if (pipeline === 'titles') {
        const result = await applyTitles(
          undefined, lastEditIntent,
          currentProject?.name, currentProject?.clientName,
        )
        message = `Placed ${result.placed} title${result.placed !== 1 ? 's' : ''}.`
      }

      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: message,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Failed to apply ${pipeline}: ${err?.message || 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setApplyingPipeline(null)
    }
  }, [lastEditIntent, resolveConnected, applyingPipeline, currentProject, addChatMessage])

  const hasClips = storyboardClips.length > 0

  const totalDuration = storyboardClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.round(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (focusedMode) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 flex items-center gap-3 px-6 pt-4 pb-2"
        >
          <button
            onClick={() => setFocusedMode(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-text-dim hover:text-text-muted hover:bg-surface-hover text-xs font-medium transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          <span className="text-sm font-semibold text-text">
            {ACTION_CARDS.find((c) => c.id === focusedMode)?.label}
          </span>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={focusedMode}
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Suspense fallback={<ModeFallback />}>
              {focusedMode === 'grade' && <GradingView />}
              {focusedMode === 'captions' && <CaptionsView />}
              {focusedMode === 'revise' && <RevisionChat />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl rounded-2xl border border-border bg-surface-active/30 p-6"
        >
          <h2 className="text-lg font-semibold text-text mb-4">
            {currentProject?.name || 'Assembly'} — Rough Cut
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Film size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-dim">Clips</p>
                <p className="text-sm font-semibold text-text">{storyboardClips.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-dim">Duration</p>
                <p className="text-sm font-semibold text-text">{formatDuration(totalDuration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-dim">Look</p>
                <p className="text-sm font-semibold text-text capitalize">
                  {editPreferences?.grading?.look || lastEditIntent?.grading?.look || 'Natural'}
                </p>
              </div>
            </div>
          </div>
          {selectedTrack && (
            <p className="text-[11px] text-text-dim mt-3 truncate">
              Music: {selectedTrack.title} — {selectedTrack.artist}
            </p>
          )}
        </motion.div>

        {/* Action cards */}
        <div className="w-full max-w-xl grid grid-cols-3 gap-3">
          {ACTION_CARDS.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 * (i + 1) }}
                onClick={() => setFocusedMode(card.id)}
                className="group rounded-2xl border border-border hover:border-accent/30 bg-surface-active/20 hover:bg-surface-active/40 p-5 text-left transition-all duration-200 cursor-pointer"
              >
                <div className="size-10 rounded-xl bg-accent/10 group-hover:bg-accent/20 flex items-center justify-center mb-3 transition-colors duration-200">
                  <Icon size={18} className="text-accent" />
                </div>
                <p className="text-sm font-semibold text-text mb-1">{card.label}</p>
                <p className="text-[11px] text-text-dim leading-relaxed">{card.subtitle}</p>
              </motion.button>
            )
          })}
        </div>

        {/* Quick-apply pipeline buttons */}
        {lastEditIntent && resolveConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="flex items-center gap-1.5"
          >
            <span className="text-[11px] text-text-dim mr-2">Quick apply:</span>
            <button
              onClick={() => handleApplyPipeline('grade')}
              disabled={!!applyingPipeline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-[11px] font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {applyingPipeline === 'grade' ? <Loader2 size={11} className="animate-spin" /> : <Palette size={11} />}
              Grade
            </button>
            <button
              onClick={() => handleApplyPipeline('audio')}
              disabled={!!applyingPipeline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-[11px] font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {applyingPipeline === 'audio' ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />}
              Mix
            </button>
            <button
              onClick={() => handleApplyPipeline('titles')}
              disabled={!!applyingPipeline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-[11px] font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {applyingPipeline === 'titles' ? <Loader2 size={11} className="animate-spin" /> : <Type size={11} />}
              Titles
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer actions */}
      {hasClips && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 px-6 pb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWorkflowPhase('assemble')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-text-dim hover:text-text-muted hover:bg-surface-hover text-xs font-medium transition-all duration-200 cursor-pointer"
            >
              <ArrowLeft size={12} />
              Storyboard
            </button>
            <button
              onClick={handlePushToResolve}
              disabled={sending || !resolveConnected}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {sending ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Send size={12} />
                  {resolveConnected ? 'Push to Resolve' : 'Connect Resolve'}
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleApproveRoughCut}
            disabled={approving}
            className="flex items-center gap-2 bg-green hover:bg-green/90 text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {approving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                Approve rough cut
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  )
}
