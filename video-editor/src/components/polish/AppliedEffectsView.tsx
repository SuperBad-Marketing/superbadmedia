import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  Eye,
  EyeOff,
  X,
  Undo2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve } from '../../lib/api'
import type { AppliedEffect } from '../../types'

type EffectCategory = 'visual' | 'colour' | 'audio' | 'sfx' | 'motion' | 'other'

const CATEGORY_LABELS: Record<EffectCategory, string> = {
  visual: 'Visual',
  colour: 'Colour',
  audio: 'Audio',
  sfx: 'SFX Layers',
  motion: 'Motion',
  other: 'Other',
}

const CATEGORY_ORDER: EffectCategory[] = ['visual', 'colour', 'motion', 'audio', 'sfx', 'other']

function categorize(ingredientId: string): EffectCategory {
  const visual = ['halation', 'lens-flare', 'god-rays', 'light-leak', 'light-wrap', 'bokeh', 'candlelight', 'stroboscope', 'film-grain', 'old-film', 'film-burn', 'vhs', 'super-8', 'scan-lines', 'halftone', 'polaroid', 'lens-blur', 'chromatic', 'barrel', 'anamorphic', 'prism', 'heat-haze', 'underwater', 'glitch', 'double-exposure', 'colour-channel', 'silhouette', 'edge-detection', 'posterise', 'mirror', 'infrared', 'dust', 'rain', 'snow', 'smoke', 'confetti', 'vignette', 'letterbox', 'aspect-ratio', 'split-screen']
  const colour = ['warm-shift', 'cool-shift', 'desaturation', 'saturation', 'teal-and-orange', 'cross-process', 'bleach-bypass', 'neon', 'noir', 'sepia', 'day-for-night', 'film-stock', 'colour-pop', 'colour-temperature', 'flash-to', 'high-contrast', 'crush-blacks', 'lifted-shadows']
  const motion = ['speed-ramp', 'slow-motion', 'fast-forward', 'freeze-frame', 'strobe-skip', 'reverse', 'camera-shake', 'handheld', 'dolly-zoom', 'smooth-push', 'smooth-pull', 'drift', 'breathing', 'snap-zoom', 'rotation', 'bounce']
  const audio = ['reverb', 'echo', 'muffled', 'tin-can', 'phone-call', 'pitch', 'audio-slow', 'audio-speed', 'vinyl-crackle', 'bit-crush', 'radio-tuning', 'ducking', 'volume-swell', 'hard-cut-silence']
  const sfx = ['heartbeat', 'clock-tick', 'bass-drop', 'whoosh', 'record-scratch', 'musical-sting', 'room-tone', 'crowd', 'rain-ambience', 'thunder', 'wind', 'fire', 'water', 'sonar', 'camera-shutter', 'glass-break', 'metal-clang', 'door-slam']

  const id = ingredientId.toLowerCase()
  if (visual.some(v => id.includes(v))) return 'visual'
  if (colour.some(c => id.includes(c))) return 'colour'
  if (motion.some(m => id.includes(m))) return 'motion'
  if (audio.some(a => id.includes(a))) return 'audio'
  if (sfx.some(s => id.includes(s))) return 'sfx'
  return 'other'
}

function formatIngredientName(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatParamValue(value: number | string): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value)
}

interface EffectRowProps {
  effect: AppliedEffect
  onBypass: (id: string, bypassed: boolean) => void
  onRemove: (id: string) => void
  isBusy: boolean
}

