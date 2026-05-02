import { useState, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Clock, Volume2, Type, Sparkles, CheckCircle2, Loader2, ArrowRight, Send } from 'lucide-react'
import { ViewLoader } from '../shared/LoadingPulse'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve, saveProject, recordClipUsage } from '../../lib/api'

const TimingView = lazy(() => import('./TimingView'))
const SoundDesignView = lazy(() => import('./SoundDesignView'))
const TextTitlesView = lazy(() => import('./TextTitlesView'))
const AppliedEffectsView = lazy(() => import('./AppliedEffectsView'))
const FinalReviewView = lazy(() => import('./FinalReviewView'))

type PolishMode = 'timing' | 'sound' | 'text' | 'effects' | 'review'

const MODES: { id: PolishMode; label: string; icon: typeof Clock }[] = [
  { id: 'timing', label: 'Timing', icon: Clock },
  { id: 'sound', label: 'Sound Design', icon: Volume2 },
  { id: 'text', label: 'Text & Titles', icon: Type },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'review', label: 'Final Review', icon: CheckCircle2 },
]

function ModeFallback() {
  return <ViewLoader message="Loading polish tools." />
}

export default function PolishView() {
  const [mode, setMode] = useState<PolishMode>('timing')
  const [finalizing, setFinalizing] = useState(false)
  const [pushing, setPushing] = useState(false)

  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const currentProject = useAppStore((s) => s.currentProject)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject)

  const pushTimelineToResolve = useCallback(async () => {
    const uniquePaths = [...new Set(storyboardClips.map((c) => c.clip.filePath))]
    const importResult = await sendToResolve('import_media', { file_paths: uniquePaths })
    if (importResult.error) throw new Error(importResult.error)

    const projectName = currentProject?.name || 'SuperEdits Assembly'
    await sendToResolve('create_timeline', { name: projectName })

    const clipData = storyboardClips.map((c) => ({
      filePath: c.clip.filePath,
      startTime: c.startTime,
      endTime: c.endTime,
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
    if (pushing) return
    setPushing(true)
    try {
      const result = await pushTimelineToResolve()
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Synced ${result.clipCount} clips to Resolve${result.transitionCount > 0 ? ` with ${result.transitionCount} transitions` : ''}.`,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: err?.message?.includes('Bridge')
          ? 'Could not reach Resolve. Make sure it is running and connected.'
          : `Failed to sync to Resolve: ${err?.message || 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setPushing(false)
    }
  }, [pushing, pushTimelineToResolve, addChatMessage])

  const handleFinalize = useCallback(async () => {
    if (finalizing) return
    setFinalizing(true)
    try {
      if (resolveConnected) {
        const result = await pushTimelineToResolve()
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Finalized. Pushed ${result.clipCount} clips${result.transitionCount > 0 ? ` with ${result.transitionCount} transitions` : ''} to Resolve.`,
          timestamp: new Date().toISOString(),
        })
      }

      if (currentProject?.id) {
        const filePaths = storyboardClips.map((c) => c.clip.filePath)
        if (filePaths.length > 0) {
          recordClipUsage(currentProject.id, filePaths).catch(() => {})
        }

        const state = saveCurrentProject()
        await saveProject(
          currentProject.id,
          currentProject.name,
          currentProject.clientName,
          state,
        ).catch(() => {})

        setCurrentProject({
          ...currentProject,
          status: 'exporting',
          updatedAt: new Date().toISOString(),
        })
      }

      setWorkflowPhase('deliver')
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Resolve sync failed: ${err?.message || 'Unknown error'}. Proceeding to export anyway.`,
        timestamp: new Date().toISOString(),
      })
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          status: 'exporting',
          updatedAt: new Date().toISOString(),
        })
      }
      setWorkflowPhase('deliver')
    } finally {
      setFinalizing(false)
    }
  }, [finalizing, resolveConnected, pushTimelineToResolve, currentProject, saveCurrentProject, addChatMessage, setWorkflowPhase, setCurrentProject])

  const hasClips = storyboardClips.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-mode tabs */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 flex items-center justify-center gap-1 px-6 pt-4 pb-2"
      >
        <div className="flex items-center gap-0.5 bg-surface-active/30 rounded-xl p-0.5">
          {MODES.map((m) => {
            const isActive = mode === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-text bg-surface-active/80'
                    : 'text-text-dim hover:text-text-muted'
                }`}
              >
                <Icon size={12} />
                {m.label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Active mode content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="flex-1 flex flex-col min-h-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Suspense fallback={<ModeFallback />}>
            {mode === 'timing' && <TimingView />}
            {mode === 'sound' && <SoundDesignView />}
            {mode === 'text' && <TextTitlesView />}
            {mode === 'effects' && <AppliedEffectsView />}
            {mode === 'review' && <FinalReviewView />}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {/* Footer actions */}
      {hasClips && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 px-6 pb-4 flex items-center justify-between"
        >
          <button
            onClick={handlePushToResolve}
            disabled={pushing || !resolveConnected}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted hover:text-text text-xs font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {pushing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Send size={12} />
                {resolveConnected ? 'Sync to Resolve' : 'Connect Resolve'}
              </>
            )}
          </button>

          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {finalizing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <ArrowRight size={13} />
                Finalize & deliver
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  )
}
