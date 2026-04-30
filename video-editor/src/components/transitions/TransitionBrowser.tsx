import { useState, useEffect } from 'react'
import { Search, Layers, Check } from 'lucide-react'
import { PanelLoader } from '../shared/LoadingPulse'
import type { TransitionPreset, Transition } from '../../types'
import { getTransitionPresets } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

const CATEGORY_FILTERS = ['Impact', 'Dissolve', 'Wipe', 'Zoom', 'Film', 'Glitch'] as const

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

function mapCategory(cat: string): Transition['type'] {
  const map: Record<string, Transition['type']> = {
    impact: 'impact',
    dissolve: 'dissolve',
    wipe: 'wipe',
    zoom: 'zoom-blur',
    film: 'film-burn',
    glitch: 'glitch',
  }
  return map[cat] || 'custom'
}

export default function TransitionBrowser() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [presets, setPresets] = useState<TransitionPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const setStoryboardClips = useAppStore((s) => s.setStoryboardClips)

  useEffect(() => {
    getTransitionPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = presets.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.includes(q)
      )
    }
    return true
  })

  function toggleCategory(cat: string) {
    const lower = cat.toLowerCase()
    setActiveCategory((prev) => (prev === lower ? null : lower))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transitions..."
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
        </div>

        <div className="segmented-control">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              data-active={activeCategory === cat.toLowerCase()}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <PanelLoader message="Loading transitions." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Layers size={18} className="text-text-dim opacity-40" />
            <span className="text-[11px] text-text-dim">No transitions match your search</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-3">
            {filtered.map((preset) => {
              const justApplied = appliedId === preset.id
              return (
                <div
                  key={preset.id}
                  className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-left hover:bg-surface-hover transition-colors duration-150"
                >
                  <div className="size-8 rounded-lg bg-surface-active/80 flex items-center justify-center shrink-0">
                    <Layers size={13} className="text-text-muted" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-text truncate">{preset.name}</div>
                    <div className="text-[10px] text-text-dim truncate mt-0.5">{preset.description}</div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="font-mono text-[10px] text-text-dim tabular-nums uppercase">{preset.category}</span>
                    <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatDuration(preset.duration)}</span>
                    {preset.hasSfx && (
                      <span className="text-[10px] text-pink font-mono">+ SFX</span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (storyboardClips.length < 2) return
                      const updated = storyboardClips.map((clip, i) => {
                        if (i < storyboardClips.length - 1) {
                          return {
                            ...clip,
                            transitionOut: {
                              type: mapCategory(preset.category),
                              duration: preset.duration,
                              sfxId: preset.hasSfx ? preset.id : undefined,
                              isFromLibrary: true,
                            },
                          }
                        }
                        return clip
                      })
                      setStoryboardClips(updated)
                      setAppliedId(preset.id)
                      setTimeout(() => setAppliedId(null), 2000)
                    }}
                    disabled={storyboardClips.length < 2}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors duration-150 ${
                      justApplied
                        ? 'bg-green-dim text-green'
                        : storyboardClips.length < 2
                          ? 'text-text-dim opacity-30'
                          : 'bg-accent-dim text-accent hover:bg-accent/25'
                    }`}
                  >
                    {justApplied ? <Check size={10} /> : 'Apply'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-surface-active/30 px-5 py-3">
        <p className="text-[10px] text-text-dim leading-relaxed">
          {storyboardClips.length < 2
            ? 'Add 2+ clips to storyboard to apply transitions'
            : <><span className="text-text-muted">Apply</span> adds the transition to all cut points</>
          }
        </p>
      </div>
    </div>
  )
}
