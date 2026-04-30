import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export interface RankedMoment {
  timestamp: number
  score: number
  reason: string
}

interface VisionResult {
  description: string
  contentTags: string[]
  hasFaces: boolean
  faceCount: number
  hasSmiles: boolean
  hasAction: boolean
  bestMomentTimestamps: number[]
  rankedMoments: RankedMoment[]
  sceneType: string
  dominantColors: string[]
  composition: string
  emotionalTone: string
  shotType: string
  cameraMovement: string
  humanContent: string[]
  activityType: string[]
  environment: string
  lighting: string
  editUtility: string[]
}

const KEYFRAME_DIR = path.join(process.cwd(), '.keyframes')

export class VisionAnalysisService {
  private anthropic: Anthropic | null = null
  private lastApiKey: string | undefined = undefined

  constructor() {
    fs.mkdirSync(KEYFRAME_DIR, { recursive: true })
  }

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    if (apiKey !== this.lastApiKey) {
      this.anthropic = new Anthropic({ apiKey })
      this.lastApiKey = apiKey
    }
    return this.anthropic
  }

  async analyzeClipVision(
    filePath: string,
    clipId: string,
    duration: number,
  ): Promise<VisionResult> {
    const client = this.getClient()
    if (!client) {
      throw new Error('No Anthropic API key configured')
    }

    const sceneChanges = this.detectSceneChanges(filePath, duration)
    const keyframes = this.extractDenseKeyframes(filePath, clipId, duration, sceneChanges)
    if (keyframes.length === 0) {
      throw new Error('Could not extract keyframes from clip')
    }

    const imageBlocks: Anthropic.Messages.ImageBlockParam[] = keyframes.map(
      (kf) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: fs.readFileSync(kf.path, { encoding: 'base64' }),
        },
      }),
    )

    const timestampList = keyframes.map((kf) => `${kf.timestamp.toFixed(2)}s`).join(', ')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are ${keyframes.length} keyframes from a ${duration.toFixed(1)}s video clip, sampled at timestamps: ${timestampList}.
Some frames are at scene-change points (moments of visual change), others are evenly spaced for coverage.

Analyze them and respond with ONLY a JSON object:

{
  "description": "2-3 sentence natural description of what's happening",
  "contentTags": ["specific-tag-1", "specific-tag-2", ...],
  "hasFaces": true/false,
  "faceCount": number,
  "hasSmiles": true/false,
  "hasAction": true/false,
  "rankedMoments": [
    {"timestamp": 1.2, "score": 95, "reason": "peak expression — genuine laugh"},
    {"timestamp": 3.4, "score": 80, "reason": "strong composition — subject centred with depth"},
    {"timestamp": 0.5, "score": 60, "reason": "establishing context — wide venue shot"}
  ],
  "sceneType": "one of: interview, b-roll, establishing, action, detail, portrait, product, event, nature, interior, exterior, aerial",
  "dominantColors": ["color1", "color2", "color3"],
  "composition": "one of: wide, medium, close-up, extreme-close-up, overhead, low-angle",
  "emotionalTone": "one of: energetic, calm, dramatic, intimate, playful, professional, moody, warm, cool, neutral",
  "shotType": "one of: drone-aerial, wide, medium, close-up, extreme-close-up, macro, pov, over-shoulder, tracking",
  "cameraMovement": "one of: static, pan, tilt, dolly, handheld, gimbal-smooth, drone-orbit, crane, whip-pan",
  "humanContent": ["zero or more of: emotion-joy, emotion-focus, emotion-surprise, emotion-sadness, candid-moment, posed, interaction, solo, group, crowd"],
  "activityType": ["zero or more of: working, socialising, eating-drinking, sport-action, creative-process, presenting, conversation, walking, celebration, performing"],
  "environment": "one of: indoor, outdoor, urban, nature, studio, venue, office, retail, restaurant, residential",
  "lighting": "one of: golden-hour, daylight, overcast, night, artificial, mixed, backlit, dramatic",
  "editUtility": ["one or more of: b-roll, hero-shot, establishing, detail-insert, reaction, transition-friendly, opener, closer"]
}

CRITICAL — rankedMoments:
- Rank EVERY sampled timestamp by edit potential (score 0-100).
- Score based on: visual impact, emotional weight, compositional strength, uniqueness within the clip.
- A face mid-expression scores higher than a face at rest. A peak of action scores higher than wind-up or follow-through.
- An editor will use these scores to pick the best in/out points. Be precise — the difference between a 2.1s and a 2.4s in-point matters.
- Include ALL sampled timestamps in the ranking, not just the top few.

