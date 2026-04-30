import { Router } from 'express'
import { cleanupAudio, analyzeAudioQuality, isDolbyConfigured } from '../services/audioCleanup.js'
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

export { router as audioRouter }
