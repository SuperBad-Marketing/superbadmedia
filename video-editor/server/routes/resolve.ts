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

router.get('/playhead', async (_req, res) => {
  const result = await resolveBridge.getPlayhead()
  res.json(result)
})

router.post('/seek', async (req, res) => {
  const { timecode } = req.body
  if (!timecode) {
    res.status(400).json({ error: 'timecode is required' })
    return
  }
  const result = await resolveBridge.seekTimecode(timecode)
  res.json(result)
})

router.post('/play', async (_req, res) => {
  const result = await resolveBridge.transportPlay()
  res.json(result)
})

router.post('/stop', async (_req, res) => {
  const result = await resolveBridge.transportStop()
  res.json(result)
})

router.get('/projects', async (_req, res) => {
  const result = await resolveBridge.listProjects()
  res.json(result)
})

router.post('/projects/load', async (req, res) => {
  const { name } = req.body
  if (!name) {
    res.status(400).json({ error: 'Project name is required' })
    return
  }
  const result = await resolveBridge.loadProject(name)
  res.json(result)
})

router.post('/disconnect', (_req, res) => {
  resolveBridge.stop()
  res.json({ connected: false })
})

export { router as resolveRouter }
