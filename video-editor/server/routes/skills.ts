import { Router } from 'express'
import { SkillService } from '../services/skills.js'

const router = Router()
const skillService = new SkillService()

router.get('/', (_req, res) => {
  const skills = skillService.getAll()
  res.json(skills)
})

router.post('/learn', async (req, res) => {
  const { url, content, name } = req.body
  try {
    if (url) {
      const skill = await skillService.learnFromUrl(url)
      res.json(skill)
    } else if (content && name) {
      const skill = skillService.createManual(name, content)
      res.json(skill)
    } else {
      res.status(400).json({ error: 'Provide url or (content + name)' })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/find-resources', async (req, res) => {
  const { topic } = req.body
  if (!topic) {
    res.status(400).json({ error: 'topic is required' })
    return
  }
  try {
    const resources = await skillService.findResources(topic)
    res.json(resources)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/evaluate/:id', (req, res) => {
  const skills = skillService.getAll()
  const skill = skills.find(s => s.id === req.params.id)
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' })
    return
  }
  const score = skillService.evaluateQuality(skill.content)
  res.json({ skill: skill.name, score })
})

router.post('/upgrade/:id', async (req, res) => {
  const skills = skillService.getAll()
  const skill = skills.find(s => s.id === req.params.id)
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' })
    return
  }
  try {
    const upgraded = await skillService.upgradeSkill(skill)
    res.json(upgraded)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/upgrade-all', async (_req, res) => {
  try {
    const result = await skillService.upgradeAll()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', (req, res) => {
  skillService.delete(req.params.id)
  res.json({ success: true })
})

export { router as skillsRouter }
