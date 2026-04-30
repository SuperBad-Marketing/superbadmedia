import { Router } from 'express'

const router = Router()

const MOCK_TRACKS = [
  { id: '1', title: 'Golden Hour', artist: 'Dusk & Dawn', duration: 195, bpm: 92, genre: 'Cinematic', mood: ['warm', 'hopeful'], energy: 45, hasStems: true, source: 'epidemic' as const },
  { id: '2', title: 'Neon Drive', artist: 'Pulse Theory', duration: 168, bpm: 128, genre: 'Electronic', mood: ['energetic', 'driving'], energy: 85, hasStems: true, source: 'epidemic' as const },
  { id: '3', title: 'Still Waters', artist: 'Ambient Fields', duration: 240, bpm: 68, genre: 'Ambient', mood: ['calm', 'contemplative'], energy: 20, hasStems: false, source: 'epidemic' as const },
  { id: '4', title: 'Raw Power', artist: 'Iron Circuit', duration: 142, bpm: 140, genre: 'Rock', mood: ['intense', 'raw'], energy: 95, hasStems: true, source: 'epidemic' as const },
  { id: '5', title: 'Sunday Morning', artist: 'Velvet Keys', duration: 210, bpm: 78, genre: 'Indie', mood: ['relaxed', 'nostalgic'], energy: 35, hasStems: true, source: 'epidemic' as const },
  { id: '6', title: 'City Lights', artist: 'Metro Sound', duration: 185, bpm: 110, genre: 'Pop', mood: ['upbeat', 'modern'], energy: 70, hasStems: true, source: 'epidemic' as const },
]

router.get('/search', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase()
  const mood = req.query.mood as string | undefined

  let results = [...MOCK_TRACKS]

  if (query) {
    results = results.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query) ||
      t.genre.toLowerCase().includes(query) ||
      t.mood.some(m => m.includes(query))
    )
  }

  if (mood) {
    results = results.filter(t => t.mood.includes(mood.toLowerCase()))
  }

  res.json(results)
})

export { router as musicRouter }
