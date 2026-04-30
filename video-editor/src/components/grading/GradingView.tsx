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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <Palette size={28} className="text-text-dim" />
        <p className="text-[11px] text-text-dim">Import footage and build your timeline first</p>
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
      <div className="flex-1 flex flex-col min-h-0 p-6 gap-5">
        {/* Preview area */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-end">
            <div className="segmented-control">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                data-active={viewMode === 'split'}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Columns size={11} />
                  Split
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overlay')}
                data-active={viewMode === 'overlay'}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Layers size={11} />
                  Overlay
                </span>
              </button>
            </div>
          </div>

          {(() => {
            const firstClip = storyboardClips[0]?.clip
            const videoSrc = firstClip ? `file://${firstClip.filePath}` : undefined
            return viewMode === 'split' ? (
              <div className="flex-1 flex gap-2 min-h-0">
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] text-text-dim font-mono tabular-nums uppercase tracking-widest">Before</span>
                  <div className="flex-1 aspect-video bg-bg rounded-xl overflow-hidden flex items-center justify-center">
                    {videoSrc ? (
                      <video src={videoSrc} className="w-full h-full object-contain" muted />
                    ) : (
                      <Film size={28} className="text-text-dim opacity-20" />
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[10px] text-text-dim font-mono tabular-nums uppercase tracking-widest">After</span>
                  <div className="flex-1 aspect-video bg-bg rounded-xl overflow-hidden flex items-center justify-center">
                    {videoSrc ? (
                      <video src={videoSrc} className="w-full h-full object-contain" muted />
                    ) : (
                      <Film size={28} className="text-text-dim opacity-20" />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[10px] text-text-dim font-mono tabular-nums uppercase tracking-widest">Preview</span>
                <div className="flex-1 aspect-video bg-bg rounded-xl overflow-hidden flex items-center justify-center relative">
                  {videoSrc ? (
                    <video src={videoSrc} className="w-full h-full object-contain" muted />
                  ) : (
                    <Film size={32} className="text-text-dim opacity-20" />
                  )}
                  <div className="absolute top-3 left-3 bg-surface-active/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[9px] text-text-dim font-mono uppercase tracking-wider">
                    Overlay
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Controls */}
        <div className="shrink-0 space-y-5 pt-5">
          {/* Input */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-text">Describe what you want</h3>
            <div className="flex gap-2.5">
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
                className="flex-1 bg-surface-active/50 rounded-lg px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={!description.trim()}
                className="bg-accent rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 shrink-0"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="bg-surface rounded-lg px-3.5 py-1.5 text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="space-y-2.5">
            <span className="text-[11px] text-text-dim">Presets</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`w-24 shrink-0 rounded-lg p-2.5 text-xs text-center font-medium transition-colors duration-150 ${
                    activePreset === preset
                      ? 'bg-accent-dim text-accent'
                      : 'bg-surface text-text-dim hover:bg-surface-hover hover:text-text-muted'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-text-dim text-[11px] hover:text-text-muted transition-colors duration-150 rounded-lg hover:bg-surface-hover px-2.5 py-1.5"
            >
              <RotateCcw size={11} />
              Reset Grade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
