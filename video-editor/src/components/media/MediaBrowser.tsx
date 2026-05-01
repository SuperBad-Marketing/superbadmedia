import { useState, useMemo, useCallback } from 'react'
import { Search, ListPlus, Eye, Sparkles, Camera, Mountain, Zap, Film, MapPin, Grid3X3 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { analyzeClipVision } from '../../lib/api'
import ClipCard from './ClipCard'
import ProgressRing from '../shared/ProgressRing'
import type { Clip } from '../../types'

type SortMode = 'all' | 'shot-type' | 'environment' | 'energy' | 'utility'

const SORT_TABS: { id: SortMode; label: string; icon: typeof Camera }[] = [
  { id: 'all', label: 'All', icon: Grid3X3 },
  { id: 'shot-type', label: 'Shots', icon: Camera },
  { id: 'environment', label: 'Setting', icon: Mountain },
  { id: 'energy', label: 'Energy', icon: Zap },
  { id: 'utility', label: 'Role', icon: Film },
]

const SHOT_TYPE_LABELS: Record<string, string> = {
  'drone-aerial': 'Drone / Aerial',
  wide: 'Wide',
  medium: 'Medium',
  'close-up': 'Close-up',
  'extreme-close-up': 'Extreme Close-up',
  macro: 'Macro',
  pov: 'POV',
  'over-shoulder': 'Over Shoulder',
  tracking: 'Tracking',
}

const ENVIRONMENT_LABELS: Record<string, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  urban: 'Urban',
  nature: 'Nature',
  studio: 'Studio',
  venue: 'Venue',
  office: 'Office',
  retail: 'Retail',
  restaurant: 'Restaurant',
  residential: 'Residential',
}

const UTILITY_LABELS: Record<string, string> = {
  'hero-shot': 'Hero Shot',
  'b-roll': 'B-Roll',
  establishing: 'Establishing',
  'detail-insert': 'Detail Insert',
  reaction: 'Reaction',
  'transition-friendly': 'Transition-Friendly',
  opener: 'Opener',
  closer: 'Closer',
}

function groupClips(clips: Clip[], mode: SortMode): Map<string, Clip[]> {
  const groups = new Map<string, Clip[]>()

  if (mode === 'all') {
    groups.set('All clips', clips)
    return groups
  }

  for (const clip of clips) {
    const a = clip.analysis
    let keys: string[] = []

    switch (mode) {
      case 'shot-type':
        if (a?.shotType) keys = [a.shotType]
        else keys = ['unclassified']
        break
      case 'environment':
        if (a?.environment) keys = [a.environment]
        else keys = ['unclassified']
        break
      case 'energy': {
        const energy = a?.energyLevel ?? 50
        if (energy >= 70) keys = ['high']
        else if (energy >= 40) keys = ['medium']
        else keys = ['low']
        break
      }
      case 'utility':
        if (a?.editUtility?.length) keys = [...a.editUtility]
        else keys = ['unclassified']
        break
    }

    for (const key of keys) {
      const existing = groups.get(key) || []
      existing.push(clip)
      groups.set(key, existing)
    }
  }

  return groups
}

function getGroupLabel(key: string, mode: SortMode): string {
  switch (mode) {
    case 'shot-type': return SHOT_TYPE_LABELS[key] || key
    case 'environment': return ENVIRONMENT_LABELS[key] || key
    case 'utility': return UTILITY_LABELS[key] || key
    case 'energy':
      if (key === 'high') return 'High Energy'
      if (key === 'medium') return 'Medium Energy'
      if (key === 'low') return 'Low / Calm'
      return key
    default: return key
  }
}

function getGroupIcon(key: string, mode: SortMode): string {
  if (mode === 'energy') {
    if (key === 'high') return '🔥'
    if (key === 'medium') return '⚡'
    return '🌊'
  }
  return ''
}

