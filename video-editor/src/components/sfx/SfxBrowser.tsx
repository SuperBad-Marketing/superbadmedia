import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2, Volume2 } from 'lucide-react'
import type { SfxPreset } from '../../types'
import { getSfxLibrary, searchSfx } from '../../lib/api'

const CATEGORY_FILTERS = ['Impact', 'Whoosh', 'Riser', 'Ambient', 'Foley', 'Musical'] as const

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

function categoryIcon(category: string): string {
  const icons: Record<string, string> = {
    impact: '💥',
    whoosh: '💨',
    riser: '📈',
    ambient: '🌿',
    foley: '👣',
    ui: '🔔',
    musical: '🎵',
  }
  return icons[category] || '🔊'
}

export default function SfxBrowser() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [presets, setPresets] = useState<SfxPreset[]>([])
  const [filtered, setFiltered] = useState<SfxPreset[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    getSfxLibrary()
      .then((data) => {
        setPresets(data)
        setFiltered(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const applyFilters = useCallback((query: string, category: string | null, all: SfxPreset[]) => {
    let results = all
    if (category) {
      results = results.filter((p) => p.category === category.toLowerCase())
    }
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q))
      )
    }
    setFiltered(results)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (search) {
        searchSfx(search)
          .then(setFiltered)
          .catch(() => applyFilters(search, activeCategory, presets))
      } else {
        applyFilters('', activeCategory, presets)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, activeCategory, presets, applyFilters])

  function toggleCategory(cat: string) {
    const lower = cat.toLowerCase()
    setActiveCategory((prev) => (prev === lower ? null : lower))
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
            placeholder="Search sounds..."
            className="w-full bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 ${
                activeCategory === cat.toLowerCase()
                  ? 'bg-pink-dim border border-pink/30 text-pink font-medium'
                  : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-text-dim animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Volume2 size={24} className="text-text-dim opacity-40" />
            <span className="text-sm text-text-dim">No sounds match your search</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-4">
            {filtered.map((preset) => (
              <button
                key={preset.id}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-left border border-transparent hover:bg-surface-hover transition-colors duration-150"
              >
                <div className="size-9 rounded-full bg-surface-active flex items-center justify-center shrink-0 text-sm">
                  {categoryIcon(preset.category)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{preset.name}</div>
                  <div className="text-xs text-text-dim truncate">{preset.description}</div>
                  <div className="flex gap-1.5 mt-1">
                    {preset.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] text-pink font-mono">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-text-dim font-mono uppercase">{preset.category}</span>
                  <span className="font-mono text-[10px] text-text-dim tabular-nums">{formatDuration(preset.duration)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bg border-t border-border px-4 py-3">
        <p className="text-[11px] text-text-dim leading-relaxed">
          Tell the chat to <span className="text-text-muted">"layer SFX on every transition"</span> or <span className="text-text-muted">"add a boom at 4 seconds"</span>
        </p>
      </div>
    </div>
  )
}
