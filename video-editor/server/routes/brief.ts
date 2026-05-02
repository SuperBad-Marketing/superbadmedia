import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { BriefAssembler } from '../services/briefAssembler.js'
import { SkillService } from '../services/skills.js'
import { resolveOrchestrator } from '../services/resolveOrchestrator.js'
import { getClipAnalysisService } from '../services/clipAnalysis.js'
import { clientService } from '../services/clients.js'

const router = Router()
const assembler = new BriefAssembler()
const skillService = new SkillService()

router.post('/parse', async (req, res) => {
  const { braindump } = req.body
  if (!braindump) {
    res.status(400).json({ error: 'braindump is required' })
    return
  }

  try {
    const fields = await assembler.parseBrief(braindump)
    res.json(fields)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/build', async (req, res) => {
  const { brief, clips, music, projectId, editPreferences, clientId, editStyleId } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }

  let clientInstructions = ''
  if (clientId) {
    clientInstructions = clientService.getInstructionsPrompt(clientId, editStyleId)
  }

  try {
    const result = await assembler.assemble(brief, clips, {
      ...music,
      selectedSkillIds: brief.selectedSkillIds,
      projectId,
      clientId,
      editPreferences: editPreferences || undefined,
      clientInstructions: clientInstructions || undefined,
    })

    const projectName = brief.narrativeNotes?.slice(0, 40) || 'SuperEdits Assembly'

    const enrichedClips = result.storyboardClips.map(sc => {
      const source = (clips || []).find((c: any) => c.id === sc.clipId)
      return { ...sc, analysis: source?.analysis }
    })

    const resolveResult = await resolveOrchestrator.pushFullEdit(
      projectName,
      enrichedClips,
      result.transitions,
      result.sfxPlacements,
      music?.editIntent || null,
      brief.moodAxes,
      editPreferences || null,
    ).catch(() => ({ resolveStatus: 'no-resolve' as const, zoomPlan: [], slowMoPlan: [], stabilizedClips: [] }))

    res.json({
      ...result,
      resolveStatus: resolveResult.resolveStatus,
      zoomPlan: resolveResult.zoomPlan,
      slowMoPlan: resolveResult.slowMoPlan,
      stabilizedClips: resolveResult.stabilizedClips,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/recut', async (req, res) => {
  const { brief, clips, music, projectId, editPreferences, clientId, editStyleId } = req.body
  if (!brief || !music) {
    res.status(400).json({ error: 'brief and music are required for recut' })
    return
  }

  let clientInstructions = ''
  if (clientId) {
    clientInstructions = clientService.getInstructionsPrompt(clientId, editStyleId)
  }

  try {
    const result = await assembler.assemble(brief, clips, {
      ...music,
      selectedSkillIds: brief.selectedSkillIds,
      projectId,
      clientId,
      editPreferences: editPreferences || undefined,
      clientInstructions: clientInstructions || undefined,
    })

    const projectName = brief.narrativeNotes?.slice(0, 40) || 'SuperEdits Assembly'

    const enrichedClips = result.storyboardClips.map(sc => {
      const source = (clips || []).find((c: any) => c.id === sc.clipId)
      return { ...sc, analysis: source?.analysis }
    })

    const resolveResult = await resolveOrchestrator.pushFullEdit(
      projectName,
      enrichedClips,
      result.transitions,
      result.sfxPlacements,
      music?.editIntent || null,
      brief.moodAxes,
      editPreferences || null,
    ).catch(() => ({ resolveStatus: 'no-resolve' as const, zoomPlan: [], slowMoPlan: [], stabilizedClips: [] }))

    res.json({
      ...result,
      resolveStatus: resolveResult.resolveStatus,
      zoomPlan: resolveResult.zoomPlan,
      slowMoPlan: resolveResult.slowMoPlan,
      stabilizedClips: resolveResult.stabilizedClips,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/skills', (_req, res) => {
  const summaries = skillService.getSkillSummaries()
  res.json(summaries)
})

router.post('/auto-select-skills', (req, res) => {
  const { clips, brief } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }
  const selected = assembler.autoSelectSkills(clips || [], brief)
  res.json({ selectedIds: selected })
})

router.post('/recommend-preferences', async (req, res) => {
  const { brief, clips } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.json({ preferences: null, reasoning: 'No API key configured — using defaults.' })
    return
  }

  const clipAnalysis = getClipAnalysisService()
  const analysed = clipAnalysis.getAllAnalysed()

  const hasShaky = analysed.some(c => c.analysis?.movementLevel === 'high')
  const hasStatic = analysed.some(c => c.analysis?.movementLevel === 'static' || c.analysis?.movementLevel === 'low')
  const hasFaces = analysed.some(c => c.analysis?.hasFaces)
  const hasHighEnergy = analysed.some(c => (c.analysis?.energyLevel ?? 0) > 70)
  const avgEnergy = analysed.length > 0 ? analysed.reduce((s, c) => s + (c.analysis?.energyLevel ?? 50), 0) / analysed.length : 50

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You recommend edit preferences for a video editing app. Given footage analysis and a creative brief, suggest which features to enable and at what settings.

Respond with ONLY a JSON object matching this shape:
{
  "preferences": {
    "zoom": { "enabled": boolean, "intensity": "subtle"|"standard"|"dramatic", "frequency": "few"|"some"|"many" },
    "slowMo": { "enabled": boolean, "speed": 25|50|75, "autoDetect": true },
    "stabilisation": { "enabled": boolean, "mode": "translation"|"perspective", "applyTo": "shaky-only"|"all" },
    "grading": { "enabled": boolean, "look": "natural"|"warm"|"cool"|"punchy"|"cinematic", "consistency": "match-cameras"|"embrace-mix" },
    "transitions": { "enabled": boolean, "style": "cuts-only"|"subtle"|"dynamic"|"energetic", "density": "sparse"|"moderate"|"frequent" },
    "sfx": { "enabled": boolean, "density": "minimal"|"accent"|"layered", "categories": ["impact","whoosh","riser","ambient","foley"] },
    "musicSync": { "enabled": boolean, "tightness": "loose"|"on-beat"|"tight" },
    "titles": { "enabled": boolean, "usage": "none"|"minimal"|"throughout" },
    "motionGraphics": { "enabled": boolean },
    "source": "auto-recommended"
  },
  "reasoning": "2-3 sentence explanation of why you chose these settings"
}

Rules:
- Ken Burns zooms only make sense if there are static shots
- Slow-mo at 25% needs 120fps source; default to 50% for 24-60fps footage
- Stabilisation only if there's shaky footage
- Match grading look to the mood (warm for lifestyle, cool for corporate, punchy for action)
- Transition style should match pacing (fast pacing = energetic, slow = subtle)
- SFX density matches energy level
- Music sync tightness matches pacing`,
      messages: [{
        role: 'user',
        content: `Brief: mood=${brief.mood || 'cinematic'}, pacing=${brief.pacing || 'medium'}, duration=${brief.duration || '30s'}
Narrative: ${brief.narrativeNotes || 'none'}
Footage: ${analysed.length || (clips || []).length} clips, hasShaky=${hasShaky}, hasStatic=${hasStatic}, hasFaces=${hasFaces}, hasHighEnergy=${hasHighEnergy}, avgEnergy=${Math.round(avgEnergy)}
${brief.moodAxes ? `Mood axes: intensity=${brief.moodAxes.intensity || 50}, intimacy=${brief.moodAxes.intimacy || 50}, chaos=${brief.moodAxes.chaos || 30}` : ''}`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')
    res.json(parsed)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export { router as briefRouter }
