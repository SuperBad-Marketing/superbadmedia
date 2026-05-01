import { Router } from 'express'
import { revisionService } from '../services/revision.js'

const router = Router()

router.post('/', async (req, res) => {
  const { context, feedback, conversationHistory } = req.body
  if (!context || !feedback) {
    res.status(400).json({ error: 'context and feedback are required' })
    return
  }

  try {
    const result = await revisionService.processRevision(
      context,
      feedback,
      conversationHistory || [],
    )
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as revisionRouter }
