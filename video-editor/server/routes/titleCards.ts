import { Router } from 'express'
import { TitleCardService } from '../services/titleCards.js'
import { getTitlePipelineService } from '../services/titlePipeline.js'
import { getEditIntentService } from '../services/editIntent.js'

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

router.post('/apply', async (req, res) => {
  const { intentId, intent: rawIntent, projectName, clientName, brief } = req.body

  const intentService = getEditIntentService()
  const intent = rawIntent || (intentId ? intentService.loadIntent(intentId) : null)

  if (!intent) {
    res.status(400).json({ error: 'intentId or intent object required' })
    return
  }

  try {
    const pipeline = getTitlePipelineService()
    const result = await pipeline.applyTitles(intent, brief, projectName, clientName)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as titleCardsRouter }
