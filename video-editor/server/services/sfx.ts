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

const ES_SFX_BASE = 'https://www.epidemicsound.com/json/search/sfx/'

export interface EpidemicSfxResult {
  id: string
  title: string
  duration: number
  category: string
  tags: string[]
  subCategory: string
  previewUrl?: string
  matchScore?: number
}

export class SfxService {
  async searchEpidemic(query: string, limit = 5): Promise<EpidemicSfxResult[]> {
    const params = new URLSearchParams({ term: query, limit: String(Math.max(limit, 10)) })
    try {
      const response = await fetch(`${ES_SFX_BASE}?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      })
      if (!response.ok) {
        console.error(`Epidemic SFX search failed: ${response.status} for query "${query}"`)
        return []
      }
      const data = await response.json()
      const trackMap = data.entities?.tracks as Record<string, any> | undefined
      if (!trackMap) return []

      const ids: number[] = Array.isArray(data.data) ? data.data : Object.keys(trackMap).map(Number)
      const results = ids.map((id) => {
        const t = trackMap[String(id)]
        if (!t) return null

        const tags: string[] = []
        if (t.genres) for (const g of t.genres) if (g.displayTag) tags.push(g.displayTag.toLowerCase())
        if (t.metadataTags) for (const tag of t.metadataTags) tags.push(String(tag).toLowerCase())
        if (t.moods) for (const m of t.moods) if (m.displayTag) tags.push(m.displayTag.toLowerCase())

        return {
          id: String(t.id),
          title: t.title || '',
          duration: t.length || 0,
          category: t.genres?.[0]?.displayTag || 'SFX',
          subCategory: t.genres?.[1]?.displayTag || '',
          tags,
          previewUrl: t.stems?.full?.lqMp3Url || undefined,
        }
      }).filter(Boolean) as EpidemicSfxResult[]

      return results.slice(0, limit)
    } catch (err: any) {
      console.error(`Epidemic SFX search error for "${query}":`, err.message)
      return []
    }
  }

  scoreSfxMatch(
    result: EpidemicSfxResult,
    intent: { category: string; role: string; searchQuery: string },
  ): number {
    let score = 0
    const queryWords = intent.searchQuery.toLowerCase().split(/\s+/)
    const titleLower = result.title.toLowerCase()
    const allTags = [...result.tags, result.category.toLowerCase(), result.subCategory.toLowerCase()]

    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 2
      if (allTags.some(t => t.includes(word))) score += 1
    }

    if (allTags.some(t => t.includes(intent.category.toLowerCase()))) score += 3
    if (allTags.some(t => t.includes(intent.role.toLowerCase()))) score += 1

    return score
  }

  async searchAndScore(
    searchQuery: string,
    intent: { category: string; role: string; searchQuery: string },
  ): Promise<EpidemicSfxResult | null> {
    const results = await this.searchEpidemic(searchQuery, 10)
    if (results.length === 0) return null

    const scored = results.map(r => ({
      ...r,
      matchScore: this.scoreSfxMatch(r, intent),
    }))
    scored.sort((a, b) => b.matchScore - a.matchScore)

    return scored[0]
  }

  async buildSfxCatalogue(
    environment: string[],
    activities: string[],
    intensity: number,
  ): Promise<EpidemicSfxResult[]> {
    const queries: { query: string; category: string }[] = []

    queries.push({ query: 'cinematic impact hit', category: 'impact' })
    queries.push({ query: 'deep bass boom', category: 'impact' })
    queries.push({ query: 'fast whoosh transition', category: 'whoosh' })
    queries.push({ query: 'cinematic tension riser', category: 'riser' })

    if (environment.includes('outdoor') || environment.includes('nature')) {
      queries.push({ query: 'outdoor nature ambience birds', category: 'ambient' })
    }
    if (environment.includes('urban') || environment.includes('indoor')) {
      queries.push({ query: 'city urban ambience', category: 'ambient' })
    }
    if (environment.includes('venue') || environment.includes('restaurant')) {
      queries.push({ query: 'crowd restaurant ambience', category: 'ambient' })
    }
    if (environment.length === 0) {
      queries.push({ query: 'neutral room tone ambience', category: 'ambient' })
    }

    if (activities.includes('sport-action')) {
      queries.push({ query: 'sports crowd cheering', category: 'ambient' })
      queries.push({ query: 'athletic whoosh movement', category: 'whoosh' })
    }
    if (activities.includes('eating-drinking')) {
      queries.push({ query: 'restaurant foley glass clink', category: 'foley' })
    }
    if (activities.includes('creative-process') || activities.includes('working')) {
      queries.push({ query: 'workshop tools foley', category: 'foley' })
    }

    if (intensity > 60) {
      queries.push({ query: 'electronic bass drop impact', category: 'impact' })
      queries.push({ query: 'dramatic orchestral riser', category: 'riser' })
    }

    const catalogue: EpidemicSfxResult[] = []
    const seen = new Set<string>()

    const searches = queries.map(async ({ query, category }) => {
      const results = await this.searchEpidemic(query, 3)
      for (const r of results) {
        if (!seen.has(r.id)) {
          seen.add(r.id)
          catalogue.push({ ...r, category: category || r.category })
        }
      }
    })
    await Promise.all(searches)

    return catalogue
  }

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
