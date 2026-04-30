import Anthropic from '@anthropic-ai/sdk'
import { ClipAnalysisService } from './clipAnalysis.js'
import crypto from 'crypto'

export interface BriefFields {
  duration: number
  platform: string
  mood: string
  pacing: 'fast' | 'medium' | 'slow'
  musicKeywords: string
  narrativeNotes: string
  clipSelectionHints: string
}

export interface AssembledResult {
  storyboardClips: {
    id: string
    clipId: string
    filePath: string
    fileName: string
    thumbnailPath: string
    duration: number
    width: number
    height: number
    fps: number
    codec: string
    startTime: number
    endTime: number
    position: number
    reason: string
  }[]
  musicQuery: string
  totalDuration: number
  narrative: string
}

const PARSE_SYSTEM = `You parse a video editing brief into structured fields. Respond with ONLY a JSON object.

Fields:
- "duration": target length in seconds (default 30)
- "platform": target platform — "instagram-reel", "youtube-short", "tiktok", "youtube", "linkedin", "facebook", "generic" (default "instagram-reel")
- "mood": one or two words describing the emotional tone (e.g. "high-energy", "warm", "cinematic", "playful")
- "pacing": "fast", "medium", or "slow"
- "musicKeywords": 2-4 word search query for finding a matching song (e.g. "upbeat electronic", "chill acoustic", "cinematic orchestral")
- "narrativeNotes": brief description of the narrative arc or structure the user wants
- "clipSelectionHints": what kinds of clips to prioritise (e.g. "exterior wide shots first, then detail close-ups, then people")

Example input: "pumping venue showcase for instagram, fast cuts, start wide then go tight on the details, electronic music"
Example output: {"duration":30,"platform":"instagram-reel","mood":"high-energy","pacing":"fast","musicKeywords":"upbeat electronic","narrativeNotes":"Open with wide exterior establishing shots, transition to interior details and close-ups","clipSelectionHints":"wide exterior shots first, then interior detail close-ups, dynamic movement preferred"}`

const CLIP_SCORING_SYSTEM = `You are scoring video clips for inclusion in an edit. Given a brief and a list of clips with their metadata, score each clip 0-100 for relevance and assign a narrative position.

Respond with ONLY a JSON array of objects: [{"clipId": "...", "score": 0-100, "position": "opening"|"buildup"|"peak"|"resolution"|"closing", "reason": "one sentence"}]

Scoring guidance:
- Higher quality clips (sharpness, resolution) score higher
- Clips matching the brief's mood and content hints score higher
- Dynamic clips score higher for high-energy briefs, static for calm briefs
- Variety in shot types is important — don't pick 10 of the same angle
- Short clips (under 2s) are less useful unless the brief is very fast-paced
- Clips with good audio quality get a bonus if the brief mentions dialogue`

