import { useState, lazy, Suspense } from 'react'
import { Settings, Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useAppStore } from '../../stores/appStore'
import type { WorkflowPhase } from '../../types'

const SettingsModal = lazy(() => import('../settings/SettingsModal'))

const WORKFLOW_STEPS: { id: WorkflowPhase; label: string }[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'assemble', label: 'Assemble' },
  { id: 'refine', label: 'Refine' },
  { id: 'deliver', label: 'Deliver' },
]

const PHASE_ORDER: WorkflowPhase[] = ['home', 'import', 'brief', 'assemble', 'refine', 'deliver']

function getPhaseIndex(phase: WorkflowPhase): number {
  return PHASE_ORDER.indexOf(phase)
}

export default function HeaderBar() {
  const currentProject = useAppStore((s) => s.currentProject)
  const workflowPhase = useAppStore((s) => s.workflowPhase)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

        {/* Right — settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
          aria-label="Settings"
        >
          <Settings size={15} />
        </button>
      </motion.div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
