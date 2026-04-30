import { useState, useCallback } from 'react'
import { Loader2, Sparkles, Music, Clock, Monitor, Zap, FileText, ArrowRight, RotateCcw } from 'lucide-react'
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
      setBuildStatus('Something went wrong. Try again.')
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
  }

  const updateField = <K extends keyof BriefFields>(key: K, value: BriefFields[K]) => {
    if (!fields) return
    setFields({ ...fields, [key]: value })
  }

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="size-20 rounded-2xl bg-surface-active flex items-center justify-center">
          <FileText size={32} className="text-text-dim" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text text-balance text-center">Brief Builder</h2>
        <p className="text-text-muted text-base text-center text-pretty max-w-sm">
          Import footage first. Once your clips are analysed, come back here to build a rough cut from a brief.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12 space-y-10">

          {/* Phase 1: Braindump */}
          {phase === 'braindump' && (
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-bold text-text">What are we making?</h2>
                <p className="text-text-muted text-sm leading-relaxed">
                  Dump everything in your head. Platform, mood, what shots you want, pacing, vibe, whatever. I'll sort it out.
                </p>
              </div>

              <textarea
                value={braindump}
                onChange={(e) => setBraindump(e.target.value)}
                placeholder="e.g. Pumping venue showcase for Instagram. Fast cuts, electronic music. Start with the exterior wide shots, then interior details, then the crowd. 30 seconds. High energy, make it look premium."
                rows={6}
                className="w-full bg-surface border border-border rounded-2xl text-sm text-text placeholder:text-text-dim px-6 py-5 resize-none focus:outline-none focus:border-border-active transition-colors leading-relaxed"
              />

              <button
                onClick={handleParse}
                disabled={!braindump.trim() || parsing}
                className="flex items-center gap-3 bg-accent hover:bg-accent-hover rounded-xl px-8 py-4 font-display font-bold text-sm text-white transition-colors duration-150 disabled:opacity-40"
              >
                {parsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {parsing ? 'Reading your mind...' : 'Parse brief'}
              </button>
            </div>
          )}

          {/* Phase 2: Structured fields */}
          {phase === 'fields' && fields && (
            <div className="space-y-10">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-bold text-text">Here's what I got</h2>
                <p className="text-text-muted text-sm leading-relaxed">
                  Tweak anything that's off, then hit build.
                </p>
              </div>

              {/* Duration */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <Clock size={12} />
                  Duration
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={fields.duration}
                    onChange={(e) => updateField('duration', Number(e.target.value))}
                    min={5}
                    max={300}
                    className="w-24 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-mono tabular-nums focus:outline-none focus:border-border-active"
                  />
                  <span className="text-sm text-text-dim">seconds</span>
                </div>
              </div>

              {/* Platform */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <Monitor size={12} />
                  Platform
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => updateField('platform', p.id)}
                      className={`rounded-xl px-5 py-3 text-xs font-medium transition-colors duration-150 ${
                        fields.platform === p.id
                          ? 'bg-accent-dim border border-accent/40 text-accent'
                          : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <Sparkles size={12} />
                  Mood
                </label>
                <input
                  type="text"
                  value={fields.mood}
                  onChange={(e) => updateField('mood', e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-border-active"
                />
              </div>

              {/* Pacing */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <Zap size={12} />
                  Pacing
                </label>
                <div className="flex gap-2">
                  {PACING_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => updateField('pacing', p.id as BriefFields['pacing'])}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-4 text-xs font-medium transition-colors duration-150 ${
                        fields.pacing === p.id
                          ? 'bg-accent-dim border border-accent/40 text-accent'
                          : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
                      }`}
                    >
                      <span className="font-semibold">{p.label}</span>
                      <span className="text-[10px] opacity-60">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Music keywords */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <Music size={12} />
                  Music search
                </label>
                <input
                  type="text"
                  value={fields.musicKeywords}
                  onChange={(e) => updateField('musicKeywords', e.target.value)}
                  placeholder="e.g. upbeat electronic, chill acoustic"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active"
                />
              </div>

              {/* Narrative notes */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <FileText size={12} />
                  Narrative notes
                </label>
                <textarea
                  value={fields.narrativeNotes}
                  onChange={(e) => updateField('narrativeNotes', e.target.value)}
                  rows={3}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text resize-none focus:outline-none focus:border-border-active leading-relaxed"
                />
              </div>

              {/* Clip selection hints */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Clip preferences
                </label>
                <textarea
                  value={fields.clipSelectionHints}
                  onChange={(e) => updateField('clipSelectionHints', e.target.value)}
                  rows={2}
                  placeholder="e.g. wide exterior shots first, then detail close-ups"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-dim resize-none focus:outline-none focus:border-border-active leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => setPhase('braindump')}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150"
                >
                  <RotateCcw size={14} />
                  Back
                </button>
                <button
                  onClick={handleBuild}
                  className="flex items-center gap-3 bg-accent hover:bg-accent-hover rounded-xl px-8 py-4 font-display font-bold text-sm text-white transition-colors duration-150"
                >
                  <Sparkles size={16} />
                  Build rough cut
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Building */}
          {phase === 'building' && (
            <div className="flex flex-col items-center justify-center gap-6 py-20">
              <Loader2 size={32} className="text-accent animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold text-text">Building your edit</h2>
                <p className="text-text-muted text-sm">{buildStatus}</p>
              </div>
            </div>
          )}

          {/* Phase 4: Done */}
          {phase === 'done' && result && (
            <div className="space-y-10">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-bold text-text">Rough cut ready</h2>
                <p className="text-text-muted text-sm leading-relaxed">{result.narrative}</p>
              </div>

              <div className="space-y-3">
                {result.storyboardClips.map((sc, i) => (
                  <div key={sc.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
                    <span className="text-xs font-mono text-text-dim tabular-nums w-6 text-right">{i + 1}</span>
                    <div className="size-12 rounded-lg bg-surface-active overflow-hidden shrink-0">
                      {sc.thumbnailPath && (
                        <img
                          src={`http://localhost:5201/thumbnails/${sc.thumbnailPath.split('/').pop()}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{sc.fileName}</p>
                      <p className="text-xs text-text-dim">{sc.reason}</p>
                    </div>
                    <span className="text-xs font-mono text-text-dim tabular-nums shrink-0">
                      {sc.endTime.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150"
                >
                  <RotateCcw size={14} />
                  Start over
                </button>
                <button
                  onClick={() => setCentreView('storyboard')}
                  className="flex items-center gap-3 bg-accent hover:bg-accent-hover rounded-xl px-8 py-4 font-display font-bold text-sm text-white transition-colors duration-150"
                >
                  View storyboard
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
