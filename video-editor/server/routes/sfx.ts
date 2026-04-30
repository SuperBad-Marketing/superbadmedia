import { Router } from 'express'
import { SfxService } from '../services/sfx.js'

const router = Router()
const sfxService = new SfxService()

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
