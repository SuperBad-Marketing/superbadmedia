import { useState, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Play, Palette, Type, MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { ViewLoader } from '../shared/LoadingPulse'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve, saveProject } from '../../lib/api'

const PreviewView = lazy(() => import('../preview/PreviewView'))
const GradingView = lazy(() => import('../grading/GradingView'))
const CaptionsView = lazy(() => import('../captions/CaptionsView'))
const RevisionChat = lazy(() => import('../revision/RevisionChat'))

type RefineMode = 'preview' | 'grade' | 'captions' | 'revise'

const MODES: { id: RefineMode; label: string; icon: typeof Play }[] = [
  { id: 'preview', label: 'Preview', icon: Play },
  { id: 'grade', label: 'Grade', icon: Palette },
  { id: 'captions', label: 'Captions', icon: Type },
  { id: 'revise', label: 'Revise', icon: MessageSquare },
]

function ModeFallback() {
  return <ViewLoader message="Setting up the tools." />
}

export default function RefineView() {
  const [mode, setMode] = useState<RefineMode>('preview')
  const [sending, setSending] = useState(false)
  const [approving, setApproving] = useState(false)

  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const editTransitions = useAppStore((s) => s.editTransitions)
  const sfxPlacements = useAppStore((s) => s.sfxPlacements)
  const currentProject = useAppStore((s) => s.currentProject)
  const setCurrentProject = useAppStore((s) => s.setCurrentProject)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject)

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
      // Push timeline to Resolve if connected
      if (resolveConnected) {
        const result = await pushTimelineToResolve()
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Rough cut approved. Pushed ${result.clipCount} clips${result.transitionCount > 0 ? ` with ${result.transitionCount} transitions` : ''} to Resolve timeline "${currentProject?.name || 'SuperEdits Assembly'}".`,
          timestamp: new Date().toISOString(),
        })
      }

      // Save project state
      if (currentProject?.id) {
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

      // Move to deliver phase
      setWorkflowPhase('deliver')
    } catch (err: any) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Resolve push failed: ${err?.message || 'Unknown error'}. You can still proceed to export.`,
        timestamp: new Date().toISOString(),
      })
      // Still move to deliver even if Resolve push failed
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          status: 'exporting',
          updatedAt: new Date().toISOString(),
        })
      }
      setWorkflowPhase('deliver')
    } finally {
      setApproving(false)
    }
  }, [approving, resolveConnected, pushTimelineToResolve, currentProject, saveCurrentProject, addChatMessage, setWorkflowPhase, setCurrentProject])

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
            {mode === 'preview' && <PreviewView />}
            {mode === 'grade' && <GradingView />}
            {mode === 'captions' && <CaptionsView />}
            {mode === 'revise' && <RevisionChat />}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {/* Footer actions */}
      {hasClips && mode !== 'revise' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 px-6 pb-4 flex items-center justify-between"
        >
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
