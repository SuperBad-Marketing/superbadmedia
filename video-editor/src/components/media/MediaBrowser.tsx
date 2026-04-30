import { useState, useMemo, useCallback } from 'react'
import { Search, SlidersHorizontal, ListPlus, Eye, Smile, Clapperboard, Sparkles } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { analyzeClipVision } from '../../lib/api'
import ClipCard from './ClipCard'
import ProgressRing from '../shared/ProgressRing'

type FilterMode = 'all' | 'best' | 'faces' | 'smiles' | 'action' | 'high-energy'

const filterLabels: Record<FilterMode, string> = {
  all: 'All',
  best: 'Best',
  faces: 'Faces',
  smiles: 'Smiles',
  action: 'Action',
  'high-energy': 'Energy',
}

export default function MediaBrowser() {
  const clips = useAppStore((s) => s.clips)
  const currentProject = useAppStore((s) => s.currentProject)
  const updateClipAnalysis = useAppStore((s) => s.updateClipAnalysis)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const addToStoryboard = useAppStore((s) => s.addToStoryboard)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const setCentreView = useAppStore((s) => s.setCentreView)

  const [visionRunning, setVisionRunning] = useState(false)
  const [visionProgress, setVisionProgress] = useState(0)
  const [visionTotal, setVisionTotal] = useState(0)

  const visionAnalyzedCount = useMemo(
    () => clips.filter((c) => c.analysis?.visionAnalyzed).length,
    [clips],
  )

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
    let result = clips

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.fileName.toLowerCase().includes(q) ||
          c.analysis?.contentTags.some((t) => t.toLowerCase().includes(q)) ||
          c.analysis?.description?.toLowerCase().includes(q) ||
          c.analysis?.sceneType?.toLowerCase().includes(q) ||
          c.analysis?.emotionalTone?.toLowerCase().includes(q)
      )
    }

    switch (filter) {
      case 'best':
        result = result.filter((c) => c.analysis && c.analysis.qualityRating >= 4)
        break
      case 'faces':
        result = result.filter((c) => c.analysis?.hasFaces)
        break
      case 'smiles':
        result = result.filter((c) => c.analysis?.hasSmiles)
        break
      case 'action':
        result = result.filter((c) => c.analysis?.hasAction)
        break
      case 'high-energy':
        result = result.filter(
          (c) =>
            c.analysis?.movementLevel === 'high' ||
            (c.analysis && c.analysis.energyLevel >= 70)
        )
        break
    }

    return result
  }, [clips, search, filter])

  const handleAddAll = useCallback(() => {
    const inStoryboard = new Set(storyboardClips.map((sc) => sc.clipId))
    for (const clip of filteredClips) {
      if (!inStoryboard.has(clip.id)) {
        addToStoryboard(clip)
      }
    }
    setCentreView('storyboard')
  }, [filteredClips, storyboardClips, addToStoryboard, setCentreView])

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

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors duration-150 ${
                filter !== 'all'
                  ? 'bg-accent-dim text-accent font-medium'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              <SlidersHorizontal size={10} />
              {filterLabels[filter]}
            </button>

            {filterOpen && (
              <div className="absolute top-full left-0 mt-1 bg-surface-raised border border-border rounded-lg py-1 z-10 min-w-[120px] shadow-xl shadow-black/30">
                {(Object.keys(filterLabels) as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setFilter(mode)
                      setFilterOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors duration-150 flex items-center gap-1.5 ${
                      filter === mode
                        ? 'text-accent bg-accent-dim font-medium'
                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    {mode === 'smiles' && <Smile size={10} />}
                    {mode === 'action' && <Clapperboard size={10} />}
                    {filterLabels[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              onClick={() => setSelectedClipId(clip.id)}
            />
          ))}
        </div>
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
