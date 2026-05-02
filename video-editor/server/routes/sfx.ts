import { Router } from 'express'
import { SfxService } from '../services/sfx.js'

const router = Router()
const sfxService = new SfxService()

const ES_SFX_BASE = 'https://www.epidemicsound.com/json/search/sfx/'

interface EsSfxTrack {
  id: number
  title: string
  length: number
  bpm: number
  isSfx: boolean
  genres: { displayTag: string; tag: string; fatherTag?: string }[]
  stems: { full?: { lqMp3Url: string; waveformUrl?: string } }
  imageUrl?: string
  cover?: string
}

function mapSfxTrack(t: EsSfxTrack) {
  const parentCategory = t.genres?.[0]?.fatherTag || t.genres?.[0]?.displayTag || 'SFX'
  const subCategory = t.genres?.[0]?.displayTag || ''
  return {
    id: String(t.id),
    title: t.title,
    duration: t.length || 0,
    category: parentCategory,
    subCategory,
    tags: t.genres?.map(g => g.displayTag) || [],
    previewUrl: t.stems?.full?.lqMp3Url || undefined,
    waveformUrl: t.stems?.full?.waveformUrl || undefined,
    coverUrl: t.cover || t.imageUrl || undefined,
    source: 'epidemic' as const,
  }
}

router.get('/epidemic/search', async (req, res) => {
  const query = (req.query.q as string) || 'cinematic'
  const params = new URLSearchParams()
  params.set('term', query)
  params.set('limit', '20')

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    }
    const token = process.env.EPIDEMIC_SOUND_TOKEN
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(`${ES_SFX_BASE}?${params}`, { headers })
    if (!response.ok) throw new Error(`Epidemic Sound SFX: ${response.status}`)

    const data = await response.json()

    let tracks: EsSfxTrack[] = []
    if (data.entities?.tracks) {
      const trackMap = data.entities.tracks as Record<string, EsSfxTrack>
      if (data.data && Array.isArray(data.data)) {
        tracks = data.data.map((id: number) => trackMap[String(id)]).filter(Boolean)
      } else {
        tracks = Object.values(trackMap)
      }
    }

    res.json(tracks.map(mapSfxTrack))
  } catch (err: any) {
    console.error('Epidemic Sound SFX search error:', err.message)
    res.json([])
  }
})

router.get('/library', (_req, res) => {
  res.json(sfxService.getLibrary())
})

router.get('/category/:category', (req, res) => {
  res.json(sfxService.getByCategory(req.params.category))
})

router.get('/search', (req, res) => {
  const query = (req.query.q as string) || ''
  res.json(sfxService.search(query))
})

router.post('/suggest', (req, res) => {
  const { transitionPoints, style } = req.body
  if (!transitionPoints || !Array.isArray(transitionPoints)) {
    res.status(400).json({ error: 'transitionPoints array is required' })
    return
  }
  const placements = sfxService.suggestPlacements(transitionPoints, style || 'cinematic')
  res.json({ placements })
})

export { router as sfxRouter }
