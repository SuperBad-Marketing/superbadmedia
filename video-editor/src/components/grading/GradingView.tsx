import { useState } from 'react'
import { Palette, Film, RotateCcw, Columns, Layers } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const QUICK_CHIPS = [
  'Warmer',
  'Cooler',
  'More contrast',
  'Less contrast',
  'Brighter',
  'Darker',
  'More saturated',
  'Desaturated',
  'Match shots',
] as const

const PRESETS = [
  'Cinematic Warm',
  'Moody Editorial',
  'Clean Commercial',
  'Film Emulation',
  'Desaturated Raw',
] as const

type ViewMode = 'split' | 'overlay'

export default function GradingView() {
  const currentProject = useAppStore((s) => s.currentProject)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const [description, setDescription] = useState('')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  const hasTimeline = currentProject && storyboardClips.length > 0

  if (!hasTimeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <Palette size={48} className="text-text-dim" />
        <h2 className="text-2xl font-semibold text-text">Colour Grading</h2>
        <p className="text-text-muted text-sm text-center max-w-sm">
          Import footage and build your timeline first
        </p>
      </div>
    )
  }

  function handleApply() {
    if (!description.trim()) return
    setDescription('')
  }

  function handleChipClick(chip: string) {
    setDescription(chip.toLowerCase())
  }

  function handlePresetClick(preset: string) {
    setActivePreset(activePreset === preset ? null : preset)
  }

  function handleReset() {
    setDescription('')
    setActivePreset(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="aspect-video flex-1 min-w-0" />
            </div>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'split' ? 'overlay' : 'split')}
              className="flex items-center gap-1.5 text-text-dim text-xs hover:text-text-muted transition-colors"
            >
              {viewMode === 'split' ? (
                <>
                  <Layers size={12} />
                  Overlay
                </>
              ) : (
                <>
                  <Columns size={12} />
                  Split
                </>
              )}
            </button>
          </div>

          {viewMode === 'split' ? (
            <div className="flex-1 flex gap-3 min-h-0">
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs text-text-dim font-medium uppercase tracking-wide">Before</span>
                <div className="flex-1 aspect-video bg-surface-active rounded-lg flex items-center justify-center">
                  <Film size={32} className="text-text-dim" />
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs text-text-dim font-medium uppercase tracking-wide">After</span>
                <div className="flex-1 aspect-video bg-surface-active rounded-lg flex items-center justify-center">
                  <Film size={32} className="text-text-dim" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-xs text-text-dim font-medium uppercase tracking-wide">Preview</span>
              <div className="flex-1 aspect-video bg-surface-active rounded-lg flex items-center justify-center relative">
                <Film size={40} className="text-text-dim" />
                <div className="absolute top-2 left-2 bg-bg/80 rounded px-2 py-0.5 text-[10px] text-text-dim font-medium">
                  Overlay
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-4 border-t border-border pt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text">Describe what you want</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleApply()
                  }
                }}
                placeholder="e.g. 'warmer', 'more contrast', 'skin tones too orange'..."
                className="flex-1 bg-bg border border-border rounded-xl p-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={!description.trim()}
                className="bg-accent rounded-lg px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50 shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="bg-surface border border-border rounded-full px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-accent cursor-pointer transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-xs text-text-dim uppercase tracking-widest font-semibold">
              Presets
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`w-24 shrink-0 rounded-lg p-2 text-xs text-center font-medium transition-colors ${
                    activePreset === preset
                      ? 'bg-accent-dim border border-accent text-accent'
                      : 'bg-surface border border-border text-text-muted hover:border-border-active hover:text-text'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-text-dim text-sm hover:text-text-muted transition-colors"
            >
              <RotateCcw size={14} />
              Reset Grade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
