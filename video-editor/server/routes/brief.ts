import { Router } from 'express'
import { BriefAssembler } from '../services/briefAssembler.js'
import { SkillService } from '../services/skills.js'

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
  const { brief, clips, music } = req.body
  if (!brief) {
    res.status(400).json({ error: 'brief is required' })
    return
  }

  try {
    const result = await assembler.assemble(brief, clips, {
      ...music,
      selectedSkillIds: brief.selectedSkillIds,
    })
    res.json(result)
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

export { router as briefRouter }
