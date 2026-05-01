import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Settings, Check, Monitor, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore } from '../../stores/appStore'
import { checkResolveConnection, connectResolve } from '../../lib/api'
import { useAutosave } from '../../hooks/useAutosave'
import type { WorkflowPhase } from '../../types'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

const WORKFLOW_STEPS: { id: WorkflowPhase; label: string }[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'assemble', label: 'Assemble' },
  { id: 'refine', label: 'Refine' },
  { id: 'polish', label: 'Polish' },
  { id: 'deliver', label: 'Deliver' },
]

const PHASE_ORDER: WorkflowPhase[] = ['home', 'import', 'brief', 'assemble', 'refine', 'polish', 'deliver']

function getPhaseIndex(phase: WorkflowPhase): number {
  return PHASE_ORDER.indexOf(phase)
}

function ResolveIndicator() {
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const setResolveConnected = useAppStore((s) => s.setResolveConnected)
  const [resolveProject, setResolveProject] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const pollStatus = useCallback(async () => {
    try {
      const status = await checkResolveConnection()
      setResolveConnected(status.connected)
      setResolveProject(status.project || null)
    } catch {
      setResolveConnected(false)
      setResolveProject(null)
    }
  }, [setResolveConnected])

  useEffect(() => {
    pollStatus()
    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [pollStatus])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const result = await connectResolve()
      setResolveConnected(result.connected)
      if (result.project) setResolveProject(result.project)
    } catch {
      setResolveConnected(false)
    } finally {
      setConnecting(false)
    }
  }, [setResolveConnected])

  return (
    <div className="relative">
      <button
        onClick={() => setPopoverOpen(!popoverOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 hover:bg-surface-hover/50"
        aria-label="Resolve connection status"
      >
        <div className={`size-1.5 rounded-full transition-colors duration-300 ${
          resolveConnected ? 'bg-green' : 'bg-text-dim/30'
        }`} />
        <Monitor size={12} className={resolveConnected ? 'text-text-muted' : 'text-text-dim/50'} />
      </button>

      <AnimatePresence>
        {popoverOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full mt-2 z-50 floating-panel rounded-xl p-4 min-w-[220px] space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${resolveConnected ? 'bg-green' : 'bg-text-dim/30'}`} />
                <span className="text-[11px] font-medium text-text">
                  {resolveConnected ? 'Connected to Resolve' : 'Resolve not connected'}
                </span>
              </div>

              {resolveConnected && resolveProject && (
                <div className="space-y-1">
                  <span className="text-[10px] text-text-dim">Active project</span>
                  <p className="text-[11px] text-text-muted font-mono truncate">{resolveProject}</p>
                </div>
              )}

              {!resolveConnected && (
                <div className="space-y-2">
                  <p className="text-[10px] text-text-dim leading-relaxed">
                    Open DaVinci Resolve, then connect. It needs to be running first.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="w-full flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-150 disabled:opacity-40"
                  >
                    {connecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              )}

              {resolveConnected && (
                <button
                  onClick={() => { pollStatus(); setPopoverOpen(false) }}
                  className="w-full text-[10px] text-text-dim hover:text-text-muted transition-colors duration-150 text-center py-1"
                >
                  Refresh status
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const workflowPhase = useAppStore((s) => s.workflowPhase)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { lastSaved, saving } = useAutosave()

  const currentIndex = getPhaseIndex(workflowPhase)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex items-center justify-between h-11 px-5 shrink-0 select-none"
      >
        {/* Left — logo + project name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setWorkflowPhase('home')}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span className="font-display font-bold text-sm tracking-tight text-text">
              SuperEdits
            </span>
          </button>
          {currentProject && (
            <span className="text-[11px] text-text-dim truncate max-w-48">
              {currentProject.name}
            </span>
          )}
          {currentProject && (
            <span className="flex items-center gap-1 text-[9px] text-text-dim/50 tabular-nums">
              {saving ? (
                <><Save size={8} className="animate-pulse" /> Saving...</>
              ) : lastSaved ? (
                <><Save size={8} /> {lastSaved}</>
              ) : null}
            </span>
          )}
        </div>

        {/* Centre — workflow spine */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, i) => {
            const stepIndex = getPhaseIndex(step.id)
            const isActive = workflowPhase === step.id
            const isComplete = currentIndex > stepIndex
            const isFuture = currentIndex < stepIndex

            return (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className={`w-8 h-px mx-1 transition-colors duration-400 ${
                      isComplete ? 'bg-green/30' : 'bg-border'
                    }`}
                  />
                )}
                <button
                  onClick={() => {
                    if (!isFuture) setWorkflowPhase(step.id)
                  }}
                  disabled={isFuture}
                  className={`workflow-step flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                    isActive
                      ? 'text-text bg-surface-active/50'
                      : isComplete
                        ? 'text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer'
                        : 'text-text-dim cursor-default'
                  }`}
                  data-active={isActive}
                  data-complete={isComplete}
                  data-future={isFuture}
                >
                  {isComplete && (
                    <Check size={10} className="text-green" />
                  )}
                  {isActive && (
                    <div className="size-1.5 rounded-full bg-accent" />
                  )}
                  {step.label}
                </button>
              </div>
            )
          })}
        </div>

        {/* Right — resolve status + settings */}
        <div className="flex items-center gap-1">
          <ResolveIndicator />
          <button
            onClick={() => setSettingsOpen(true)}
            className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </motion.div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
