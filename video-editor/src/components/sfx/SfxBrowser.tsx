import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, Volume2 } from 'lucide-react'
import type { EpidemicSfx } from '../../types'
import { searchEpidemicSfx } from '../../lib/api'
import SfxCard from './SfxCard'
import SfxPlayer from './SfxPlayer'

const QUICK_SEARCHES = ['Whoosh', 'Impact', 'Riser', 'Ambient', 'Foley', 'Cinematic', 'Glitch'] as const

export default function SfxBrowser() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [previewSfx, setPreviewSfx] = useState<EpidemicSfx | null>(null)
  const [results, setResults] = useState<EpidemicSfx[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doSearch = useCallback(async (query: string) => {
    if (!query) return
    setLoading(true)
    try {
      const data = await searchEpidemicSfx(query)
      setResults(data)
      setHasSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    doSearch('cinematic')
  }, [doSearch])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (search) doSearch(search)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, doSearch])

  function selectFilter(term: string) {
    if (activeFilter === term) {
      setActiveFilter(null)
      doSearch('cinematic')
    } else {
      setActiveFilter(term)
      setSearch('')
      doSearch(term)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveFilter(null) }}
            placeholder="Search Epidemic Sound SFX..."
            className="w-full bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {QUICK_SEARCHES.map((term) => (
            <button
              key={term}
              onClick={() => selectFilter(term)}
              className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 ${
                activeFilter === term
                  ? 'bg-pink-dim border border-pink/30 text-pink font-medium'
                  : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
              }`}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-text-dim animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Volume2 size={24} className="text-text-dim opacity-40" />
            <span className="text-sm text-text-dim">
              {hasSearched ? 'No sounds found' : 'Search for sound effects'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-4">
            {results.map((sfx) => (
              <SfxCard
                key={sfx.id}
                sfx={sfx}
                isSelected={previewSfx?.id === sfx.id}
                onSelect={setPreviewSfx}
              />
            ))}
          </div>
        )}
      </div>

      {previewSfx && <SfxPlayer sfx={previewSfx} />}
    </div>
  )
}
