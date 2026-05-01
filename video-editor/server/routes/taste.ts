import { Router } from 'express'
import { getTasteProfileService } from '../services/tasteProfile.js'

const router = Router()

router.get('/profile', (_req, res) => {
  const service = getTasteProfileService()
  const profile = service.getProfile()
  res.json({
    totalEditsAnalyzed: profile.totalEditsAnalyzed,
    lastUpdated: profile.lastUpdated,
    observations: profile.observations,
    clientStyles: profile.clientStyles,
    referenceStyles: Object.values(profile.referenceStyles),
  })
})

router.post('/feedback', (req, res) => {
  const { assemblyId, clips, transitions, totalDuration } = req.body
  if (!assemblyId || !clips) {
    res.status(400).json({ error: 'assemblyId and clips are required' })
    return
  }

  const service = getTasteProfileService()
  const diff = service.captureFeedback(
    assemblyId,
    clips,
    transitions || [],
    totalDuration || 0,
  )

  if (!diff) {
    res.json({ captured: false, reason: 'No changes detected or original assembly not found' })
    return
  }

  res.json({ captured: true, diff })
})

router.post('/reference', (req, res) => {
  const { name, clips, transitions, totalDuration } = req.body
  if (!name || !clips) {
    res.status(400).json({ error: 'name and clips are required' })
    return
  }

  const service = getTasteProfileService()
  const ref = service.extractReferenceStyle(name, clips, transitions || [], totalDuration || 0)
  res.json(ref)
})

router.get('/references', (_req, res) => {
  const service = getTasteProfileService()
  res.json(service.getReferenceStyles())
})

router.delete('/reference/:id', (req, res) => {
  const service = getTasteProfileService()
  const deleted = service.deleteReferenceStyle(req.params.id)
  res.json({ deleted })
})

router.post('/reset', (_req, res) => {
  const service = getTasteProfileService()
  service.resetProfile()
  res.json({ reset: true })
})

export { router as tasteRouter }
