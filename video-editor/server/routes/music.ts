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

interface MappedTrack {
  id: string
  title: string
  artist: string
  duration: number
  bpm: number
  genre: string
  mood: string[]
  energy: number
  hasStems: boolean
  previewUrl?: string
  coverUrl?: string
  source: 'epidemic'
}

function mapTrack(t: EsTrack): MappedTrack {
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

function scoreTrack(track: MappedTrack, params: {
  targetBpm?: number
  targetEnergy?: number
  targetMoods?: string[]
}): number {
  let score = 0

  if (params.targetBpm && track.bpm > 0) {
    const bpmDiff = Math.abs(track.bpm - params.targetBpm)
    if (bpmDiff <= 5) score += 30
    else if (bpmDiff <= 15) score += 20
    else if (bpmDiff <= 30) score += 10
  }

  if (params.targetEnergy !== undefined) {
    const energyDiff = Math.abs(track.energy - params.targetEnergy)
    if (energyDiff <= 10) score += 25
    else if (energyDiff <= 25) score += 15
    else if (energyDiff <= 40) score += 5
  }

  if (params.targetMoods && params.targetMoods.length > 0 && track.mood.length > 0) {
    const trackMoodsLower = track.mood.map(m => m.toLowerCase())
    const matchCount = params.targetMoods.filter(m =>
      trackMoodsLower.some(tm => tm.includes(m.toLowerCase()) || m.toLowerCase().includes(tm))
    ).length
    score += matchCount * 15
  }

  if (track.previewUrl) score += 5

  return score
}

function intensityToEnergy(intensity: number): string | undefined {
  if (intensity < 30) return 'low'
  if (intensity < 70) return 'medium'
  return 'high'
}

function pacingToBpmRange(pacing: string, intensity?: number): { min: number; max: number } | undefined {
  const boost = (intensity ?? 50) > 70 ? 15 : 0
  switch (pacing) {
    case 'slow': return { min: 60, max: 95 + boost }
    case 'medium': return { min: 85, max: 130 + boost }
    case 'fast': return { min: 115 + boost, max: 180 }
    default: return undefined
  }
}

router.get('/search', async (req, res) => {
  const query = (req.query.q as string) || ''
  const mood = req.query.mood as string | undefined
  const genre = req.query.genre as string | undefined
  const pacing = req.query.pacing as string | undefined
  const intensityStr = req.query.intensity as string | undefined
  const intensity = intensityStr ? Number(intensityStr) : undefined

  const params = new URLSearchParams()
  params.set('term', query || 'cinematic')
  params.set('limit', '50')

  if (genre) params.set('genres', genre)

  const energyLevel = intensity !== undefined ? intensityToEnergy(intensity) : undefined
  if (energyLevel) params.set('energyLevels', energyLevel)

  const bpmRange = pacing ? pacingToBpmRange(pacing, intensity) : undefined
  if (bpmRange) {
    params.set('bpm_min', String(bpmRange.min))
    params.set('bpm_max', String(bpmRange.max))
  }

  const targetBpm = bpmRange ? Math.round((bpmRange.min + bpmRange.max) / 2) : undefined
  const targetEnergy = intensity !== undefined ? intensity : undefined
  const targetMoods = mood ? mood.split(/[,\s]+/).filter(Boolean) : undefined

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

    const mapped = tracks.map(mapTrack)

    const scored = mapped
      .map(t => ({ track: t, score: scoreTrack(t, { targetBpm, targetEnergy, targetMoods }) }))
      .sort((a, b) => b.score - a.score)
      .map(({ track }) => track)

    res.json(scored)
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