export default function MediaBrowser() {
  const clips = useAppStore((s) => s.clips)
  const currentProject = useAppStore((s) => s.currentProject)
  const updateClipAnalysis = useAppStore((s) => s.updateClipAnalysis)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('all')
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const addToStoryboard = useAppStore((s) => s.addToStoryboard)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const setWorkflowPhase = useAppStore((s) => s.setWorkflowPhase)

  const [visionRunning, setVisionRunning] = useState(false)
  const [visionProgress, setVisionProgress] = useState(0)
  const [visionTotal, setVisionTotal] = useState(0)

  const visionAnalyzedCount = useMemo(
    () => clips.filter((c) => c.analysis?.visionAnalyzed).length,
    [clips],
  )

  const hasVisionData = visionAnalyzedCount > 0

  const runVisionAnalysis = useCallback(async () => {
    const unanalyzed = clips.filter((c) => !c.analysis?.visionAnalyzed)
    if (unanalyzed.length === 0) return

    setVisionRunning(true)
    setVisionTotal(unanalyzed.length)
    setVisionProgress(0)

    for (let i = 0; i < unanalyzed.length; i++) {
      const clip = unanalyzed[i]
      try {
        const result = await analyzeClipVision(clip.filePath, clip.id, clip.duration)
        updateClipAnalysis(clip.id, {
          description: result.description,
          contentTags: [
            ...(clip.analysis?.contentTags || []),
            ...result.contentTags.filter(
              (t) => !(clip.analysis?.contentTags || []).includes(t),
            ),
          ],
          hasFaces: result.hasFaces,
          faceCount: result.faceCount,
          hasSmiles: result.hasSmiles,
          hasAction: result.hasAction,
          bestMomentTimestamps: result.bestMomentTimestamps,
          sceneType: result.sceneType,
          dominantColors: result.dominantColors,
          composition: result.composition,
          emotionalTone: result.emotionalTone,
          visionAnalyzed: true,
        })
      } catch {
        updateClipAnalysis(clip.id, { visionAnalyzed: true })
      }
      setVisionProgress(i + 1)
    }

    setVisionRunning(false)
  }, [clips, updateClipAnalysis])

  const filteredClips = useMemo(() => {
    if (!search) return clips
    const q = search.toLowerCase()
    return clips.filter(
      (c) =>
        c.fileName.toLowerCase().includes(q) ||
        c.analysis?.contentTags.some((t) => t.toLowerCase().includes(q)) ||
        c.analysis?.description?.toLowerCase().includes(q) ||
        c.analysis?.sceneType?.toLowerCase().includes(q) ||
        c.analysis?.emotionalTone?.toLowerCase().includes(q),
    )
  }, [clips, search])

  const groupedClips = useMemo(
    () => groupClips(filteredClips, sortMode),
    [filteredClips, sortMode],
  )

  const sortedGroups = useMemo(() => {
    const entries = [...groupedClips.entries()]
    if (sortMode === 'energy') {
      const order = ['high', 'medium', 'low', 'unclassified']
      entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    } else {
      entries.sort((a, b) => {
        if (a[0] === 'unclassified') return 1
        if (b[0] === 'unclassified') return -1
        return b[1].length - a[1].length
      })
    }
    return entries
  }, [groupedClips, sortMode])

  const handleAddAll = useCallback(() => {
    const inStoryboard = new Set(storyboardClips.map((sc) => sc.clipId))
    for (const clip of filteredClips) {
      if (!inStoryboard.has(clip.id)) {
        addToStoryboard(clip)
      }
    }
    setWorkflowPhase('assemble')
  }, [filteredClips, storyboardClips, addToStoryboard, setWorkflowPhase])

  if (!currentProject || clips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-text-dim">No footage loaded</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-3 space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips..."
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
        </div>

        {/* Sort tabs */}
        {hasVisionData && (
          <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {SORT_TABS.map((tab) => {
              const isActive = sortMode === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setSortMode(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-accent-dim text-accent'
                      : 'text-text-dim hover:text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={10} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Vision analysis trigger */}
        {visionRunning ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-surface-active/50">
            <ProgressRing
              progress={Math.round((visionProgress / visionTotal) * 100)}
              size={24}
              strokeWidth={2}
              showPercent={false}
              color="var(--color-orange)"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-text-muted">Analyzing content...</p>
              <p className="text-[9px] text-text-dim font-mono tabular-nums">
                {visionProgress} / {visionTotal}
              </p>
            </div>
          </div>
        ) : visionAnalyzedCount < clips.length ? (
          <button
            onClick={runVisionAnalysis}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[10px] text-text-dim hover:text-orange hover:bg-orange-dim transition-colors duration-150"
          >
            <Eye size={11} />
            Analyze content with AI
            <span className="ml-auto font-mono tabular-nums text-[9px]">
              {clips.length - visionAnalyzedCount} remaining
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-green/70">
            <Sparkles size={10} />
            All clips analyzed
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
        {sortedGroups.map(([groupKey, groupClips]) => (
          <div key={groupKey}>
            {sortMode !== 'all' && (
              <div className="flex items-center gap-1.5 mb-2 sticky top-0 bg-bg/90 backdrop-blur-sm py-1 z-[1]">
                {getGroupIcon(groupKey, sortMode) && (
                  <span className="text-[10px]">{getGroupIcon(groupKey, sortMode)}</span>
                )}
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {getGroupLabel(groupKey, sortMode)}
                </span>
                <span className="text-[9px] text-text-dim font-mono tabular-nums">
                  {groupClips.length}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {groupClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  isSelected={clip.id === selectedClipId}
                  onClick={() => setSelectedClipId(clip.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <span className="text-text-dim text-[10px] font-mono tabular-nums">
          {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleAddAll}
          className="flex items-center gap-1 text-[10px] text-text-dim hover:text-text-muted transition-colors duration-150"
        >
          <ListPlus size={10} />
          Add all
        </button>
      </div>
    </div>
  )
}
