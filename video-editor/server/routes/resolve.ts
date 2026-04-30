import { Router } from 'express'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({ connected: false, version: null })
})

export { router as resolveRouter }
