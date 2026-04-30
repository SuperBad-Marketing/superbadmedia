import { Router } from 'express'
import { ClipAnalysisService } from '../services/clipAnalysis.js'
import path from 'path'

const router = Router()
const analysisService = new ClipAnalysisService()

router.post('/analyze', async (req, res) => {
  const { dirPath, projectId } = req.body
  if (!dirPath) {
    res.status(400).json({ error: 'dirPath is required' })
    return
  }
  try {
    const clips = await analysisService.analyzeDirectory(dirPath, projectId || 'default')
    res.json({ clips, total: clips.length })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/analyze-single', async (req, res) => {
  const { filePath, projectId } = req.body
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' })
    return
  }
  try {
    const clip = await analysisService.analyzeClip(filePath, projectId || 'default')
    res.json(clip)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/thumbnail/:clipId', (req, res) => {
  const thumbnailPath = path.join(process.cwd(), '.thumbnails', `${req.params.clipId}.jpg`)
  try {
    res.sendFile(thumbnailPath)
  } catch {
    res.status(404).json({ error: 'Thumbnail not found' })
  }
})

export { router as clipsRouter }
