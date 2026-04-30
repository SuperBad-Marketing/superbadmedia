import { describe, it, expect } from 'vitest'
import { SfxService } from './sfx.js'

describe('SfxService', () => {
  const service = new SfxService()

  describe('getLibrary', () => {
    it('returns all SFX presets', () => {
      const library = service.getLibrary()
      expect(library.length).toBeGreaterThan(0)
      expect(library[0]).toHaveProperty('id')
      expect(library[0]).toHaveProperty('name')
      expect(library[0]).toHaveProperty('category')
      expect(library[0]).toHaveProperty('tags')
    })
  })

  describe('getByCategory', () => {
    it('filters by impact category', () => {
      const impacts = service.getByCategory('impact')
      expect(impacts.length).toBeGreaterThan(0)
      expect(impacts.every(s => s.category === 'impact')).toBe(true)
    })

    it('filters by whoosh category', () => {
      const whooshes = service.getByCategory('whoosh')
      expect(whooshes.length).toBeGreaterThan(0)
      expect(whooshes.every(s => s.category === 'whoosh')).toBe(true)
    })

    it('returns empty for unknown category', () => {
      const result = service.getByCategory('nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('search', () => {
    it('finds by name', () => {
      const results = service.search('boom')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(s => s.name.toLowerCase().includes('boom'))).toBe(true)
    })

    it('finds by tag', () => {
      const results = service.search('cinematic')
      expect(results.length).toBeGreaterThan(0)
    })

    it('finds by category', () => {
      const results = service.search('whoosh')
      expect(results.length).toBeGreaterThan(0)
    })

    it('is case-insensitive', () => {
      const lower = service.search('boom')
      const upper = service.search('BOOM')
      expect(lower).toEqual(upper)
    })

    it('returns empty for no matches', () => {
      const results = service.search('xyznonexistent')
      expect(results).toEqual([])
    })
  })

  describe('suggestPlacements', () => {
    const transitionPoints = [2.0, 5.5, 10.0]

    it('returns one placement per transition point', () => {
      const placements = service.suggestPlacements(transitionPoints, 'cinematic')
      expect(placements).toHaveLength(3)
    })

    it('positions match transition points', () => {
      const placements = service.suggestPlacements(transitionPoints, 'cinematic')
      expect(placements.map(p => p.timelinePosition)).toEqual(transitionPoints)
    })

    it('sets higher volume for energetic style', () => {
      const cinematic = service.suggestPlacements([1.0], 'cinematic')
      const energetic = service.suggestPlacements([1.0], 'energetic')
      expect(energetic[0].volume).toBeGreaterThanOrEqual(cinematic[0].volume)
    })

    it('includes fade values', () => {
      const placements = service.suggestPlacements([1.0], 'subtle')
      expect(placements[0].fadeIn).toBeGreaterThan(0)
      expect(placements[0].fadeOut).toBeGreaterThan(0)
    })
  })
})
