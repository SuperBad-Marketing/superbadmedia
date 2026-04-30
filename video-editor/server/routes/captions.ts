import { Router } from 'express'
import { CaptionService } from '../services/captions.js'

const router = Router()
const captionService = new CaptionService()

router.post('/transcribe', async (req, res) => {
  const { filePath } = req.body
  if (!filePath) {
    res.status(400).json({ error: 'filePath is required' })
    return
  }

  try {
    const result = await captionService.transcribe(filePath)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as captionsRouter }
