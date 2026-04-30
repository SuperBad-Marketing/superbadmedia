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
  },
  {
    icon: Play,
    title: 'Centre — Workspace',
    desc: 'The main event. Each tab is a stage in the edit: ingest, storyboard, preview, grading, captions, export.',
    color: 'text-accent',
  },
  {
    icon: MessageSquare,
    title: 'Right — Assistant',
    desc: 'Chat with Claude, browse music from Epidemic Sound, or build your knowledge base from YouTube tutorials.',
    color: 'text-pink',
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
          className={`h-1 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-accent' : 'w-1.5 bg-border-active'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-[640px] bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-10 pt-10 pb-8">
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <h1 className="font-display text-4xl font-extrabold text-text tracking-tight">
                  SuperEdits
                </h1>
                <span className="text-sm font-semibold text-pink tracking-widest uppercase">
                  by SuperBad
                </span>
              </div>
              <p className="text-text-muted text-lg leading-relaxed max-w-md text-pretty">
                Your AI editing assistant. Built to take the boring parts off your plate so you can focus on the creative work.
              </p>
              <div className="w-16 h-px bg-border-active" />
              <p className="text-text-dim text-sm">
                Here's a quick tour of how everything fits together.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-text">The workflow</h2>
                <p className="text-text-muted text-sm mt-1.5">Six stages, left to right. Each tab picks up where the last one left off.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {WORKFLOW_STEPS.map((s, i) => (
                  <div key={s.label} className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-bg">
                    <div className="size-10 rounded-xl bg-accent-dim flex items-center justify-center">
                      <s.icon size={18} className="text-accent" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-mono text-text-dim">{i + 1}</span>
                      <p className="text-sm font-display font-semibold text-text">{s.label}</p>
                      <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-text">Your workspace</h2>
                <p className="text-text-muted text-sm mt-1.5">Three panels, always visible. Everything you need without switching views.</p>
              </div>
              <div className="space-y-3">
                {PANELS.map((panel) => (
                  <div key={panel.title} className="flex items-start gap-4 p-5 rounded-xl bg-bg">
                    <div className="size-10 rounded-xl bg-surface-active flex items-center justify-center shrink-0">
                      <panel.icon size={18} className={panel.color} />
                    </div>
                    <div>
                      <p className="text-sm font-display font-semibold text-text">{panel.title}</p>
                      <p className="text-sm text-text-muted mt-1 leading-relaxed">{panel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-text">Quick tips</h2>
                <p className="text-text-muted text-sm mt-1.5">Things worth knowing before you start.</p>
              </div>
              <div className="space-y-3">
                {TIPS.map((tip) => (
                  <div key={tip.text} className="flex items-center gap-4 p-4 rounded-xl bg-bg">
                    <div className="size-9 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
                      <tip.icon size={16} className="text-accent" />
                    </div>
                    <p className="text-sm text-text leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
              <div className="pt-2 text-center">
                <p className="text-text-dim text-sm">
                  That's it. Drop some footage in and see what happens.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-10 pb-8">
          <StepIndicator current={step} total={totalSteps} />

          <div className="flex items-center gap-3">
            {step === 0 && (
              <button
                onClick={onDismiss}
                className="text-sm text-text-dim hover:text-text-muted transition-colors duration-150"
              >
                Skip
              </button>
            )}
            {canGoBack && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-text-muted hover:text-text transition-colors duration-150"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={() => (isLastStep ? onDismiss() : setStep(step + 1))}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-6 py-2.5 font-display font-semibold text-sm text-white transition-colors duration-150"
            >
              {isLastStep ? 'Get started' : 'Next'}
              {!isLastStep && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
