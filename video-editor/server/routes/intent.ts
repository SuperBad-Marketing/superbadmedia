import { Router } from 'express'
import { getEditIntentService } from '../services/editIntent.js'
import { getClipAnalysisService } from '../services/clipAnalysis.js'
import { BriefAssembler } from '../services/briefAssembler.js'

const router = Router()
const assembler = new BriefAssembler()

router.post('/questions', (req, res) => {
  const { brief, musicStructure } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }

  const clipAnalysis = getClipAnalysisService()
  const clips = clipAnalysis.getAllAnalysed()
  const footageProfile = (assembler as any).buildFootageProfile(clips)

  const cameras = [...new Set(clips.map((c: any) => c.camera || c.analysis?.camera || '').filter(Boolean))]
  const hasAmbientNoise = clips.some((c: any) =>
    c.analysis?.contentTags?.some((t: string) =>
      ['crowd', 'chatter', 'traffic', 'ambient', 'noise', 'wind', 'room-tone'].includes(t.toLowerCase())
    )
  )

  const intentService = getEditIntentService()
  const questions = intentService.generateQuestions({
    footageProfile,
    musicStructure: musicStructure || null,
    brief,
    clipCount: clips.length,
    cameras,
    hasDialogue: clips.some((c: any) => c.analysis?.hasDialogue),
    hasAmbientNoise,
  })

  res.json({ questions })
})

router.post('/build', (req, res) => {
  const { answers, projectId, clientId } = req.body
  if (!answers) {
    res.status(400).json({ error: 'answers are required' })
    return
  }

  const intentService = getEditIntentService()
  const intent = intentService.buildIntent(answers, projectId, clientId)
  intentService.saveIntent(intent)

  res.json({
    intent,
    assemblyContext: intentService.intentToAssemblyContext(intent),
    gradingContext: intentService.intentToGradingContext(intent),
    audioContext: intentService.intentToAudioContext(intent),
    titlesContext: intentService.intentToTitlesContext(intent),
  })
})

router.get('/:id', (req, res) => {
  const intentService = getEditIntentService()
  const intent = intentService.loadIntent(req.params.id)
  if (!intent) {
    res.status(404).json({ error: 'Intent not found' })
    return
  }
  res.json(intent)
})

export { router as intentRouter }
