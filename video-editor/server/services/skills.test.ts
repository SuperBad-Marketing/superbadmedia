import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { SkillService } from './skills.js'

const TEST_SKILLS_DIR = path.join(process.cwd(), 'skills')

describe('SkillService', () => {
  let service: SkillService

  beforeEach(() => {
    service = new SkillService()
  })

  afterEach(() => {
    const files = fs.readdirSync(TEST_SKILLS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(TEST_SKILLS_DIR, file), 'utf-8'))
        if (content.name?.startsWith('[TEST]')) {
          fs.unlinkSync(path.join(TEST_SKILLS_DIR, file))
        }
      } catch { /* skip */ }
    }
  })

  describe('createManual', () => {
    it('creates a skill with correct fields', () => {
      const skill = service.createManual('[TEST] Shot Composition', '- Rule of thirds\n- Leading lines\n- Negative space')

      expect(skill.id).toBeDefined()
      expect(skill.name).toBe('[TEST] Shot Composition')
      expect(skill.category).toBe('personal')
      expect(skill.source).toBe('manual')
      expect(skill.topicCount).toBe(3)
    })

    it('persists to disk', () => {
      const skill = service.createManual('[TEST] Persist Check', '- One topic')
      const filePath = path.join(TEST_SKILLS_DIR, `${skill.id}.json`)
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it('counts bullet points as topics', () => {
      const skill = service.createManual('[TEST] Topics', 'No bullets here')
      expect(skill.topicCount).toBe(1)
    })
  })

  describe('getAll', () => {
    it('returns array', () => {
      const skills = service.getAll()
      expect(Array.isArray(skills)).toBe(true)
    })

    it('includes created skills', () => {
      const created = service.createManual('[TEST] Find Me', '- Test topic')
      const all = service.getAll()
      expect(all.some(s => s.id === created.id)).toBe(true)
    })
  })

  describe('delete', () => {
    it('removes skill file from disk', () => {
      const skill = service.createManual('[TEST] Delete Me', '- Gone')
      const filePath = path.join(TEST_SKILLS_DIR, `${skill.id}.json`)
      expect(fs.existsSync(filePath)).toBe(true)

      service.delete(skill.id)
      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('does not throw for nonexistent ID', () => {
      expect(() => service.delete('nonexistent-id')).not.toThrow()
    })
  })

  describe('findResources', () => {
    it('returns suggestions for known topics', async () => {
      const results = await service.findResources('Colour Grading')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('title')
      expect(results[0]).toHaveProperty('url')
    })

    it('returns fallback for unknown topics', async () => {
      const results = await service.findResources('Underwater Basket Weaving')
      expect(results.length).toBeGreaterThan(0)
    })
  })
})
