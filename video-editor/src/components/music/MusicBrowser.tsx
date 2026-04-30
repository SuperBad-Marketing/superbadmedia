import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { MusicTrack } from '../../types'
import TrackCard from './TrackCard'
import MusicPlayer from './MusicPlayer'

const MOOD_FILTERS = ['Cinematic', 'Dynamic', 'Upbeat', 'Moody', 'Chill', 'Energetic', 'Ambient'] as const

const DEMO_TRACKS: MusicTrack[] = [
  {
    id: 'track-1',
    title: 'Midnight Drive',
    artist: 'Vektor',
    duration: 198,
    bpm: 110,
    genre: 'Electronic',
    mood: ['Cinematic', 'Moody'],
    energy: 65,
    hasStems: true,
    source: 'epidemic',
  },
  {
    id: 'track-2',
    title: 'Golden Hour',
    artist: 'Luma',
    duration: 224,
    bpm: 92,
    genre: 'Indie',
    mood: ['Chill', 'Ambient'],
    energy: 35,
    hasStems: true,
    source: 'epidemic',
  },
  {
    id: 'track-3',
    title: 'Break Through',
    artist: 'Apex Sound',
    duration: 180,
    bpm: 140,
    genre: 'Electronic',
    mood: ['Dynamic', 'Energetic'],
    energy: 88,
    hasStems: false,
    source: 'epidemic',
  },
  {
    id: 'track-4',
    title: 'Slow Burn',
    artist: 'Glass Atlas',
    duration: 256,
    bpm: 78,
    genre: 'Ambient',
    mood: ['Cinematic', 'Ambient'],
    energy: 25,
    hasStems: true,
    source: 'epidemic',
  },
  {
    id: 'track-5',
    title: 'Neon Pulse',
    artist: 'Synth Theory',
    duration: 210,
    bpm: 128,
    genre: 'Synthwave',
    mood: ['Upbeat', 'Energetic'],
    energy: 78,
    hasStems: false,
    source: 'epidemic',
  },
  {
    id: 'track-6',
    title: 'Paper Walls',
    artist: 'Hollow Sun',
    duration: 192,
    bpm: 96,
    genre: 'Post-Rock',
    mood: ['Moody', 'Cinematic'],
    energy: 52,
    hasStems: true,
    source: 'epidemic',
  },
]

export default function MusicBrowser() {
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [previewTrack, setPreviewTrack] = useState<MusicTrack | null>(null)

  function toggleFilter(mood: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(mood)) {
        next.delete(mood)
      } else {
        next.add(mood)
      }
      return next
    })
  }

  const filteredTracks = useMemo(() => {
    let result = DEMO_TRACKS

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.mood.some((m) => m.toLowerCase().includes(q))
      )
    }

    if (activeFilters.size > 0) {
      result = result.filter((t) =>
        t.mood.some((m) => activeFilters.has(m))
      )
    }

    return result
  }, [search, activeFilters])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search music..."
            className="w-full bg-bg border border-border rounded-lg text-[13px] text-text placeholder:text-text-dim pl-8 pr-3 py-2 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {MOOD_FILTERS.map((mood) => (
            <button
              key={mood}
              onClick={() => toggleFilter(mood)}
              className={`rounded-lg px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors duration-150 ${
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

      <div className="flex-1 overflow-y-auto py-1">
        {filteredTracks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-text-dim">No tracks found</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1">
            {filteredTracks.map((track) => (
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
