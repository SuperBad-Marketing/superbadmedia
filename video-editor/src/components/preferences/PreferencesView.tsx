import { useState, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  ArrowRight,
  Sparkles,
  Loader2,
  Move,
  Zap,
  Shield,
  Palette,
  Layers,
  Volume2,
  Music,
  Type,
  Film,
  SkipForward,
} from 'lucide-react'
import { ViewLoader } from '../shared/LoadingPulse'
import { useAppStore } from '../../stores/appStore'
import { recommendPreferences, buildFromBrief } from '../../lib/api'
import { DEFAULT_PREFERENCES } from '../../lib/editPreferences'
import type { EditPreferences } from '../../types'

type Capability = keyof Omit<EditPreferences, 'source' | 'presetName'>

interface CapabilityCard {
  key: Capability
  label: string
  description: string
  icon: typeof Move
  settings: SettingDef[]
}

type SettingDef =
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[] }
  | { type: 'toggle-group'; key: string; label: string; options: { value: string; label: string }[] }
  | { type: 'multi-select'; key: string; label: string; options: { value: string; label: string }[] }

const CAPABILITIES: CapabilityCard[] = [
  {
    key: 'zoom',
    label: 'Ken Burns / Dynamic Zoom',
    description: 'Slow push-ins and pull-outs on static shots. Adds life to locked-off footage.',
    icon: Move,
    settings: [
      { type: 'select', key: 'intensity', label: 'Intensity', options: [
        { value: 'subtle', label: 'Subtle' },
        { value: 'standard', label: 'Standard' },
        { value: 'dramatic', label: 'Dramatic' },
      ]},
      { type: 'select', key: 'frequency', label: 'How often', options: [
        { value: 'few', label: 'A few (~15%)' },
        { value: 'some', label: 'Some (~30%)' },
        { value: 'many', label: 'Many (~50%)' },
      ]},
    ],
  },
  {
    key: 'slowMo',
    label: 'Slow Motion',
    description: 'Auto-detects peak moments and slows them down using Resolve optical flow.',
    icon: Zap,
    settings: [
      { type: 'select', key: 'speed', label: 'Speed', options: [
        { value: '75', label: '75% (gentle)' },
        { value: '50', label: '50% (half speed)' },
        { value: '25', label: '25% (dramatic)' },
      ]},
    ],
  },
  {
    key: 'stabilisation',
    label: 'Stabilisation',
    description: 'Smooths out handheld shake using Resolve\'s built-in stabiliser.',
    icon: Shield,
    settings: [
      { type: 'select', key: 'mode', label: 'Mode', options: [
        { value: 'perspective', label: 'Perspective (best)' },
        { value: 'translation', label: 'Translation (lighter)' },
      ]},
      { type: 'select', key: 'applyTo', label: 'Apply to', options: [
        { value: 'shaky-only', label: 'Shaky clips only' },
        { value: 'all', label: 'All clips' },
      ]},
    ],
  },
  {
    key: 'grading',
    label: 'Colour Grading',
    description: 'Auto-grades the timeline for a consistent look via Resolve\'s colour page.',
    icon: Palette,
    settings: [
      { type: 'select', key: 'look', label: 'Look', options: [
        { value: 'natural', label: 'Natural' },
        { value: 'warm', label: 'Warm' },
        { value: 'cool', label: 'Cool' },
        { value: 'punchy', label: 'Punchy' },
        { value: 'cinematic', label: 'Cinematic' },
      ]},
      { type: 'select', key: 'consistency', label: 'Camera match', options: [
        { value: 'match-cameras', label: 'Match all cameras' },
        { value: 'embrace-mix', label: 'Embrace the variety' },
      ]},
    ],
  },
  {
    key: 'transitions',
    label: 'Transitions',
    description: 'What happens between clips. From clean cuts to energetic whip pans.',
    icon: Layers,
    settings: [
      { type: 'select', key: 'style', label: 'Style', options: [
        { value: 'cuts-only', label: 'Hard cuts only' },
        { value: 'subtle', label: 'Subtle (dissolves)' },
        { value: 'dynamic', label: 'Dynamic (mixed)' },
        { value: 'energetic', label: 'Energetic (whips, zooms)' },
      ]},
      { type: 'select', key: 'density', label: 'How many', options: [
        { value: 'sparse', label: 'Sparse (key moments)' },
        { value: 'moderate', label: 'Moderate' },
        { value: 'frequent', label: 'Frequent' },
      ]},
    ],
  },
  {
    key: 'sfx',
    label: 'Sound Effects',
    description: 'Layered SFX from Epidemic Sound — whooshes, impacts, risers.',
    icon: Volume2,
    settings: [
      { type: 'select', key: 'density', label: 'Density', options: [
        { value: 'minimal', label: 'Minimal (accents only)' },
        { value: 'accent', label: 'Accent (key moments)' },
        { value: 'layered', label: 'Layered (full design)' },
      ]},
      { type: 'multi-select', key: 'categories', label: 'Categories', options: [
        { value: 'impact', label: 'Impact' },
        { value: 'whoosh', label: 'Whoosh' },
        { value: 'riser', label: 'Riser' },
        { value: 'ambient', label: 'Ambient' },
        { value: 'foley', label: 'Foley' },
      ]},
    ],
  },
  {
    key: 'musicSync',
    label: 'Music Sync',
    description: 'How tightly cuts align to the beat grid.',
    icon: Music,
    settings: [
      { type: 'select', key: 'tightness', label: 'Tightness', options: [
        { value: 'loose', label: 'Loose (content first)' },
        { value: 'on-beat', label: 'On-beat (balanced)' },
        { value: 'tight', label: 'Tight (every cut on beat)' },
      ]},
    ],
  },
  {
    key: 'titles',
    label: 'Titles & Text',
    description: 'Title cards, lower thirds, location supers — built as Fusion comps.',
    icon: Type,
    settings: [
      { type: 'select', key: 'usage', label: 'Usage', options: [
        { value: 'none', label: 'None' },
        { value: 'minimal', label: 'Minimal (open + close)' },
        { value: 'throughout', label: 'Throughout' },
      ]},
    ],
  },
  {
    key: 'motionGraphics',
    label: 'Motion Graphics',
    description: 'Kinetic text, CTAs, animated counters, social handle bugs.',
    icon: Film,
    settings: [],
  },
]

function CapToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${enabled ? 'bg-accent' : 'bg-surface-active'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`}
      />
    </button>
  )
}

function SettingControl({
  setting,
  value,
  onChange,
  disabled,
}: {
  setting: SettingDef
  value: any
  onChange: (key: string, val: any) => void
  disabled: boolean
}) {
  if (setting.type === 'select' || setting.type === 'toggle-group') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-text-dim uppercase tracking-wider">{setting.label}</span>
        <div className="flex flex-wrap gap-1">
          {setting.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => !disabled && onChange(setting.key, setting.key === 'speed' ? parseInt(opt.value) : opt.value)}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                String(value) === opt.value
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-surface-hover text-text-muted hover:text-text border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (setting.type === 'multi-select') {
    const selected = (value || []) as string[]
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-text-dim uppercase tracking-wider">{setting.label}</span>
        <div className="flex flex-wrap gap-1">
          {setting.options.map(opt => {
            const isOn = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (disabled) return
                  const next = isOn ? selected.filter(v => v !== opt.value) : [...selected, opt.value]
                  onChange(setting.key, next)
                }}
                disabled={disabled}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isOn
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'bg-surface-hover text-text-muted hover:text-text border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}

export default function PreferencesView() {
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const setEditPreferences = useAppStore((s) => s.setEditPreferences)
  const setStoryboardClips = useAppStore((s) => s.setStoryboardClips)
  const setLastAssemblyId = useAppStore((s) => s.setLastAssemblyId)
  const setSfxPlacements = useAppStore((s) => s.setSfxPlacements)
  const setEditTransitions = useAppStore((s) => s.setEditTransitions)
  const existingPrefs = useAppStore((s) => s.editPreferences)
  const lastBriefFields = useAppStore((s) => s.lastBriefFields)
  const clips = useAppStore((s) => s.clips)
  const selectedTrack = useAppStore((s) => s.selectedTrack)

  const [prefs, setPrefs] = useState<EditPreferences>(existingPrefs || DEFAULT_PREFERENCES)
  const [recommending, setRecommending] = useState(false)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildStatus, setBuildStatus] = useState('')
  const [buildError, setBuildError] = useState<string | null>(null)

  const updateCapability = useCallback((cap: Capability, key: string, value: any) => {
    setPrefs(prev => ({
      ...prev,
      [cap]: { ...(prev[cap] as any), [key]: value },
      source: 'manual' as const,
    }))
    setReasoning(null)
  }, [])

  const toggleCapability = useCallback((cap: Capability, enabled: boolean) => {
    setPrefs(prev => ({
      ...prev,
      [cap]: { ...(prev[cap] as any), enabled },
      source: 'manual' as const,
    }))
    setReasoning(null)
  }, [])

  const handleAutoRecommend = useCallback(async () => {
    if (!lastBriefFields) return
    setRecommending(true)
    try {
      const result = await recommendPreferences(lastBriefFields, clips)
      if (result.preferences) {
        setPrefs({ ...result.preferences, source: 'auto-recommended' })
        setReasoning(result.reasoning || null)
      }
    } catch {
      setReasoning('Could not get recommendations. Using defaults.')
    } finally {
      setRecommending(false)
    }
  }, [lastBriefFields, clips])

  const triggerAssembly = useCallback(async (usePrefs: EditPreferences) => {
    if (!lastBriefFields) return
    setEditPreferences(usePrefs)
    setBuilding(true)
    setBuildStatus('Building your edit.')
    setBuildError(null)

    try {
      const musicInfo = selectedTrack
      const latestClips = useAppStore.getState().clips
      const currentProjectId = useAppStore.getState().currentProject?.id

      const selectedClientId = useAppStore.getState().selectedClientId
      const selectedEditStyleId = useAppStore.getState().selectedEditStyleId
      const assembled = await buildFromBrief(
        lastBriefFields,
        latestClips,
        musicInfo ? { musicBpm: musicInfo.bpm, musicMood: musicInfo.mood, musicPreviewUrl: musicInfo.previewUrl, musicDuration: musicInfo.duration } : undefined,
        currentProjectId,
        usePrefs,
        selectedClientId || undefined,
        selectedEditStyleId || undefined,
      )

      if (assembled.assemblyId) setLastAssemblyId(assembled.assemblyId)

      if (assembled.storyboardClips.length > 0) {
        const storyboard = assembled.storyboardClips.map((sc) => {
          const thumbFile = sc.thumbnailPath ? sc.thumbnailPath.split('/').pop() : undefined
          const existingClip = latestClips.find(c => c.id === sc.clipId)
          return {
            id: sc.id,
            clipId: sc.clipId,
            clip: existingClip || {
              id: sc.clipId,
              projectId: currentProjectId || '',
              filePath: sc.filePath,
              fileName: sc.fileName,
              thumbnailPath: thumbFile ? `/thumbnails/${thumbFile}` : undefined,
              duration: sc.duration,
              width: sc.width,
              height: sc.height,
              fps: sc.fps,
              codec: sc.codec,
              isLog: false,
            },
            startTime: sc.startTime,
            endTime: sc.endTime,
            position: sc.position,
            audioOffset: sc.audioOffset || 0,
          }
        })
        setStoryboardClips(storyboard)
      }

      if (assembled.sfxPlacements?.length > 0) setSfxPlacements(assembled.sfxPlacements)
      if (assembled.transitions?.length > 0) setEditTransitions(assembled.transitions)

      setWorkflowPhase('assemble')
    } catch (err: any) {
      setBuildStatus('')
      const msg = err?.message || 'Something went wrong.'
      setBuildError(msg.includes('Failed to') ? 'The server couldn\'t build the edit. Check the backend logs.' : msg)
    } finally {
      setBuilding(false)
    }
  }, [lastBriefFields, selectedTrack, setEditPreferences, setStoryboardClips, setLastAssemblyId, setSfxPlacements, setEditTransitions, setWorkflowPhase])

  const handleConfirmAndBuild = useCallback(() => {
    triggerAssembly(prefs)
  }, [prefs, triggerAssembly])

  const handleSkip = useCallback(() => {
    triggerAssembly({ ...DEFAULT_PREFERENCES, source: 'auto-recommended' })
  }, [triggerAssembly])

  useEffect(() => {
    if (!existingPrefs && lastBriefFields) {
      handleAutoRecommend()
    }
  }, [])

  if (building) {
    return (
      <motion.div
        className="flex-1 flex flex-col items-center justify-center"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <ViewLoader message={buildStatus} />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="flex-1 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-text mb-1">
              Edit preferences
            </h1>
            <p className="text-xs text-text-muted leading-relaxed max-w-md">
              Choose which tools SuperEdits uses and how aggressively. Everything here runs automatically after assembly.
            </p>
          </div>
          <button
            onClick={handleAutoRecommend}
            disabled={recommending || !lastBriefFields}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-accent hover:bg-accent/10 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {recommending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {recommending ? 'Thinking...' : 'Auto-recommend'}
          </button>
        </div>

        {reasoning && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 mb-6"
          >
            <p className="text-[11px] text-text-muted leading-relaxed">
              <span className="font-semibold text-accent">AI recommendation:</span>{' '}
              {reasoning}
            </p>
          </motion.div>
        )}

        {buildError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3 mb-6"
          >
            <p className="text-[11px] text-red-400 leading-relaxed">{buildError}</p>
          </motion.div>
        )}

        <div className="space-y-3">
          {CAPABILITIES.map((cap) => {
            const capPrefs = prefs[cap.key] as Record<string, any>
            const enabled = capPrefs?.enabled ?? true
            const Icon = cap.icon

            return (
              <motion.div
                key={cap.key}
                layout
                className={`rounded-xl border transition-colors duration-200 ${
                  enabled ? 'border-border bg-surface' : 'border-border/50 bg-surface/50'
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon size={16} className={enabled ? 'text-text' : 'text-text-dim'} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-semibold ${enabled ? 'text-text' : 'text-text-dim'}`}>
                      {cap.label}
                    </h3>
                    <p className="text-[10px] text-text-dim leading-relaxed truncate">
                      {cap.description}
                    </p>
                  </div>
                  <CapToggle enabled={enabled} onChange={(v) => toggleCapability(cap.key, v)} />
                </div>

                {enabled && cap.settings.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-3 pt-1 border-t border-border/50"
                  >
                    <div className="flex flex-wrap gap-4">
                      {cap.settings.map(setting => (
                        <SettingControl
                          key={setting.key}
                          setting={setting}
                          value={capPrefs[setting.key]}
                          onChange={(key, val) => updateCapability(cap.key, key, val)}
                          disabled={!enabled}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
          <button
            onClick={handleSkip}
            disabled={building}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-200 cursor-pointer disabled:opacity-30"
          >
            <SkipForward size={12} />
            Skip — use defaults
          </button>
          <button
            onClick={handleConfirmAndBuild}
            disabled={building}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-5 py-2.5 font-semibold text-xs text-white transition-colors duration-200 cursor-pointer disabled:opacity-70"
          >
            Build edit
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
