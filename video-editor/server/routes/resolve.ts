import { Router } from 'express'
import { resolveBridge } from '../services/resolveBridge.js'

const router = Router()

router.get('/status', async (_req, res) => {
  const status = resolveBridge.status
  res.json(status)
})

router.post('/connect', async (_req, res) => {
  const status = await resolveBridge.start()
  res.json(status)
})

router.post('/command', async (req, res) => {
  const { action, params } = req.body
  if (!action) {
    res.status(400).json({ error: 'Action is required' })
    return
  }

  const result = await resolveBridge.send({ action, params })
  res.json(result)
})

router.post('/disconnect', (_req, res) => {
  resolveBridge.stop()
  res.json({ connected: false })
})

export { router as resolveRouter }
