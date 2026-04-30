import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, Music, Clock, Monitor, Zap, ArrowRight, RotateCcw, Volume2, BookOpen, Check } from 'lucide-react'
import { ViewLoader, InlineLoader } from '../shared/LoadingPulse'
import { parseBrief, buildFromBrief, searchMusic, analyzeClipVision, getBriefSkills, autoSelectSkills } from '../../lib/api'
import type { BriefFields, AssembledResult, SkillSummary } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

const PLATFORMS = [
  { id: 'instagram-reel', label: 'IG Reel' },
  { id: 'youtube-short', label: 'YT Short' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'generic', label: 'Other' },
] as const

const PACING_OPTIONS = [
  { id: 'fast', label: 'Fast', desc: '~2s cuts' },
  { id: 'medium', label: 'Medium', desc: '~4s cuts' },
  { id: 'slow', label: 'Slow', desc: '~6s cuts' },
] as const

type Phase = 'braindump' | 'fields' | 'building' | 'done'

export default function BriefBuilder() {
  const setStoryboardClips = useAppStore((s) => s.setStoryboardClips)
  const setSelectedTrack = useAppStore((s) => s.setSelectedTrack)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)
  const clips = useAppStore((s) => s.clips)
  const updateClipAnalysis = useAppStore((s) => s.updateClipAnalysis)
  const setSfxPlacements = useAppStore((s) => s.setSfxPlacements)
  const setEditTransitions = useAppStore((s) => s.setEditTransitions)
  const selectedTrack = useAppStore((s) => s.selectedTrack)

  const [phase, setPhase] = useState<Phase>('braindump')
  const [braindump, setBraindump] = useState('')
  const [fields, setFields] = useState<BriefFields | null>(null)
  const [result, setResult] = useState<AssembledResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildStatus, setBuildStatus] = useState('')
  const [buildError, setBuildError] = useState<string | null>(null)
  const [availableSkills, setAvailableSkills] = useState<SkillSummary[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set())

  const unanalyzedCount = useMemo(
    () => clips.filter((c) => !c.analysis?.visionAnalyzed).length,
    [clips],
  )

  useEffect(() => {
    if (phase !== 'fields' || !fields) return
    let cancelled = false

    const loadSkills = async () => {
      try {
        const [skills, autoSelected] = await Promise.all([
          getBriefSkills(),
          autoSelectSkills(clips, fields),
        ])
        if (cancelled) return
        setAvailableSkills(skills.filter((s: SkillSummary) => s.llmReady))
        setSelectedSkillIds(new Set(autoSelected))
      } catch {}
    }
    loadSkills()

    return () => { cancelled = true }
  }, [phase, fields, clips])

  const handleParse = useCallback(async () => {
    if (!braindump.trim()) return
    setParsing(true)
    try {
      const parsed = await parseBrief(braindump)
      setFields(parsed)
      setPhase('fields')
    } catch {
      setFields({
        duration: 30,
        platform: 'instagram-reel',
        mood: 'cinematic',
        pacing: 'medium',
        musicKeywords: 'cinematic',
        narrativeNotes: braindump,
        clipSelectionHints: '',
      })
      setPhase('fields')
    } finally {
      setParsing(false)
    }
  }, [braindump])

  const handleBuild = useCallback(async () => {
    if (!fields) return
    setBuilding(true)
    setPhase('building')
    setBuildError(null)

    try {
      const unanalyzed = clips.filter((c) => !c.analysis?.visionAnalyzed)
      if (unanalyzed.length > 0) {
        setBuildStatus(`Watching your footage. 0 of ${unanalyzed.length}.`)
        for (let i = 0; i < unanalyzed.length; i++) {
          const clip = unanalyzed[i]
          setBuildStatus(`Watching your footage. ${i + 1} of ${unanalyzed.length}.`)
          try {
            const visionResult = await analyzeClipVision(clip.filePath, clip.id, clip.duration)
            updateClipAnalysis(clip.id, {
              description: visionResult.description,
              contentTags: [
                ...(clip.analysis?.contentTags || []),
                ...visionResult.contentTags.filter(
                  (t: string) => !(clip.analysis?.contentTags || []).includes(t),
                ),
              ],
              hasFaces: visionResult.hasFaces,
              faceCount: visionResult.faceCount,
              hasSmiles: visionResult.hasSmiles,
              hasAction: visionResult.hasAction,
              bestMomentTimestamps: visionResult.bestMomentTimestamps,
              sceneType: visionResult.sceneType,
              dominantColors: visionResult.dominantColors,
              composition: visionResult.composition,
              emotionalTone: visionResult.emotionalTone,
              shotType: visionResult.shotType as any,
              cameraMovement: visionResult.cameraMovement as any,
              humanContent: visionResult.humanContent as any,
              activityType: visionResult.activityType as any,
              environment: visionResult.environment as any,
              lighting: visionResult.lighting as any,
              editUtility: visionResult.editUtility as any,
              rankedMoments: visionResult.rankedMoments,
              visionAnalyzed: true,
            })
          } catch {
            updateClipAnalysis(clip.id, { visionAnalyzed: true })
          }
        }
      }

      setBuildStatus('Finding the right music.')
      const tracks = await searchMusic(fields.musicKeywords, {
        mood: fields.mood,
        pacing: fields.pacing,
        intensity: fields.moodAxes?.intensity,
      })
      const topTrack = tracks[0] || null
      if (topTrack) setSelectedTrack(topTrack)

      const musicInfo = topTrack || selectedTrack
      setBuildStatus('Building your edit.')
      const latestClips = useAppStore.getState().clips
      const assembled = await buildFromBrief(
        { ...fields, selectedSkillIds: [...selectedSkillIds] },
        latestClips,
        musicInfo ? { musicBpm: musicInfo.bpm, musicMood: musicInfo.mood, musicPreviewUrl: musicInfo.previewUrl, musicDuration: musicInfo.duration } : undefined,
      )
      setResult(assembled)

      if (assembled.storyboardClips.length > 0) {
        const storyboard = assembled.storyboardClips.map((sc) => {
          const thumbFile = sc.thumbnailPath ? sc.thumbnailPath.split('/').pop() : undefined
          return {
            id: sc.id,
            clipId: sc.clipId,
            clip: {
              id: sc.clipId,
              projectId: '',
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
          }
        })
        setStoryboardClips(storyboard)
      }

      if (assembled.sfxPlacements?.length > 0) setSfxPlacements(assembled.sfxPlacements)
      if (assembled.transitions?.length > 0) setEditTransitions(assembled.transitions)

      setPhase('done')
    } catch {
      setBuildStatus('')
      setBuildError('Something went wrong. Try again.')
      setTimeout(() => setPhase('fields'), 2000)
    } finally {
      setBuilding(false)
    }
  }, [fields, clips, selectedTrack, selectedSkillIds, setStoryboardClips, setSelectedTrack, setSfxPlacements, setEditTransitions, updateClipAnalysis])

  const handleReset = () => {
    setPhase('braindump')
    setBraindump('')
    setFields(null)
    setResult(null)
    setBuildStatus('')
    setBuildError(null)
  }

  const updateField = <K extends keyof BriefFields>(key: K, value: BriefFields[K]) => {
    if (!fields) return
    setFields({ ...fields, [key]: value })
  }

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev => {
      const next = new Set(prev)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 select-none">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-text-muted text-sm">Import footage first.</p>
          <p className="text-text-dim text-xs mt-1">
            Once your clips are in, come back here.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AnimatePresence mode="wait">
        {/* Phase 1: Braindump — the creative starting point */}
        {phase === 'braindump' && (
          <motion.div
            key="braindump"
            className="flex-1 flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-full max-w-lg">
              <h1 className="font-display font-bold text-xl tracking-tight text-text text-center mb-2">
                What are we making?
              </h1>
              <p className="text-text-dim text-xs text-center mb-8">
                {clips.length} clips ready. Describe the edit you want.
              </p>

              <textarea
                value={braindump}
                onChange={(e) => setBraindump(e.target.value)}
                placeholder="e.g. Pumping venue showcase for Instagram. Fast cuts mixed with cinematic holds. Electronic music. Start wide, then interior details, then crowd energy."
                rows={5}
                autoFocus
                className="w-full bg-surface/60 rounded-xl text-sm text-text placeholder:text-text-dim/50 px-5 py-4 resize-none focus:outline-none transition-shadow duration-300 leading-relaxed input-glow border border-border focus:border-border-active"
              />

              <div className="flex justify-center mt-6">
                <button
                  onClick={handleParse}
                  disabled={!braindump.trim() || parsing}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-5 py-2.5 font-semibold text-xs text-white transition-colors duration-200 disabled:opacity-40 cursor-pointer"
                >
                  {parsing ? (
                    <>
                      <InlineLoader />
                      Reading your mind...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Go
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Phase 2: Editable summary — refine the AI's interpretation */}
        {phase === 'fields' && fields && (
          <motion.div
            key="fields"
            className="flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-w-lg mx-auto px-8 py-12">
              {/* Summary sentence */}
              <div className="mb-10">
                <p className="text-sm text-text leading-relaxed">
                  A{' '}
                  <InlineEdit
                    value={String(fields.duration)}
                    onChange={(v) => updateField('duration', Number(v))}
                    width="w-10"
                    mono
                  />
                  s{' '}
                  <InlineSelect
                    value={fields.platform}
                    options={PLATFORMS.map(p => ({ value: p.id, label: p.label }))}
                    onChange={(v) => updateField('platform', v)}
                  />
                  {', '}
                  <InlineEdit
                    value={fields.mood}
                    onChange={(v) => updateField('mood', v)}
                    width="w-24"
                  />
                  {' mood, '}
                  <InlineSelect
                    value={fields.pacing}
                    options={PACING_OPTIONS.map(p => ({ value: p.id, label: p.label.toLowerCase() }))}
                    onChange={(v) => updateField('pacing', v as BriefFields['pacing'])}
                  />
                  {' pacing. Music like '}
                  <InlineEdit
                    value={fields.musicKeywords}
                    onChange={(v) => updateField('musicKeywords', v)}
                    width="w-36"
                  />
                  .
                </p>
              </div>

              {/* Narrative notes */}
              <div className="space-y-2 mb-6">
                <label className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase">
                  Direction
                </label>
                <textarea
                  value={fields.narrativeNotes}
                  onChange={(e) => updateField('narrativeNotes', e.target.value)}
                  rows={3}
                  className="w-full bg-surface/40 rounded-lg px-4 py-3 text-xs text-text resize-none focus:outline-none focus:ring-1 focus:ring-border-active border border-border leading-relaxed"
                />
              </div>

              {/* Clip preferences */}
              {fields.clipSelectionHints && (
                <div className="space-y-2 mb-6">
                  <label className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase">
                    Clip preferences
                  </label>
                  <textarea
                    value={fields.clipSelectionHints}
                    onChange={(e) => updateField('clipSelectionHints', e.target.value)}
                    rows={2}
                    className="w-full bg-surface/40 rounded-lg px-4 py-3 text-xs text-text resize-none focus:outline-none focus:ring-1 focus:ring-border-active border border-border leading-relaxed"
                  />
                </div>
              )}

              {/* Skills */}
              {availableSkills.length > 0 && (
                <div className="mb-8">
                  <label className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase mb-2 block">
                    Editorial knowledge
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSkills.map((skill) => {
                      const isSelected = selectedSkillIds.has(skill.id)
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => toggleSkill(skill.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'bg-accent/15 text-accent border border-accent/20'
                              : 'bg-surface-active/30 text-text-dim hover:text-text-muted border border-transparent'
                          }`}
                        >
                          {isSelected && <Check size={9} />}
                          {skill.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Unanalyzed note */}
              {unanalyzedCount > 0 && (
                <p className="text-[10px] text-text-dim mb-6">
                  {unanalyzedCount} clips haven't been analyzed yet. That'll happen automatically.
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPhase('braindump')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-200 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Redo
                </button>
                <button
                  onClick={handleBuild}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-5 py-2.5 font-semibold text-xs text-white transition-colors duration-200 cursor-pointer"
                >
                  <Sparkles size={14} />
                  Build it
                </button>
              </div>

              {buildError && (
                <p className="text-[10px] text-accent mt-3">{buildError}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Phase 3: Building — calm, centred progress */}
        {phase === 'building' && (
          <motion.div
            key="building"
            className="flex-1 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ViewLoader message={buildStatus} />
          </motion.div>
        )}

        {/* Phase 4: Done — show summary, navigate to assemble */}
        {phase === 'done' && result && (
          <motion.div
            key="done"
            className="flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-w-lg mx-auto px-8 py-12">
              <h2 className="font-display font-bold text-lg tracking-tight text-text mb-2">
                Ready.
              </h2>
              <p className="text-xs text-text-muted leading-relaxed mb-8">
                {result.narrative}
              </p>

              {/* Compact clip summary */}
              <div className="space-y-1 mb-6">
                {result.storyboardClips.slice(0, 8).map((sc, i) => (
                  <div key={sc.id} className="flex items-center gap-3 py-1.5">
                    <span className="text-[10px] font-mono text-text-dim tabular-nums w-4 text-right">{i + 1}</span>
                    <div className="size-7 rounded bg-surface-active overflow-hidden shrink-0">
                      {sc.thumbnailPath && (
                        <img
                          src={`/thumbnails/${sc.thumbnailPath.split('/').pop()}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted flex-1 truncate">{sc.reason}</span>
                    <span className="text-[10px] font-mono text-text-dim tabular-nums">
                      {(sc.endTime - sc.startTime).toFixed(1)}s
                    </span>
                  </div>
                ))}
                {result.storyboardClips.length > 8 && (
                  <p className="text-[10px] text-text-dim pl-7">
                    +{result.storyboardClips.length - 8} more clips
                  </p>
                )}
              </div>

              {/* Stats line */}
              <div className="flex items-center gap-4 text-[10px] text-text-dim mb-8">
                <span>{result.storyboardClips.length} clips</span>
                <span>·</span>
                <span>{Math.round(result.totalDuration)}s total</span>
                {result.sfxPlacements?.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{result.sfxPlacements.length} SFX layers</span>
                  </>
                )}
                {result.transitions?.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{result.transitions.length} transitions</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-200 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Start over
                </button>
                <button
                  onClick={() => setWorkflowPhase('assemble')}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-5 py-2.5 font-semibold text-xs text-white transition-colors duration-200 cursor-pointer"
                >
                  View storyboard
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* Inline editable value — appears as bold text, clicks to edit */
function InlineEdit({
  value,
  onChange,
  width = 'w-20',
  mono = false,
}: {
  value: string
  onChange: (v: string) => void
  width?: string
  mono?: boolean
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        className={`inline-block ${width} bg-surface-active/60 rounded px-1.5 py-0.5 text-sm text-text font-semibold focus:outline-none focus:ring-1 focus:ring-accent/40 ${mono ? 'font-mono tabular-nums' : ''}`}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`inline font-semibold text-text border-b border-dashed border-text-dim/30 hover:border-accent/50 transition-colors duration-200 cursor-pointer ${mono ? 'font-mono tabular-nums' : ''}`}
    >
      {value}
    </button>
  )
}

/* Inline select — appears as bold text, clicks to cycle */
function InlineSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const currentLabel = options.find(o => o.value === value)?.label || value

  function cycle() {
    const idx = options.findIndex(o => o.value === value)
    const next = options[(idx + 1) % options.length]
    onChange(next.value)
  }

  return (
    <button
      onClick={cycle}
      className="inline font-semibold text-text border-b border-dashed border-text-dim/30 hover:border-accent/50 transition-colors duration-200 cursor-pointer"
      title="Click to change"
    >
      {currentLabel}
    </button>
  )
}
