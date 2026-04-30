import { useState, useMemo, useCallback } from 'react'
import { Search, SlidersHorizontal, ListPlus } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import ClipCard from './ClipCard'

type FilterMode = 'all' | 'best' | 'faces' | 'high-energy'

const filterLabels: Record<FilterMode, string> = {
  all: 'All',
  best: 'Best Shots',
  faces: 'Faces',
  'high-energy': 'High Energy',
}

export default function MediaBrowser() {
  const clips = useAppStore((s) => s.clips)
  const currentProject = useAppStore((s) => s.currentProject)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const addToStoryboard = useAppStore((s) => s.addToStoryboard)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const setCentreView = useAppStore((s) => s.setCentreView)

  const filteredClips = useMemo(() => {
    let result = clips

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.fileName.toLowerCase().includes(q) ||
          c.analysis?.contentTags.some((t) => t.toLowerCase().includes(q)) ||
          c.analysis?.description?.toLowerCase().includes(q)
      )
    }

    switch (filter) {
      case 'best':
        result = result.filter((c) => c.analysis && c.analysis.qualityRating >= 4)
        break
      case 'faces':
        result = result.filter((c) => c.analysis?.hasFaces)
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
        <span className="text-sm text-text-dim">No footage loaded</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips..."
            className="w-full bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim pl-9 pr-3 py-2 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150 ${
              filter !== 'all'
                ? 'bg-accent-dim text-accent font-medium'
                : 'text-text-dim hover:text-text-muted hover:bg-surface-hover'
            }`}
          >
            <SlidersHorizontal size={11} />
            {filterLabels[filter]}
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg py-1 z-10 min-w-[140px] shadow-lg">
              {(Object.keys(filterLabels) as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setFilter(mode)
                    setFilterOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 ${
                    filter === mode
                      ? 'text-accent bg-accent-dim font-medium'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  {filterLabels[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3.5">
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

      <div className="px-6 py-3.5 border-t border-border flex items-center justify-between">
        <span className="text-text-dim text-xs font-mono tabular-nums">
          {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` / ${clips.length}`}
        </span>
        <button
          onClick={handleAddAll}
          className="flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors duration-150 font-medium"
        >
          <ListPlus size={12} />
          Add all
        </button>
      </div>
    </div>
  )
}
