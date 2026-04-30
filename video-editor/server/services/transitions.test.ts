import { describe, it, expect } from 'vitest'
import { TransitionService } from './transitions.js'

describe('TransitionService', () => {
  const service = new TransitionService()

  describe('getPresets', () => {
    it('returns all transition presets', () => {
      const presets = service.getPresets()
      expect(presets.length).toBeGreaterThan(0)
    })

    it('each preset has required fields', () => {
      const presets = service.getPresets()
      for (const preset of presets) {
        expect(preset).toHaveProperty('id')
        expect(preset).toHaveProperty('name')
        expect(preset).toHaveProperty('category')
        expect(preset).toHaveProperty('duration')
        expect(preset.duration).toBeGreaterThan(0)
      }
    })

    it('has unique IDs', () => {
      const presets = service.getPresets()
      const ids = presets.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('getPresetsByCategory', () => {
    it('filters by impact', () => {
      const impacts = service.getPresetsByCategory('impact')
      expect(impacts.length).toBeGreaterThan(0)
      expect(impacts.every(p => p.category === 'impact')).toBe(true)
    })

    it('filters by dissolve', () => {
      const dissolves = service.getPresetsByCategory('dissolve')
      expect(dissolves.length).toBeGreaterThan(0)
      expect(dissolves.every(p => p.category === 'dissolve')).toBe(true)
    })

    it('returns empty for unknown category', () => {
      expect(service.getPresetsByCategory('nonexistent')).toEqual([])
    })
  })

  describe('getPreset', () => {
    it('finds preset by ID', () => {
      const preset = service.getPreset('impact-shake')
      expect(preset).toBeDefined()
      expect(preset!.name).toBe('Camera Shake Impact')
    })

    it('returns undefined for unknown ID', () => {
      expect(service.getPreset('nonexistent')).toBeUndefined()
    })
  })

  describe('generateFusionScript', () => {
    it('generates a valid Fusion script', () => {
      const preset = service.getPreset('dissolve-soft')!
      const script = service.generateFusionScript(preset, 5.0, 6.0)

      expect(script).toContain('Fusion Transition: Soft Dissolve')
      expect(script).toContain('Duration: 1s')
      expect(script).toContain('dissolve')
      expect(script).toContain('TransitionMerge')
    })

    it('includes clip timing in the expression', () => {
      const preset = service.getPreset('wipe-whip')!
      const script = service.generateFusionScript(preset, 3.0, 3.4)

      expect(script).toContain('3')
      expect(script).toContain('3.4')
    })
  })
})