export class BriefAssembler {
  private clipAnalysis = new ClipAnalysisService()

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    return new Anthropic({ apiKey })
  }

  async parseBrief(braindump: string): Promise<BriefFields> {
    const client = this.getClient()
    if (!client) {
      return {
        duration: 30,
        platform: 'instagram-reel',
        mood: 'cinematic',
        pacing: 'medium',
        musicKeywords: 'cinematic',
        narrativeNotes: braindump,
        clipSelectionHints: '',
      }
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: PARSE_SYSTEM,
      messages: [{ role: 'user', content: braindump }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

    return {
      duration: parsed.duration || 30,
      platform: parsed.platform || 'instagram-reel',
      mood: parsed.mood || 'cinematic',
      pacing: parsed.pacing || 'medium',
      musicKeywords: parsed.musicKeywords || 'cinematic',
      narrativeNotes: parsed.narrativeNotes || '',
      clipSelectionHints: parsed.clipSelectionHints || '',
    }
  }

  async assemble(brief: BriefFields): Promise<AssembledResult> {
    const allClips = this.clipAnalysis.getAllAnalysed()

    if (allClips.length === 0) {
      return {
        storyboardClips: [],
        musicQuery: brief.musicKeywords,
        totalDuration: 0,
        narrative: 'No analysed clips available. Import and ingest footage first.',
      }
    }

    const client = this.getClient()
    if (!client) {
      return this.assembleByHeuristics(allClips, brief)
    }

    const clipSummaries = allClips.map(c => ({
      id: c.id,
      fileName: c.fileName,
      duration: Math.round(c.duration * 10) / 10,
      resolution: `${c.width}x${c.height}`,
      fps: c.fps,
      tags: c.analysis?.contentTags || [],
      movement: c.analysis?.movementLevel || 'medium',
      energy: c.analysis?.energyLevel || 50,
      quality: c.analysis?.qualityRating || 3,
      sharpness: c.analysis?.sharpness || 50,
      audioQuality: c.analysis?.audioQuality || 'none',
    }))

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: CLIP_SCORING_SYSTEM,
        messages: [{
          role: 'user',
          content: `Brief:
- Mood: ${brief.mood}
- Pacing: ${brief.pacing}
- Duration target: ${brief.duration}s
- Narrative: ${brief.narrativeNotes}
- Clip hints: ${brief.clipSelectionHints}

Available clips (${clipSummaries.length} total):
${JSON.stringify(clipSummaries, null, 2)}

Select and score the best clips. Pick enough to fill ~${brief.duration}s total. Order by narrative position.`,
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
      const scored: { clipId: string; score: number; position: string; reason: string }[] =
        JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')

      return this.buildStoryboard(scored, allClips, brief)
    } catch {
      return this.assembleByHeuristics(allClips, brief)
    }
  }

  private buildStoryboard(
    scored: { clipId: string; score: number; position: string; reason: string }[],
    allClips: any[],
    brief: BriefFields,
  ): AssembledResult {
    const positionOrder = ['opening', 'buildup', 'peak', 'resolution', 'closing']

    const sorted = scored
      .filter(s => s.score >= 30)
      .sort((a, b) => {
        const posA = positionOrder.indexOf(a.position)
        const posB = positionOrder.indexOf(b.position)
        if (posA !== posB) return posA - posB
        return b.score - a.score
      })

    let accumulated = 0
    const storyboardClips: AssembledResult['storyboardClips'] = []

    const clipDuration = brief.pacing === 'fast' ? 2.5 : brief.pacing === 'slow' ? 6 : 4

    for (const entry of sorted) {
      if (accumulated >= brief.duration) break

      const clip = allClips.find(c => c.id === entry.clipId)
      if (!clip) continue

      const useDuration = Math.min(clip.duration, clipDuration, brief.duration - accumulated)
      if (useDuration < 0.5) continue

      storyboardClips.push({
        id: crypto.randomUUID(),
        clipId: clip.id,
        filePath: clip.filePath,
        fileName: clip.fileName,
        thumbnailPath: clip.thumbnailPath || '',
        duration: clip.duration,
        width: clip.width,
        height: clip.height,
        fps: clip.fps,
        codec: clip.codec,
        startTime: 0,
        endTime: useDuration,
        position: storyboardClips.length,
        reason: entry.reason,
      })

      accumulated += useDuration
    }

    return {
      storyboardClips,
      musicQuery: brief.musicKeywords,
      totalDuration: accumulated,
      narrative: `${storyboardClips.length} clips selected, ~${Math.round(accumulated)}s total. Pacing: ${brief.pacing}. Mood: ${brief.mood}.`,
    }
  }

  private assembleByHeuristics(allClips: any[], brief: BriefFields): AssembledResult {
    const sorted = [...allClips].sort((a, b) => {
      const qa = a.analysis?.qualityRating || 3
      const qb = b.analysis?.qualityRating || 3
      return qb - qa
    })

    const clipDuration = brief.pacing === 'fast' ? 2.5 : brief.pacing === 'slow' ? 6 : 4
    let accumulated = 0
    const storyboardClips: AssembledResult['storyboardClips'] = []

    for (const clip of sorted) {
      if (accumulated >= brief.duration) break

      const useDuration = Math.min(clip.duration, clipDuration, brief.duration - accumulated)
      if (useDuration < 0.5) continue

      storyboardClips.push({
        id: crypto.randomUUID(),
        clipId: clip.id,
        filePath: clip.filePath,
        fileName: clip.fileName,
        thumbnailPath: clip.thumbnailPath || '',
        duration: clip.duration,
        width: clip.width,
        height: clip.height,
        fps: clip.fps,
        codec: clip.codec,
        startTime: 0,
        endTime: useDuration,
        position: storyboardClips.length,
        reason: 'Selected by quality rating',
      })

      accumulated += useDuration
    }

    return {
      storyboardClips,
      musicQuery: brief.musicKeywords,
      totalDuration: accumulated,
      narrative: `${storyboardClips.length} clips selected by quality, ~${Math.round(accumulated)}s total.`,
    }
  }
}
