import { Router } from 'express'
import { IngestService } from '../services/ingest.js'

const router = Router()
const ingestService = new IngestService()

router.post('/', async (req, res) => {
  const { sourcePath, clientName, sourceType } = req.body
  if (!sourcePath || !clientName) {
    res.status(400).json({ error: 'sourcePath and clientName are required' })
    return
  }
  try {
    const job = await ingestService.startIngest(sourcePath, clientName, sourceType || 'folder')
    res.json(job)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:jobId', (req, res) => {
  const job = ingestService.getJob(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  res.json(job)
})

export { router as ingestRouter }