function EffectRow({ effect, onBypass, onRemove, isBusy }: EffectRowProps) {
  const [expanded, setExpanded] = useState(false)
  const params = Object.entries(effect.parameters).filter(
    ([k]) => !['clip_index', 'grade_params'].includes(k),
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: effect.bypassed ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover/50 transition-colors duration-150">
        <GripVertical size={10} className="text-text-dim opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab" />

        <button
          onClick={() => onBypass(effect.id, !effect.bypassed)}
          disabled={isBusy}
          className="shrink-0 transition-colors duration-150 disabled:opacity-30"
          title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
        >
          {effect.bypassed ? (
            <EyeOff size={12} className="text-text-dim" />
          ) : (
            <Eye size={12} className="text-accent" />
          )}
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-1.5 text-left min-w-0"
        >
          {expanded ? <ChevronDown size={10} className="text-text-dim shrink-0" /> : <ChevronRight size={10} className="text-text-dim shrink-0" />}
          <span className={`text-[11px] font-medium truncate ${effect.bypassed ? 'text-text-dim line-through' : 'text-text'}`}>
            {formatIngredientName(effect.ingredientId)}
          </span>
          <span className="text-[10px] text-text-dim font-mono shrink-0">
            {effect.variant}
          </span>
        </button>

        <button
          onClick={() => onRemove(effect.id)}
          disabled={isBusy}
          className="shrink-0 p-1 rounded text-text-dim hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 opacity-0 group-hover:opacity-100 disabled:opacity-30"
          title="Remove effect"
        >
          <X size={11} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && params.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-12 pr-3 pb-2">
              {params.map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-dim">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-[10px] text-text-muted font-mono">{formatParamValue(value)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function AppliedEffectsView() {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const appliedEffects = useAppStore((s) => s.appliedEffects)
  const removeAppliedEffect = useAppStore((s) => s.removeAppliedEffect)
  const updateAppliedEffect = useAppStore((s) => s.updateAppliedEffect)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const selectedClipIndex = useAppStore((s) => s.selectedClipIndex)
  const setSelectedClipIndex = useAppStore((s) => s.setSelectedClipIndex)
  const resolveConnected = useAppStore((s) => s.resolveConnected)

  const clipEffects = appliedEffects.filter(
    (e) => e.clipId === String(selectedClipIndex),
  )

  const grouped = CATEGORY_ORDER.reduce<Record<EffectCategory, AppliedEffect[]>>(
    (acc, cat) => {
      acc[cat] = clipEffects.filter((e) => categorize(e.ingredientId) === cat)
      return acc
    },
    {} as Record<EffectCategory, AppliedEffect[]>,
  )

  const activeGroups = CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0)
  const selectedClip = storyboardClips[selectedClipIndex]

  const toggleGroup = (cat: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleBypass = useCallback(async (effectId: string, bypassed: boolean) => {
    setBusy(true)
    try {
      if (resolveConnected) {
        await sendToResolve('bypass_effect', {
          clip_index: selectedClipIndex,
          effect_id: effectId,
          bypassed,
        })
      }
      updateAppliedEffect(effectId, { bypassed })
    } finally {
      setBusy(false)
    }
  }, [selectedClipIndex, resolveConnected, updateAppliedEffect])

  const handleRemove = useCallback(async (effectId: string) => {
    setBusy(true)
    try {
      const effect = appliedEffects.find((e) => e.id === effectId)
      if (resolveConnected) {
        await sendToResolve('remove_effect', {
          clip_index: selectedClipIndex,
          effect_id: effectId,
        })
      }
      removeAppliedEffect(effectId)
      if (effect) {
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Removed ${formatIngredientName(effect.ingredientId)} from clip ${selectedClipIndex + 1}.`,
          timestamp: new Date().toISOString(),
        })
      }
    } finally {
      setBusy(false)
    }
  }, [selectedClipIndex, resolveConnected, appliedEffects, removeAppliedEffect, addChatMessage])

  const handleUndoLast = useCallback(async () => {
    if (clipEffects.length === 0) return
    const latest = [...clipEffects].sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    )[0]
    await handleRemove(latest.id)
  }, [clipEffects, handleRemove])

  const handleUndoAll = useCallback(async () => {
    if (clipEffects.length === 0) return
    setBusy(true)
    try {
      for (const effect of clipEffects) {
        if (resolveConnected) {
          await sendToResolve('remove_effect', {
            clip_index: selectedClipIndex,
            effect_id: effect.id,
          })
        }
        removeAppliedEffect(effect.id)
      }
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Removed all effects from clip ${selectedClipIndex + 1}.`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setBusy(false)
    }
  }, [clipEffects, selectedClipIndex, resolveConnected, removeAppliedEffect, addChatMessage])

  const handleAddEffect = useCallback(() => {
    addChatMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Add an effect to clip ${selectedClipIndex + 1}`,
      timestamp: new Date().toISOString(),
    })
  }, [selectedClipIndex, addChatMessage])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Clip selector */}
      {storyboardClips.length > 0 && (
        <div className="shrink-0 px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[11px] font-medium text-text">Applied Effects</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {storyboardClips.map((clip, i) => {
              const count = appliedEffects.filter((e) => e.clipId === String(i)).length
              return (
                <button
                  key={clip.id}
                  onClick={() => setSelectedClipIndex(i)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-150 ${
                    i === selectedClipIndex
                      ? 'bg-accent-dim text-accent'
                      : 'bg-surface-active/40 text-text-dim hover:text-text-muted hover:bg-surface-active/60'
                  }`}
                >
                  <span className="truncate max-w-[80px]">
                    {clip.clip.fileName.replace(/\.[^.]+$/, '')}
                  </span>
                  {count > 0 && (
                    <span className={`flex items-center justify-center size-4 rounded-full text-[9px] font-bold ${
                      i === selectedClipIndex ? 'bg-accent/20 text-accent' : 'bg-surface-active text-text-dim'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Effects list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {clipEffects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="size-10 rounded-xl bg-surface-active/50 flex items-center justify-center">
              <Sparkles size={16} className="text-text-dim opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-[11px] text-text-muted font-medium">
                {selectedClip
                  ? `No effects on ${selectedClip.clip.fileName}`
                  : 'No clip selected'}
              </p>
              <p className="text-[10px] text-text-dim mt-1">
                Ask the chat to add effects, or use the button below
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {activeGroups.map((cat) => (
              <div key={cat}>
                <button
                  onClick={() => toggleGroup(cat)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                >
                  {collapsedGroups.has(cat) ? (
                    <ChevronRight size={10} className="text-text-dim" />
                  ) : (
                    <ChevronDown size={10} className="text-text-dim" />
                  )}
                  <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono">
                    {grouped[cat].length}
                  </span>
                </button>

                <AnimatePresence>
                  {!collapsedGroups.has(cat) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {grouped[cat]
                        .sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime())
                        .map((effect) => (
                          <EffectRow
                            key={effect.id}
                            effect={effect}
                            onBypass={handleBypass}
                            onRemove={handleRemove}
                            isBusy={busy}
                          />
                        ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 bg-surface-active/30 px-4 py-3 flex items-center gap-2">
        {clipEffects.length > 0 ? (
          <>
            <button
              onClick={handleUndoLast}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-border-active text-[10px] font-medium text-text-muted hover:text-text transition-all duration-150 disabled:opacity-30"
            >
              <Undo2 size={10} />
              Undo last
            </button>
            <button
              onClick={handleUndoAll}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-red-400/30 text-[10px] font-medium text-text-dim hover:text-red-400 transition-all duration-150 disabled:opacity-30"
            >
              <Trash2 size={10} />
              Clear all
            </button>
            <div className="flex-1" />
            <button
              onClick={handleAddEffect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-[10px] font-medium hover:bg-accent/20 transition-colors duration-150"
            >
              <Plus size={10} />
              Add effect
            </button>
          </>
        ) : (
          <>
            <div className="flex-1">
              <p className="text-[10px] text-text-dim">
                Effects applied via chat appear here. Bypass, remove, or undo per clip.
              </p>
            </div>
            <button
              onClick={handleAddEffect}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-[10px] font-medium hover:bg-accent/20 transition-colors duration-150"
            >
              <Plus size={10} />
              Add effect
            </button>
          </>
        )}
      </div>
    </div>
  )
}
