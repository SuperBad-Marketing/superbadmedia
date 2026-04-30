import { useState, useCallback } from 'react'
import { Type, Trash2, Plus, Loader2, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
}

interface CaptionStyle {
  font: string
  size: 'small' | 'medium' | 'large'
  position: 'bottom' | 'center' | 'top'
  background: boolean
  animation: 'none' | 'fade' | 'pop' | 'typewriter'
  color: string
}

const FONTS = ['Inter', 'Montserrat', 'Playfair Display', 'Space Mono', 'Bebas Neue', 'Roboto Condensed']

const ANIMATIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade In' },
  { id: 'pop', label: 'Pop' },
  { id: 'typewriter', label: 'Typewriter' },
] as const

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export default function CaptionsView() {
  const currentProject = useAppStore((s) => s.currentProject)
  const storyboardClips = useAppStore((s) => s.storyboardClips)

  const [captions, setCaptions] = useState<Caption[]>([])
  const [generating, setGenerating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [style, setStyle] = useState<CaptionStyle>({
    font: 'Inter',
    size: 'medium',
    position: 'bottom',
    background: true,
    animation: 'pop',
    color: '#FFFFFF',
  })
  const [fontOpen, setFontOpen] = useState(false)

  const hasTimeline = currentProject && storyboardClips.length > 0

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const firstClip = storyboardClips[0]?.clip
      if (!firstClip) return

      const res = await fetch('/api/captions/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: firstClip.filePath }),
      })
      const data = await res.json()
      if (data.captions) {
        setCaptions(data.captions)
      }
    } catch {
      setCaptions([
        { id: crypto.randomUUID(), startTime: 0, endTime: 3, text: '[Caption 1]' },
        { id: crypto.randomUUID(), startTime: 4, endTime: 7, text: '[Caption 2]' },
        { id: crypto.randomUUID(), startTime: 8, endTime: 11, text: '[Caption 3]' },
      ])
    } finally {
      setGenerating(false)
    }
  }, [storyboardClips])

  const updateCaption = (id: string, updates: Partial<Caption>) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const removeCaption = (id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id))
  }

  const addCaption = () => {
    const last = captions[captions.length - 1]
    const start = last ? last.endTime + 1 : 0
    setCaptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), startTime: start, endTime: start + 3, text: '' },
    ])
  }

  if (!hasTimeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="size-20 rounded-2xl bg-surface-active flex items-center justify-center">
          <Type size={32} className="text-text-dim" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text">Captions</h2>
        <p className="text-text-muted text-base text-center text-pretty max-w-sm">
          Build your timeline first, then generate captions from the audio
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        {/* Caption list */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-display font-semibold text-text">
              Captions {captions.length > 0 && <span className="font-mono text-text-dim">({captions.length})</span>}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addCaption}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors duration-150"
              >
                <Plus size={12} />
                Add
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 bg-accent rounded-lg px-3 py-1.5 text-xs font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-50"
              >
                {generating && <Loader2 size={12} className="animate-spin" />}
                {generating ? 'Generating...' : captions.length > 0 ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {captions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-text-dim text-sm">
                <Type size={24} />
                <p>Click Generate to create captions from audio</p>
              </div>
            ) : (
              captions.map((caption, i) => (
                <div
                  key={caption.id}
                  className={`bg-surface border rounded-lg p-3 space-y-2 transition-colors ${
                    editingId === caption.id ? 'border-accent' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-dim font-mono tabular-nums">
                      #{i + 1} &middot; {formatTime(caption.startTime)} → {formatTime(caption.endTime)}
                    </span>
                    <button
                      onClick={() => removeCaption(caption.id)}
                      aria-label="Remove caption"
                      className="text-text-dim hover:text-accent transition-colors duration-150"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <textarea
                    value={caption.text}
                    onChange={(e) => updateCaption(caption.id, { text: e.target.value })}
                    onFocus={() => setEditingId(caption.id)}
                    onBlur={() => setEditingId(null)}
                    rows={2}
                    className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text resize-none focus:outline-none focus:border-accent transition-colors"
                    placeholder="Caption text..."
                  />

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] text-text-dim">In</label>
                      <input
                        type="number"
                        value={caption.startTime}
                        onChange={(e) => updateCaption(caption.id, { startTime: Number(e.target.value) })}
                        step={0.1}
                        className="w-16 bg-bg border border-border rounded px-1.5 py-0.5 text-xs text-text font-mono tabular-nums focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] text-text-dim">Out</label>
                      <input
                        type="number"
                        value={caption.endTime}
                        onChange={(e) => updateCaption(caption.id, { endTime: Number(e.target.value) })}
                        step={0.1}
                        className="w-16 bg-bg border border-border rounded px-1.5 py-0.5 text-xs text-text font-mono tabular-nums focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Style panel */}
        <div className="w-72 shrink-0 p-5 space-y-5 overflow-y-auto">
          <h3 className="text-sm font-display font-semibold text-text">Style</h3>

          {/* Font */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim">Font</label>
            <div className="relative">
              <button
                onClick={() => setFontOpen(!fontOpen)}
                className="w-full flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text hover:border-border-active transition-colors"
              >
                {style.font}
                <ChevronDown size={14} className="text-text-dim" />
              </button>
              {fontOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                  {FONTS.map((font) => (
                    <button
                      key={font}
                      onClick={() => { setStyle({ ...style, font }); setFontOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        style.font === font ? 'text-accent bg-accent-dim' : 'text-text-muted hover:bg-surface-hover'
                      }`}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim">Size</label>
            <div className="flex gap-1.5">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setStyle({ ...style, size })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    style.size === size
                      ? 'bg-accent-dim border border-accent text-accent'
                      : 'bg-surface border border-border text-text-muted hover:border-border-active'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim">Position</label>
            <div className="flex gap-1.5">
              {(['top', 'center', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setStyle({ ...style, position: pos })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    style.position === pos
                      ? 'bg-accent-dim border border-accent text-accent'
                      : 'bg-surface border border-border text-text-muted hover:border-border-active'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Animation */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim">Animation</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ANIMATIONS.map((anim) => (
                <button
                  key={anim.id}
                  onClick={() => setStyle({ ...style, animation: anim.id as CaptionStyle['animation'] })}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    style.animation === anim.id
                      ? 'bg-accent-dim border border-accent text-accent'
                      : 'bg-surface border border-border text-text-muted hover:border-border-active'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Background</span>
            <button
              onClick={() => setStyle({ ...style, background: !style.background })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                style.background ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  style.background ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim">Preview</label>
            <div className="aspect-video bg-surface-active rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="w-full h-full bg-gradient-to-b from-transparent via-transparent to-black/50" />
              <div
                className={`absolute px-3 py-1 rounded ${
                  style.background ? 'bg-black/70' : ''
                } ${
                  style.position === 'top' ? 'top-3' :
                  style.position === 'center' ? '' :
                  'bottom-3'
                }`}
                style={{ fontFamily: style.font }}
              >
                <span className={`text-white font-semibold ${
                  style.size === 'small' ? 'text-xs' :
                  style.size === 'large' ? 'text-base' :
                  'text-sm'
                }`}>
                  Sample caption text
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
