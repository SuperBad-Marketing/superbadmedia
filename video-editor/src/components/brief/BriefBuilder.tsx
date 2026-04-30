import { useState, useCallback } from 'react'
import { Sparkles, Music, Clock, Monitor, Zap, FileText, ArrowRight, RotateCcw } from 'lucide-react'
import ProgressRing from '../shared/ProgressRing'
import { parseBrief, buildFromBrief, searchMusic } from '../../lib/api'
import type { BriefFields, AssembledResult } from '../../lib/api'
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
  const setCentreView = useAppStore((s) => s.setCentreView)
  const clips = useAppStore((s) => s.clips)

  const [phase, setPhase] = useState<Phase>('braindump')
  const [braindump, setBraindump] = useState('')
  const [fields, setFields] = useState<BriefFields | null>(null)
  const [result, setResult] = useState<AssembledResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildStatus, setBuildStatus] = useState('')
  const [buildError, setBuildError] = useState<string | null>(null)

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
      setBuildStatus('Searching for music...')
      const tracks = await searchMusic(fields.musicKeywords)
      const topTrack = tracks[0] || null
      if (topTrack) {
        setSelectedTrack(topTrack)
      }

      setBuildStatus('Selecting clips and building storyboard...')
      const assembled = await buildFromBrief(fields)
      setResult(assembled)

      if (assembled.storyboardClips.length > 0) {
        const storyboard = assembled.storyboardClips.map((sc) => ({
          id: sc.id,
          clipId: sc.clipId,
          clip: {
            id: sc.clipId,
            projectId: '',
            filePath: sc.filePath,
            fileName: sc.fileName,
            thumbnailPath: sc.thumbnailPath,
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
        }))
        setStoryboardClips(storyboard)
      }

      setPhase('done')
    } catch {
      setBuildStatus('')
      setBuildError('Something went wrong. Try again.')
      setTimeout(() => setPhase('fields'), 2000)
    } finally {
      setBuilding(false)
    }
  }, [fields, setStoryboardClips, setSelectedTrack])

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

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="size-20 rounded-2xl bg-surface-active/50 flex items-center justify-center">
          <FileText size={32} className="text-text-dim" />
        </div>
        <h2 className="font-display text-sm font-semibold text-text">Brief Builder</h2>
        <p className="text-[11px] text-text-dim text-center text-pretty max-w-xs leading-relaxed">
          Import footage first. Once your clips are analysed, come back here to build a rough cut from a brief.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-12 space-y-10">

          {/* Phase 1: Braindump */}
          {phase === 'braindump' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="font-display font-semibold text-sm text-text">What are we making?</h2>
                <p className="text-[11px] text-text-dim leading-relaxed">
                  Dump everything in your head. Platform, mood, what shots you want, pacing, vibe, whatever. I'll sort it out.
                </p>
              </div>

              <textarea
                value={braindump}
                onChange={(e) => setBraindump(e.target.value)}
                placeholder="e.g. Pumping venue showcase for Instagram. Fast cuts, electronic music. Start with the exterior wide shots, then interior details, then the crowd. 30 seconds. High energy, make it look premium."
                rows={6}
                className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-border-active transition-colors leading-relaxed"
              />

              <button
                onClick={handleParse}
                disabled={!braindump.trim() || parsing}
                className="flex items-center gap-2.5 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 font-semibold text-xs text-white transition-colors duration-150 disabled:opacity-40"
              >
                {parsing ? <ProgressRing size={14} strokeWidth={2} showPercent={false} /> : <Sparkles size={14} />}
                {parsing ? 'Reading your mind...' : 'Parse brief'}
              </button>
            </div>
          )}

          {/* Phase 2: Structured fields */}
          {phase === 'fields' && fields && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="font-display font-semibold text-sm text-text">Here's what I got</h2>
                <p className="text-[11px] text-text-dim leading-relaxed">
                  Tweak anything that's off, then hit build.
                </p>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <Clock size={11} />
                  Duration
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    value={fields.duration}
                    onChange={(e) => updateField('duration', Number(e.target.value))}
                    min={5}
                    max={300}
                    className="w-20 bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-border-active"
                  />
                  <span className="text-[11px] text-text-dim">seconds</span>
                </div>
              </div>

              {/* Platform */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <Monitor size={11} />
                  Platform
                </label>
                <div className="segmented-control">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateField('platform', p.id)}
                      data-active={fields.platform === p.id}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <Sparkles size={11} />
                  Mood
                </label>
                <input
                  type="text"
                  value={fields.mood}
                  onChange={(e) => updateField('mood', e.target.value)}
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-border-active"
                />
              </div>

              {/* Pacing */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <Zap size={11} />
                  Pacing
                </label>
                <div className="segmented-control">
                  {PACING_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateField('pacing', p.id as BriefFields['pacing'])}
                      data-active={fields.pacing === p.id}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Music keywords */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <Music size={11} />
                  Music search
                </label>
                <input
                  type="text"
                  value={fields.musicKeywords}
                  onChange={(e) => updateField('musicKeywords', e.target.value)}
                  placeholder="e.g. upbeat electronic, chill acoustic"
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active"
                />
              </div>

              {/* Narrative notes */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <FileText size={11} />
                  Narrative notes
                </label>
                <textarea
                  value={fields.narrativeNotes}
                  onChange={(e) => updateField('narrativeNotes', e.target.value)}
                  rows={3}
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text resize-none focus:outline-none focus:ring-1 focus:ring-border-active leading-relaxed"
                />
              </div>

              {/* Clip selection hints */}
              <div className="space-y-2">
                <label className="text-[11px] text-text-dim">
                  Clip preferences
                </label>
                <textarea
                  value={fields.clipSelectionHints}
                  onChange={(e) => updateField('clipSelectionHints', e.target.value)}
                  rows={2}
                  placeholder="e.g. wide exterior shots first, then detail close-ups"
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim resize-none focus:outline-none focus:ring-1 focus:ring-border-active leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setPhase('braindump')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                >
                  <RotateCcw size={12} />
                  Back
                </button>
                <button
                  onClick={handleBuild}
                  className="flex items-center gap-2.5 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 font-semibold text-xs text-white transition-colors duration-150"
                >
                  <Sparkles size={14} />
                  Build rough cut
                </button>
              </div>

              {buildError && (
                <p className="text-[10px] text-accent">{buildError}</p>
              )}
            </div>
          )}

          {/* Phase 3: Building */}
          {phase === 'building' && (
            <div className="flex flex-col items-center justify-center gap-5 py-20">
              <h2 className="font-display font-semibold text-sm text-text">Building your edit</h2>
              <ProgressRing label={buildStatus} />
            </div>
          )}

          {/* Phase 4: Done */}
          {phase === 'done' && result && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="font-display font-semibold text-sm text-text">Rough cut ready</h2>
                <p className="text-[11px] text-text-dim leading-relaxed">{result.narrative}</p>
              </div>

              <div className="space-y-1.5">
                {result.storyboardClips.map((sc, i) => (
                  <div key={sc.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-active/50">
                    <span className="text-[10px] font-mono text-text-dim tabular-nums w-5 text-right">{i + 1}</span>
                    <div className="size-10 rounded-md bg-surface-active overflow-hidden shrink-0">
                      {sc.thumbnailPath && (
                        <img
                          src={`http://localhost:5201/thumbnails/${sc.thumbnailPath.split('/').pop()}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text truncate">{sc.fileName}</p>
                      <p className="text-[10px] text-text-dim mt-0.5">{sc.reason}</p>
                    </div>
                    <span className="text-[10px] font-mono text-text-dim tabular-nums shrink-0">
                      {sc.endTime.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
                >
                  <RotateCcw size={12} />
                  Start over
                </button>
                <button
                  onClick={() => setCentreView('storyboard')}
                  className="flex items-center gap-2.5 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 font-semibold text-xs text-white transition-colors duration-150"
                >
                  View storyboard
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
