import { Router } from 'express'
import { jobQueue } from '../services/jobQueue.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    jobs: jobQueue.getAll(),
    processing: jobQueue.isProcessing(),
  })
})

router.get('/:id', (req, res) => {
  const job = jobQueue.get(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  res.json(job)
})

router.post('/submit', (req, res) => {
  const { sourcePath, brief, clientId } = req.body
  if (!sourcePath || !brief) {
    res.status(400).json({ error: 'sourcePath and brief are required' })
    return
  }

  const job = jobQueue.add(sourcePath, brief, clientId)
  res.json(job)
})

router.post('/start', (_req, res) => {
  jobQueue.startProcessing()
  res.json({ processing: true })
})

router.post('/stop', (_req, res) => {
  jobQueue.stopProcessing()
  res.json({ processing: false })
})

router.delete('/:id', (req, res) => {
  const removed = jobQueue.remove(req.params.id)
  if (!removed) {
    res.status(400).json({ error: 'Cannot remove — job is currently processing or not found' })
    return
  }
  res.json({ success: true })
})

export { router as queueRouter }
