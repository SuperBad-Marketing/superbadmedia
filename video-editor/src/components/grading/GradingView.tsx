import { useState, useCallback } from 'react'
import { Palette, Film, RotateCcw, Columns, Layers } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendChatMessage } from '../../lib/api'

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
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const updateChatMessage = useAppStore((s) => s.updateChatMessage)
  const [description, setDescription] = useState('')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [applying, setApplying] = useState(false)

  const hasTimeline = currentProject && storyboardClips.length > 0

  if (!hasTimeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="size-20 rounded-2xl bg-surface-active flex items-center justify-center">
          <Palette size={32} className="text-text-dim" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text">Colour Grading</h2>
        <p className="text-text-muted text-base text-center text-pretty max-w-sm">
          Import footage and build your timeline first
        </p>
      </div>
    )
  }

  const sendGradeCommand = useCallback(async (command: string) => {
    if (applying) return
    setApplying(true)

    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: `Grade: ${command}`, timestamp: new Date().toISOString() }
    addChatMessage(userMsg)

    const loadingId = crypto.randomUUID()
    addChatMessage({ id: loadingId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isLoading: true })

    try {
      const response = await sendChatMessage(`Grade the footage: ${command}`, currentProject?.id)
      updateChatMessage(loadingId, { content: response.content, isLoading: false, action: response.action })
    } catch {
      updateChatMessage(loadingId, { content: 'Failed to apply grade.', isLoading: false })
    } finally {
      setApplying(false)
    }
  }, [applying, addChatMessage, updateChatMessage, currentProject?.id])

  function handleApply() {
    if (!description.trim()) return
    sendGradeCommand(description.trim())
    setDescription('')
  }

  function handleChipClick(chip: string) {
    sendGradeCommand(chip.toLowerCase())
  }

  function handlePresetClick(preset: string) {
    setActivePreset(activePreset === preset ? null : preset)
    sendGradeCommand(`Apply ${preset} preset`)
  }

  function handleReset() {
    setDescription('')
    setActivePreset(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 p-8 gap-6">
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'split' ? 'overlay' : 'split')}
              className="flex items-center gap-2 text-text-dim text-xs hover:text-text-muted transition-colors duration-150"
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

          {(() => {
            const firstClip = storyboardClips[0]?.clip
            const videoSrc = firstClip ? `file://${firstClip.filePath}` : undefined
            return viewMode === 'split' ? (
              <div className="flex-1 flex gap-3 min-h-0">
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] text-text-dim font-mono uppercase tracking-widest">Before</span>
                  <div className="flex-1 aspect-video bg-bg rounded-lg overflow-hidden flex items-center justify-center">
                    {videoSrc ? (
                      <video src={videoSrc} className="w-full h-full object-contain" muted />
                    ) : (
                      <Film size={28} className="text-text-dim opacity-30" />
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] text-text-dim font-mono uppercase tracking-widest">After</span>
                  <div className="flex-1 aspect-video bg-bg rounded-lg overflow-hidden flex items-center justify-center">
                    {videoSrc ? (
                      <video src={videoSrc} className="w-full h-full object-contain" muted />
                    ) : (
                      <Film size={28} className="text-text-dim opacity-30" />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[10px] text-text-dim font-mono uppercase tracking-widest">Preview</span>
                <div className="flex-1 aspect-video bg-bg rounded-lg overflow-hidden flex items-center justify-center relative">
                  {videoSrc ? (
                    <video src={videoSrc} className="w-full h-full object-contain" muted />
                  ) : (
                    <Film size={32} className="text-text-dim opacity-30" />
                  )}
                  <div className="absolute top-2 left-2 bg-surface/80 rounded px-2 py-0.5 text-[9px] text-text-dim font-mono">
                    OVERLAY
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="shrink-0 space-y-6 border-t border-border pt-6">
          <div className="space-y-3">
            <h3 className="text-base font-display font-semibold text-text">Describe what you want</h3>
            <div className="flex gap-3">
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
                className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors duration-150"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={!description.trim()}
                className="bg-accent rounded-xl px-5 py-3 text-sm font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="bg-surface border border-border rounded-lg px-3.5 py-1.5 text-xs text-text-dim hover:border-accent/30 hover:text-text hover:bg-accent-dim transition-colors duration-150"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-text-dim font-mono uppercase tracking-widest">
              Presets
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`w-24 shrink-0 rounded-lg p-2.5 text-xs text-center font-medium transition-colors duration-150 ${
                    activePreset === preset
                      ? 'bg-accent-dim border border-accent text-accent'
                      : 'bg-surface border border-border text-text-dim hover:border-border-active hover:text-text-muted'
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
              className="flex items-center gap-1.5 text-text-dim text-xs hover:text-text-muted transition-colors duration-150"
            >
              <RotateCcw size={12} />
              Reset Grade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
