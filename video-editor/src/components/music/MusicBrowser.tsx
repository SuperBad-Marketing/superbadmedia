import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Music } from 'lucide-react'
import { PanelLoader } from '../shared/LoadingPulse'
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
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Epidemic Sound..."
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
        </div>

        <div className="segmented-control">
          {MOOD_FILTERS.map((mood) => (
            <button
              key={mood}
              onClick={() => toggleFilter(mood)}
              data-active={activeFilters.has(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <PanelLoader />
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Music size={18} className="text-text-dim opacity-40" />
            <span className="text-[11px] text-text-dim">
              {hasSearched ? 'No tracks found' : 'Search for music'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-3">
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
