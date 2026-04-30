import { Router } from 'express'

const router = Router()

const ES_BASE = 'https://www.epidemicsound.com/json/search/tracks/'

interface EsTrack {
  id: number
  title: string
  length: number
  bpm: number
  energyLevel: string
  creatives: { mainArtists: { name: string }[] }
  genres: { displayTag: string }[]
  moods: { displayTag: string; tag: string }[]
  stems: { full?: { lqMp3Url: string; waveformUrl?: string } }
  cover?: string
  imageUrl?: string
  hasVocals: boolean
}

function mapTrack(t: EsTrack) {
  const energyMap: Record<string, number> = { low: 25, medium: 50, high: 75 }
  return {
    id: String(t.id),
    title: t.title,
    artist: t.creatives?.mainArtists?.[0]?.name || 'Unknown',
    duration: t.length || 0,
    bpm: t.bpm || 0,
    genre: t.genres?.[0]?.displayTag || '',
    mood: t.moods?.map(m => m.displayTag) || [],
    energy: energyMap[t.energyLevel] || 50,
    hasStems: true,
    previewUrl: t.stems?.full?.lqMp3Url || undefined,
    coverUrl: t.cover || t.imageUrl || undefined,
    source: 'epidemic' as const,
  }
}

router.get('/search', async (req, res) => {
  const query = (req.query.q as string) || ''
  const mood = req.query.mood as string | undefined
  const genre = req.query.genre as string | undefined

  const searchTerms = [query, mood, genre].filter(Boolean).join(' ') || 'cinematic'

  const params = new URLSearchParams()
  params.set('term', searchTerms)
  params.set('limit', '20')

  try {
    const response = await fetch(`${ES_BASE}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    })
    if (!response.ok) throw new Error(`Epidemic Sound API: ${response.status}`)

    const data = await response.json()

    let tracks: EsTrack[] = []
    if (data.entities?.tracks) {
      const trackMap = data.entities.tracks as Record<string, EsTrack>
      if (data.data && Array.isArray(data.data)) {
        tracks = data.data.map((id: number) => trackMap[String(id)]).filter(Boolean)
      } else {
        tracks = Object.values(trackMap)
      }
    } else if (Array.isArray(data)) {
      tracks = data
    }

    res.json(tracks.map(mapTrack))
  } catch (err: any) {
    console.error('Epidemic Sound search error:', err.message)
    res.json([])
  }
})

router.get('/proxy-audio', async (req, res) => {
  const url = req.query.url as string
  if (!url || !url.includes('epidemicsound.com')) {
    res.status(400).json({ error: 'Invalid audio URL' })
    return
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`)

    res.set('Content-Type', 'audio/mpeg')
    res.set('Accept-Ranges', 'bytes')
    const buffer = Buffer.from(await response.arrayBuffer())
    res.send(buffer)
  } catch (err: any) {
    console.error('Audio proxy error:', err.message)
    res.status(502).json({ error: 'Failed to proxy audio' })
  }
})

export { router as musicRouter }
