import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2, Music } from 'lucide-react'
import type { MusicTrack } from '../../types'
import { searchMusic } from '../../lib/api'
import TrackCard from './TrackCard'
import MusicPlayer from './MusicPlayer'

const MOOD_FILTERS = ['Cinematic', 'Dynamic', 'Upbeat', 'Moody', 'Chill', 'Energetic', 'Ambient'] as const

export default function MusicBrowser() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [previewTrack, setPreviewTrack] = useState<MusicTrack | null>(null)
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchTracks = useCallback(async (query: string, moods: Set<string>) => {
    setLoading(true)
    try {
      const moodParam = moods.size === 1 ? [...moods][0] : undefined
      const results = await searchMusic(query, { mood: moodParam })
      setTracks(results)
      setHasSearched(true)
    } catch {
      setTracks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTracks('', activeFilters)
  }, [fetchTracks, activeFilters])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (search) fetchTracks(search, activeFilters)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, fetchTracks, activeFilters])

  function toggleFilter(mood: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(mood)) {
        next.delete(mood)
      } else {
        next.clear()
        next.add(mood)
      }
      return next
    })
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
            placeholder="Search Epidemic Sound..."
            className="w-full bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {MOOD_FILTERS.map((mood) => (
            <button
              key={mood}
              onClick={() => toggleFilter(mood)}
              className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 ${
                activeFilters.has(mood)
                  ? 'bg-pink-dim border border-pink/30 text-pink font-medium'
                  : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-text-dim animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Music size={24} className="text-text-dim opacity-40" />
            <span className="text-sm text-text-dim">
              {hasSearched ? 'No tracks found' : 'Search for music'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-4">
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isSelected={previewTrack?.id === track.id}
                onSelect={setPreviewTrack}
              />
            ))}
          </div>
        )}
      </div>

      {previewTrack && <MusicPlayer track={previewTrack} />}
    </div>
  )
}
