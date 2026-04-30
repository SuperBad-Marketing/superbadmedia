import { Router } from 'express'
import { TransitionService } from '../services/transitions.js'

const router = Router()
const transitionService = new TransitionService()

router.get('/presets', (_req, res) => {
  res.json(transitionService.getPresets())
})

router.get('/presets/:category', (req, res) => {
  res.json(transitionService.getPresetsByCategory(req.params.category))
})

router.post('/generate', (req, res) => {
  const { presetId, clipAEnd, clipBStart } = req.body
  const preset = transitionService.getPreset(presetId)
  if (!preset) {
    res.status(404).json({ error: 'Preset not found' })
    return
  }
  const script = transitionService.generateFusionScript(preset, clipAEnd, clipBStart)
  res.json({ preset, fusionScript: script })
})

export { router as transitionsRouter }
