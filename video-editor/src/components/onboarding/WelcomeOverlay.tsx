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
    <div className="flex items-center gap-2.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-8 h-2 bg-accent'
              : i < current
                ? 'size-2 bg-accent/40'
                : 'size-2 bg-border-active'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-md">
      <div className="w-full max-w-[720px] bg-surface border border-border rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="px-14 pt-14 pb-10 min-h-[380px] flex flex-col justify-center">
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-8">
              <div className="flex flex-col items-center gap-3">
                <h1 className="font-display text-5xl font-extrabold text-text tracking-tight">
                  SuperEdits
                </h1>
                <span className="text-xs font-semibold text-pink tracking-[0.25em] uppercase">
                  by SuperBad
                </span>
              </div>
              <p className="text-text-muted text-lg leading-relaxed max-w-md text-pretty">
                Your AI editing assistant. Built to take the boring parts off your plate so you can focus on the creative work.
              </p>
              <div className="w-12 h-px bg-accent/30" />
              <p className="text-text-dim text-sm">
                Here's a quick tour of how everything fits together.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold text-text">The workflow</h2>
                <p className="text-text-muted text-sm mt-2">Six stages, left to right. Each tab picks up where the last one left off.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {WORKFLOW_STEPS.map((s, i) => (
                  <div key={s.label} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-bg border border-border">
                    <div className="size-11 rounded-xl bg-accent-dim flex items-center justify-center">
                      <s.icon size={18} className="text-accent" />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-mono text-text-dim tabular-nums">{i + 1}</span>
                      <p className="text-sm font-display font-semibold text-text">{s.label}</p>
                      <p className="text-xs text-text-dim mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold text-text">Your workspace</h2>
                <p className="text-text-muted text-sm mt-2">Three panels, always visible. Everything you need without switching views.</p>
              </div>
              <div className="space-y-3">
                {PANELS.map((panel) => (
                  <div key={panel.title} className="flex items-start gap-5 p-6 rounded-2xl bg-bg border border-border">
                    <div className={`size-11 rounded-xl ${panel.bg} flex items-center justify-center shrink-0`}>
                      <panel.icon size={18} className={panel.color} />
                    </div>
                    <div>
                      <p className="text-sm font-display font-semibold text-text">{panel.title}</p>
                      <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{panel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold text-text">Quick tips</h2>
                <p className="text-text-muted text-sm mt-2">Things worth knowing before you start.</p>
              </div>
              <div className="space-y-3">
                {TIPS.map((tip) => (
                  <div key={tip.text} className="flex items-center gap-5 p-5 rounded-2xl bg-bg border border-border">
                    <div className="size-10 rounded-xl bg-accent-dim flex items-center justify-center shrink-0">
                      <tip.icon size={16} className="text-accent" />
                    </div>
                    <p className="text-sm text-text leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-text-dim text-sm text-center pt-2">
                That's it. Drop some footage in and see what happens.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-14 pb-10">
          <StepIndicator current={step} total={totalSteps} />

          <div className="flex items-center gap-4">
            {step === 0 && (
              <button
                onClick={onDismiss}
                className="px-5 py-3 rounded-xl text-sm font-medium text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
              >
                Skip tour
              </button>
            )}
            {canGoBack && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={() => (isLastStep ? onDismiss() : setStep(step + 1))}
              className="flex items-center gap-2.5 bg-accent hover:bg-accent-hover rounded-xl px-8 py-3.5 font-display font-bold text-sm text-white transition-colors duration-150"
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
