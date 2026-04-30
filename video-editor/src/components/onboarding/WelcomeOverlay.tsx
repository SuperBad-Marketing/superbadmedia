import { useState } from 'react'
import {
  HardDrive,
  Film,
  Play,
  Palette,
  Type,
  Upload,
  MessageSquare,
  Music,
  BookOpen,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'

interface WelcomeOverlayProps {
  onDismiss: () => void
}

const WORKFLOW_STEPS = [
  { icon: HardDrive, label: 'Import', desc: 'Drop footage from a card or folder' },
  { icon: Film, label: 'Storyboard', desc: 'Arrange clips, set transitions' },
  { icon: Play, label: 'Preview', desc: 'Watch it back, grab frames' },
  { icon: Palette, label: 'Grade', desc: 'Describe the look you want' },
  { icon: Type, label: 'Caption', desc: 'Auto-generate from audio' },
  { icon: Upload, label: 'Export', desc: 'Render to any format' },
]

const PANELS = [
  {
    icon: Film,
    title: 'Left — Media',
    desc: 'Your imported footage, searchable and filterable. Click a clip to add it to the storyboard.',
    color: 'text-orange',
    bg: 'bg-orange-dim',
  },
  {
    icon: Play,
    title: 'Centre — Workspace',
    desc: 'The main event. Each tab is a stage in the edit: ingest, storyboard, preview, grading, captions, export.',
    color: 'text-accent',
    bg: 'bg-accent-dim',
  },
  {
    icon: MessageSquare,
    title: 'Right — Assistant',
    desc: 'Chat with Claude, browse music from Epidemic Sound, or build your knowledge base from YouTube tutorials.',
    color: 'text-pink',
    bg: 'bg-pink-dim',
  },
]

const TIPS = [
  { icon: MessageSquare, text: 'Ask Claude to build a rough cut from your footage' },
  { icon: Music, text: 'Pick your music first — it sets the pace for everything' },
  { icon: BookOpen, text: 'Paste YouTube links to learn new editing techniques' },
  { icon: Palette, text: 'Describe your grade in plain English — "warmer", "more contrast"' },
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-1.5 bg-text-muted'
              : i < current
                ? 'size-1.5 bg-text-dim'
                : 'size-1.5 bg-surface-active'
          }`}
        />
      ))}
    </div>
  )
}

export default function WelcomeOverlay({ onDismiss }: WelcomeOverlayProps) {
  const [step, setStep] = useState(0)
  const totalSteps = 4

  const canGoBack = step > 0
  const isLastStep = step === totalSteps - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md">
      <div className="w-full max-w-[680px] bg-surface rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="px-12 pt-12 pb-8 min-h-[360px] flex flex-col justify-center">
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <h1 className="font-display text-lg font-semibold text-text tracking-tight">
                  SuperEdits
                </h1>
                <span className="text-[10px] font-semibold text-text-dim tracking-[0.25em] uppercase">
                  by SuperBad
                </span>
              </div>
              <p className="text-xs text-text-dim leading-relaxed max-w-sm text-pretty">
                Your AI editing assistant. Built to take the boring parts off your plate so you can focus on the creative work.
              </p>
              <div className="w-8 h-px bg-surface-active" />
              <p className="text-[11px] text-text-dim">
                Here's a quick tour of how everything fits together.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-sm text-text">The workflow</h2>
                <p className="text-[11px] text-text-dim mt-1.5">Six stages, left to right. Each tab picks up where the last one left off.</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {WORKFLOW_STEPS.map((s, i) => (
                  <div key={s.label} className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-surface-active/50">
                    <div className="size-9 rounded-lg bg-accent-dim flex items-center justify-center">
                      <s.icon size={16} className="text-accent" />
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-mono text-text-dim tabular-nums">{i + 1}</span>
                      <p className="text-[11px] font-display font-semibold text-text">{s.label}</p>
                      <p className="text-[10px] text-text-dim mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-sm text-text">Your workspace</h2>
                <p className="text-[11px] text-text-dim mt-1.5">Three panels, always visible. Everything you need without switching views.</p>
              </div>
              <div className="space-y-2">
                {PANELS.map((panel) => (
                  <div key={panel.title} className="flex items-start gap-4 p-4 rounded-xl bg-surface-active/50">
                    <div className={`size-9 rounded-lg ${panel.bg} flex items-center justify-center shrink-0`}>
                      <panel.icon size={16} className={panel.color} />
                    </div>
                    <div>
                      <p className="text-[11px] font-display font-semibold text-text">{panel.title}</p>
                      <p className="text-[11px] text-text-dim mt-1 leading-relaxed">{panel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-sm text-text">Quick tips</h2>
                <p className="text-[11px] text-text-dim mt-1.5">Things worth knowing before you start.</p>
              </div>
              <div className="space-y-2">
                {TIPS.map((tip) => (
                  <div key={tip.text} className="flex items-center gap-4 p-4 rounded-xl bg-surface-active/50">
                    <div className="size-8 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
                      <tip.icon size={14} className="text-accent" />
                    </div>
                    <p className="text-[11px] text-text leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-dim text-center pt-1">
                That's it. Drop some footage in and see what happens.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-12 pb-8">
          <StepIndicator current={step} total={totalSteps} />

          <div className="flex items-center gap-3">
            {step === 0 && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
              >
                Skip tour
              </button>
            )}
            {canGoBack && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
              >
                <ArrowLeft size={12} />
                Back
              </button>
            )}
            <button
              onClick={() => (isLastStep ? onDismiss() : setStep(step + 1))}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 font-semibold text-xs text-white transition-colors duration-150"
            >
              {isLastStep ? 'Get started' : 'Next'}
              {!isLastStep && <ArrowRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
