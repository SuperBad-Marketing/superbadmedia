import { Router } from 'express'
import { getColorGradingService } from '../services/colorGrading.js'
import { getEditIntentService } from '../services/editIntent.js'

const router = Router()

router.post('/apply', async (req, res) => {
  const { intentId, intent: rawIntent } = req.body

  const intentService = getEditIntentService()
  const intent = rawIntent || (intentId ? intentService.loadIntent(intentId) : null)

  if (!intent) {
    res.status(400).json({ error: 'intentId or intent object required' })
    return
  }

  try {
    const grading = getColorGradingService()
    const result = await grading.gradeTimeline(intent)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/analyze-clip', async (req, res) => {
  const { clipIndex, filePath, intent } = req.body

  if (clipIndex == null || !filePath || !intent) {
    res.status(400).json({ error: 'clipIndex, filePath, and intent required' })
    return
  }

  try {
    const grading = getColorGradingService()
    const result = await grading.analyzeAndRefineGrade(intent, clipIndex, filePath)
    res.json(result || { adjustments: {} })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as gradingRouter }
