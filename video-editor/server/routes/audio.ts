import { Router } from 'express'
import { cleanupAudio, analyzeAudioQuality, isDolbyConfigured } from '../services/audioCleanup.js'
import { getAudioMixingService } from '../services/audioMixing.js'
import { getEditIntentService } from '../services/editIntent.js'
import path from 'path'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({
    dolbyConfigured: isDolbyConfigured(),
    ffmpegAvailable: true,
  })
})

router.post('/analyze', async (req, res) => {
  const { filePath } = req.body
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' })
    return
  }
  try {
    const result = await analyzeAudioQuality(filePath)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/cleanup', async (req, res) => {
  const { filePath, outputDir } = req.body
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' })
    return
  }

  const outDir = outputDir || path.dirname(filePath)

  try {
    const result = await cleanupAudio(filePath, outDir)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/mix', async (req, res) => {
  const { intentId, intent: rawIntent } = req.body

  const intentService = getEditIntentService()
  const intent = rawIntent || (intentId ? intentService.loadIntent(intentId) : null)

  if (!intent) {
    res.status(400).json({ error: 'intentId or intent object required' })
    return
  }

  try {
    const mixer = getAudioMixingService()
    const result = await mixer.mixTimeline(intent)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as audioRouter }
