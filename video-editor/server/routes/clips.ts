import { Router } from 'express'
import { getClipAnalysisService } from '../services/clipAnalysis.js'
import { VisionAnalysisService } from '../services/visionAnalysis.js'
import { getMediaLibrary } from '../services/mediaLibrary.js'
import path from 'path'
import { dataPath } from '../services/dataRoot.js'

const router = Router()
const analysisService = getClipAnalysisService()
const visionService = new VisionAnalysisService()

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

router.post('/vision-analyze', async (req, res) => {
  const { filePath, clipId, duration } = req.body
  if (!filePath || !clipId) {
    res.status(400).json({ error: 'filePath and clipId are required' })
    return
  }
  try {
    const result = await visionService.analyzeClipVision(filePath, clipId, duration || 10)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/vision-analyze-batch', async (req, res) => {
  const { clips } = req.body
  if (!clips || !Array.isArray(clips)) {
    res.status(400).json({ error: 'clips array is required' })
    return
  }

  const results: Record<string, any> = {}
  const errors: Record<string, string> = {}

  for (const clip of clips) {
    try {
      const result = await visionService.analyzeClipVision(
        clip.filePath,
        clip.id,
        clip.duration || 10,
      )
      results[clip.id] = result
    } catch (error: any) {
      errors[clip.id] = error.message
    }
  }

  res.json({ results, errors, total: clips.length, analyzed: Object.keys(results).length })
})

router.get('/thumbnail/:clipId', (req, res) => {
  const thumbnailPath = dataPath('.thumbnails', `${req.params.clipId}.jpg`)
  try {
    res.sendFile(thumbnailPath)
  } catch {
    res.status(404).json({ error: 'Thumbnail not found' })
  }
})

router.post('/record-usage', (req, res) => {
  const { projectId, filePaths } = req.body
  if (!projectId || !filePaths?.length) {
    res.status(400).json({ error: 'projectId and filePaths are required' })
    return
  }
  const library = getMediaLibrary()
  library.recordUsage(projectId, filePaths)
  res.json({ recorded: filePaths.length })
})

export { router as clipsRouter }
