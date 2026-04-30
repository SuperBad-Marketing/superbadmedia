export interface SfxPreset {
  id: string
  name: string
  category: 'impact' | 'whoosh' | 'riser' | 'ambient' | 'foley' | 'ui' | 'musical'
  description: string
  duration: number
  tags: string[]
}

export interface SfxPlacement {
  sfxId: string
  timelinePosition: number
  volume: number
  fadeIn: number
  fadeOut: number
}

const LIBRARY: SfxPreset[] = [
  { id: 'impact-deep-boom', name: 'Deep Boom', category: 'impact', description: 'Low-frequency cinematic boom', duration: 1.5, tags: ['cinematic', 'dramatic', 'bass'] },
  { id: 'impact-hit', name: 'Hit Impact', category: 'impact', description: 'Sharp percussive hit', duration: 0.8, tags: ['sharp', 'percussive'] },
  { id: 'impact-slam', name: 'Metal Slam', category: 'impact', description: 'Heavy metallic slam', duration: 1.2, tags: ['metal', 'heavy'] },
  { id: 'impact-sub-drop', name: 'Sub Drop', category: 'impact', description: 'Deep sub bass drop', duration: 2.0, tags: ['bass', 'electronic'] },
  { id: 'whoosh-fast', name: 'Fast Whoosh', category: 'whoosh', description: 'Quick lateral whoosh', duration: 0.5, tags: ['fast', 'transition'] },
  { id: 'whoosh-slow', name: 'Slow Whoosh', category: 'whoosh', description: 'Drawn-out whoosh', duration: 1.0, tags: ['slow', 'cinematic'] },
  { id: 'whoosh-heavy', name: 'Heavy Whoosh', category: 'whoosh', description: 'Weighty bass whoosh', duration: 0.8, tags: ['heavy', 'bass'] },
  { id: 'whoosh-reversed', name: 'Reversed Whoosh', category: 'whoosh', description: 'Reverse sucking whoosh', duration: 0.6, tags: ['reverse', 'transition'] },
  { id: 'riser-tension', name: 'Tension Riser', category: 'riser', description: 'Building tension riser', duration: 3.0, tags: ['tension', 'build'] },
  { id: 'riser-cinematic', name: 'Cinematic Riser', category: 'riser', description: 'Orchestral build to peak', duration: 4.0, tags: ['cinematic', 'orchestral'] },
  { id: 'riser-electronic', name: 'Electronic Riser', category: 'riser', description: 'Synth frequency sweep up', duration: 2.5, tags: ['electronic', 'synth'] },
  { id: 'ambient-room-tone', name: 'Room Tone', category: 'ambient', description: 'Neutral room ambience', duration: 10.0, tags: ['neutral', 'room'] },
  { id: 'ambient-city', name: 'City Ambience', category: 'ambient', description: 'Distant traffic and urban hum', duration: 15.0, tags: ['urban', 'traffic'] },
  { id: 'ambient-nature', name: 'Nature Ambience', category: 'ambient', description: 'Birds, wind, natural environment', duration: 15.0, tags: ['nature', 'birds'] },
  { id: 'foley-cloth', name: 'Cloth Movement', category: 'foley', description: 'Fabric rustling', duration: 1.0, tags: ['fabric', 'subtle'] },
  { id: 'foley-footstep', name: 'Footstep', category: 'foley', description: 'Single footstep on hard surface', duration: 0.5, tags: ['footstep', 'walk'] },
  { id: 'foley-paper', name: 'Paper Handling', category: 'foley', description: 'Paper shuffle and handling', duration: 1.5, tags: ['paper', 'office'] },
  { id: 'ui-click', name: 'UI Click', category: 'ui', description: 'Clean digital click', duration: 0.2, tags: ['digital', 'interface'] },
  { id: 'ui-notification', name: 'Notification', category: 'ui', description: 'Soft notification chime', duration: 0.8, tags: ['chime', 'alert'] },
  { id: 'musical-stinger', name: 'Musical Stinger', category: 'musical', description: 'Short dramatic musical hit', duration: 1.5, tags: ['dramatic', 'musical'] },
  { id: 'musical-logo-reveal', name: 'Logo Reveal', category: 'musical', description: 'Elegant logo reveal sound', duration: 2.0, tags: ['logo', 'elegant'] },
]

export class SfxService {
  getLibrary(): SfxPreset[] {
    return LIBRARY
  }

  getByCategory(category: string): SfxPreset[] {
    return LIBRARY.filter((s) => s.category === category)
  }

  search(query: string): SfxPreset[] {
    const q = query.toLowerCase()
    return LIBRARY.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)) ||
        s.category.includes(q)
    )
  }

  suggestPlacements(
    transitionPoints: number[],
    style: 'cinematic' | 'subtle' | 'energetic'
  ): SfxPlacement[] {
    const placements: SfxPlacement[] = []

    for (const point of transitionPoints) {
      let sfxId: string
      let volume: number

      switch (style) {
        case 'cinematic':
          sfxId = Math.random() > 0.5 ? 'impact-deep-boom' : 'whoosh-slow'
          volume = 0.7
          break
        case 'energetic':
          sfxId = Math.random() > 0.5 ? 'impact-hit' : 'whoosh-fast'
          volume = 0.8
          break
        default:
          sfxId = Math.random() > 0.5 ? 'whoosh-fast' : 'foley-cloth'
          volume = 0.5
      }

      placements.push({
        sfxId,
        timelinePosition: point,
        volume,
        fadeIn: 0.05,
        fadeOut: 0.2,
      })
    }

    return placements
  }
}
