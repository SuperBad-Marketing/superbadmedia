import { Router } from 'express'
import { TitleCardService } from '../services/titleCards.js'

const router = Router()
const titleCardService = new TitleCardService()

router.get('/presets', (_req, res) => {
  res.json(titleCardService.getPresets())
})

router.get('/presets/:type', (req, res) => {
  res.json(titleCardService.getPresetsByType(req.params.type))
})

router.post('/generate', (req, res) => {
  const { presetId, text, subtext, duration, position, font, insertAt } = req.body
  if (!presetId || !text) {
    res.status(400).json({ error: 'presetId and text are required' })
    return
  }

  const script = titleCardService.generateFusionScript({
    presetId,
    text,
    subtext,
    duration: duration || 3,
    position: position || 'center',
    font,
    insertAt: insertAt || 0,
  })
  res.json({ fusionScript: script })
})

export { router as titleCardsRouter }
