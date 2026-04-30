import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
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
  const [transcriptionMethod, setTranscriptionMethod] = useState<string | null>(null)
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
        setTranscriptionMethod(data.method || null)
      }
    } catch {
      setCaptions([])
      setTranscriptionMethod(null)
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
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="size-16 rounded-2xl bg-surface-active/40 flex items-center justify-center mb-8">
            <Type size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Captions
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            Build your timeline first, then generate captions from audio.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        {/* Caption list */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-5 shrink-0">
            <div>
              <h2 className="font-display font-bold text-sm tracking-tight text-text">
                Captions {captions.length > 0 && <span className="font-mono text-[10px] text-text-dim tabular-nums">({captions.length})</span>}
              </h2>
              {transcriptionMethod && (
                <span className={`text-[10px] font-mono ${transcriptionMethod === 'whisper' ? 'text-green' : transcriptionMethod === 'silence-detection' ? 'text-amber' : 'text-text-dim'}`}>
                  {transcriptionMethod === 'whisper' ? 'Transcribed with Whisper' : transcriptionMethod === 'silence-detection' ? 'Speech segments detected' : 'Placeholder — install Whisper for real transcription'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={addCaption}
                className="flex items-center gap-1 text-[11px] text-text-dim hover:text-text-muted rounded-lg hover:bg-surface-hover px-2 py-1 transition-colors duration-150"
              >
                <Plus size={11} />
                Add
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 bg-accent rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-50"
              >
                {generating && <Loader2 size={12} className="animate-spin" />}
                {generating ? 'Generating...' : captions.length > 0 ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 scrollbar-none">
            {captions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2.5">
                <Type size={20} className="text-text-dim opacity-40" />
                <p className="text-[11px] text-text-dim">Click Generate to create captions from audio</p>
              </div>
            ) : (
              captions.map((caption, i) => (
                <div
                  key={caption.id}
                  className={`rounded-xl p-4 space-y-3 transition-colors duration-150 ${
                    editingId === caption.id ? 'bg-surface-active' : 'bg-surface hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-dim font-mono tabular-nums">
                      #{i + 1} &middot; {formatTime(caption.startTime)} &rarr; {formatTime(caption.endTime)}
                    </span>
                    <button
                      onClick={() => removeCaption(caption.id)}
                      aria-label="Remove caption"
                      className="text-text-dim hover:text-accent rounded-lg hover:bg-surface-hover p-1 transition-colors duration-150"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  <textarea
                    value={caption.text}
                    onChange={(e) => updateCaption(caption.id, { text: e.target.value })}
                    onFocus={() => setEditingId(caption.id)}
                    onBlur={() => setEditingId(null)}
                    rows={2}
                    className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-sm text-text resize-none focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
                    placeholder="Caption text..."
                  />

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-text-dim font-mono">In</label>
                      <input
                        type="number"
                        value={caption.startTime}
                        onChange={(e) => updateCaption(caption.id, { startTime: Number(e.target.value) })}
                        step={0.1}
                        className="w-16 bg-surface-active/50 rounded-lg px-2 py-1 text-[10px] text-text font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-text-dim font-mono">Out</label>
                      <input
                        type="number"
                        value={caption.endTime}
                        onChange={(e) => updateCaption(caption.id, { endTime: Number(e.target.value) })}
                        step={0.1}
                        className="w-16 bg-surface-active/50 rounded-lg px-2 py-1 text-[10px] text-text font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Style panel */}
        <div className="w-72 shrink-0 bg-surface/50 p-6 space-y-6 overflow-y-auto scrollbar-none">
          <h3 className="font-display font-bold text-sm tracking-tight text-text">Style</h3>

          {/* Font */}
          <div className="space-y-2">
            <label className="text-[11px] text-text-dim">Font</label>
            <div className="relative">
              <button
                onClick={() => setFontOpen(!fontOpen)}
                className="w-full flex items-center justify-between bg-surface-active/50 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors duration-150"
              >
                {style.font}
                <ChevronDown size={13} className="text-text-dim" />
              </button>
              {fontOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-surface-raised rounded-xl shadow-xl shadow-black/30 z-10 max-h-[200px] overflow-y-auto py-1">
                  {FONTS.map((font) => (
                    <button
                      key={font}
                      onClick={() => { setStyle({ ...style, font }); setFontOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
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
          <div className="space-y-2">
            <label className="text-[11px] text-text-dim">Size</label>
            <div className="segmented-control w-full">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setStyle({ ...style, size })}
                  data-active={style.size === size}
                  className="flex-1 capitalize"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <label className="text-[11px] text-text-dim">Position</label>
            <div className="segmented-control w-full">
              {(['top', 'center', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setStyle({ ...style, position: pos })}
                  data-active={style.position === pos}
                  className="flex-1 capitalize"
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Animation */}
          <div className="space-y-2">
            <label className="text-[11px] text-text-dim">Animation</label>
            <div className="segmented-control w-full flex-wrap">
              {ANIMATIONS.map((anim) => (
                <button
                  key={anim.id}
                  onClick={() => setStyle({ ...style, animation: anim.id as CaptionStyle['animation'] })}
                  data-active={style.animation === anim.id}
                  className="flex-1"
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-text-dim">Background</span>
            <button
              onClick={() => setStyle({ ...style, background: !style.background })}
              className={`relative w-10 h-5 rounded-full transition-colors duration-150 ${
                style.background ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  style.background ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <label className="text-[11px] text-text-dim">Preview</label>
            <div className="aspect-video bg-bg rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="w-full h-full bg-gradient-to-b from-transparent via-transparent to-black/50" />
              <div
                className={`absolute px-3 py-1.5 rounded-lg ${
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