For cameraMovement: compare sequential frames. Similar framing = static. Shifting horizon = pan/tilt. Changing perspective = dolly/gimbal. Blur between frames = handheld/whip-pan.
For editUtility: hero-shot = visually striking, establishing = sets context, detail-insert = texture cutaway, reaction = response shot, transition-friendly = motion blur or movement good for cutting on, opener = strong first impression, closer = natural ending feel.`,
            },
          ],
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const parsed = JSON.parse(jsonMatch[0])

      const rankedMoments: RankedMoment[] = (parsed.rankedMoments || [])
        .map((m: any) => ({
          timestamp: Number(m.timestamp) || 0,
          score: Math.max(0, Math.min(100, Number(m.score) || 0)),
          reason: String(m.reason || ''),
        }))
        .sort((a: RankedMoment, b: RankedMoment) => b.score - a.score)

      const bestMoments = rankedMoments
        .slice(0, 3)
        .map((m: RankedMoment) => m.timestamp)

      return {
        description: parsed.description || '',
        contentTags: parsed.contentTags || [],
        hasFaces: parsed.hasFaces || false,
        faceCount: parsed.faceCount || 0,
        hasSmiles: parsed.hasSmiles || false,
        hasAction: parsed.hasAction || false,
        bestMomentTimestamps: bestMoments,
        rankedMoments,
        sceneType: parsed.sceneType || 'b-roll',
        dominantColors: parsed.dominantColors || [],
        composition: parsed.composition || 'medium',
        emotionalTone: parsed.emotionalTone || 'neutral',
        shotType: parsed.shotType || 'medium',
        cameraMovement: parsed.cameraMovement || 'static',
        humanContent: parsed.humanContent || [],
        activityType: parsed.activityType || [],
        environment: parsed.environment || 'outdoor',
        lighting: parsed.lighting || 'daylight',
        editUtility: parsed.editUtility || ['b-roll'],
      }
    } catch {
      return {
        description: text.slice(0, 200),
        contentTags: [],
        hasFaces: false,
        faceCount: 0,
        hasSmiles: false,
        hasAction: false,
        bestMomentTimestamps: [],
        rankedMoments: [],
        sceneType: 'b-roll',
        dominantColors: [],
        composition: 'medium',
        emotionalTone: 'neutral',
        shotType: 'medium',
        cameraMovement: 'static',
        humanContent: [],
        activityType: [],
        environment: 'outdoor',
        lighting: 'daylight',
        editUtility: ['b-roll'],
      }
    } finally {
      this.cleanupKeyframes(clipId)
    }
  }

  private detectSceneChanges(filePath: string, duration: number): number[] {
    try {
      const threshold = duration < 5 ? 0.2 : 0.3
      const output = execSync(
        `ffmpeg -i "${filePath}" -vf "select='gt(scene,${threshold})',showinfo" -f null - 2>&1`,
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
      )

      const timestamps: number[] = []
      const regex = /pts_time:(\d+\.?\d*)/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(output)) !== null) {
        const ts = parseFloat(match[1])
        if (ts > 0.1 && ts < duration - 0.1) {
          timestamps.push(Math.round(ts * 100) / 100)
        }
      }

      return timestamps
    } catch {
      return []
    }
  }

  private extractDenseKeyframes(
    filePath: string,
    clipId: string,
    duration: number,
    sceneChanges: number[],
  ): { path: string; timestamp: number }[] {
    const targetTimestamps = new Set<number>()

    for (const sc of sceneChanges) {
      targetTimestamps.add(Math.round(sc * 100) / 100)
    }

    const interval = duration < 3 ? 0.5 : duration < 10 ? 1.0 : duration < 30 ? 1.5 : 2.0
    for (let t = interval; t < duration - 0.1; t += interval) {
      const rounded = Math.round(t * 100) / 100
      let tooClose = false
      for (const existing of targetTimestamps) {
        if (Math.abs(existing - rounded) < interval * 0.4) {
          tooClose = true
          break
        }
      }
      if (!tooClose) targetTimestamps.add(rounded)
    }

    const maxFrames = duration < 3 ? 4 : duration < 10 ? 8 : duration < 30 ? 12 : 16
    const sorted = [...targetTimestamps].sort((a, b) => a - b).slice(0, maxFrames)

    const frames: { path: string; timestamp: number }[] = []

    for (let i = 0; i < sorted.length; i++) {
      const timestamp = sorted[i]
      const framePath = path.join(KEYFRAME_DIR, `${clipId}_${i}.jpg`)

      try {
        execSync(
          `ffmpeg -y -ss ${timestamp} -i "${filePath}" -vframes 1 -q:v 4 -vf "scale=512:-1" "${framePath}"`,
          { timeout: 10000, stdio: 'pipe' },
        )
        if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) {
          frames.push({ path: framePath, timestamp })
        }
      } catch {
        // Skip frames that fail
      }
    }

    return frames
  }

  private cleanupKeyframes(clipId: string) {
    try {
      const files = fs.readdirSync(KEYFRAME_DIR)
      for (const file of files) {
        if (file.startsWith(`${clipId}_`)) {
          fs.unlinkSync(path.join(KEYFRAME_DIR, file))
        }
      }
    } catch {
      // Non-critical
    }
  }
}
