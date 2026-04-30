import { Router } from 'express'
import { ExportService } from '../services/export.js'

const router = Router()
const exportService = new ExportService()

router.post('/render', async (req, res) => {
  const { clipPaths, outputPath, format, codec, resolution, musicTrack } = req.body

  if (!clipPaths || !Array.isArray(clipPaths) || clipPaths.length === 0) {
    res.status(400).json({ error: 'clipPaths must be a non-empty array of file paths' })
    return
  }

  try {
    const job = await exportService.startRender({
      clipPaths,
      outputPath: outputPath || '/tmp/superedits-export.mp4',
      format: format || '16:9',
      codec: codec || 'h264',
      resolution: resolution || '1080p',
      musicTrack,
    })
    res.json(job)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/status/:jobId', (req, res) => {
  const status = exportService.getStatus(req.params.jobId)
  if (!status) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  res.json(status)
})

export { router as exportRouter }
