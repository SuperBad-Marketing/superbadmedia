import fs from 'fs'
import path from 'path'
import type { FootageProfile, BriefFields, MoodAxes } from './briefAssembler.js'
import type { MusicStructure } from './musicAnalysis.js'
import { dataPath } from './dataRoot.js'

export interface IntentQuestion {
  id: string
  category: 'structure' | 'grading' | 'audio' | 'titles' | 'pacing'
  question: string
  options: { label: string; value: string; description?: string }[]
  condition: string
  priority: number
}

export interface EditIntent {
  id: string
  projectId?: string
  clientId?: string
  answeredAt: string
  answers: Record<string, string>

  structure: {
    focus: 'place' | 'people' | 'both' | null
    droneUsage: 'open' | 'throughout' | 'close' | null
    peakMoment: 'intensity' | 'breath' | 'reveal' | null
    pacing: 'building' | 'consistent' | 'peaks-and-valleys' | null
  }

  grading: {
    look: 'natural' | 'warm' | 'cool' | 'punchy' | null
    consistency: 'match' | 'embrace-mix' | null
  }

  audio: {
    feel: 'polished' | 'immersive' | 'music-forward' | null
    backgroundNoise: 'clean' | 'keep' | 'subtle' | null
    musicLevel: 'front' | 'cinematic' | 'background' | null
  }

  titles: {
    textUsage: 'minimal' | 'throughout' | 'none' | null
  }
}

const QUESTION_CATALOGUE: IntentQuestion[] = [
  {
    id: 'structure-focus',
    category: 'structure',
    question: "What's the star of this video?",
    options: [
      { label: 'The place', value: 'place', description: "It's about the venue, location, or product" },
      { label: 'The people', value: 'people', description: "It's about the energy, faces, and interactions" },
      { label: 'Both equally', value: 'both', description: 'Weave between the space and the people in it' },
    ],
    condition: 'mixed-content',
    priority: 1,
  },
  {
    id: 'structure-drone',
    category: 'structure',
    question: "You've got aerial footage. How should it be used?",
    options: [
      { label: 'Open with it', value: 'open', description: 'Set the scene from above, then drop into the action' },
      { label: 'Sprinkle it through', value: 'throughout', description: 'Use it as breathing room between ground-level energy' },
      { label: 'Save it for the end', value: 'close', description: 'Build up to a pull-away or reveal finish' },
    ],
    condition: 'has-drone',
    priority: 2,
  },
  {
    id: 'structure-peak',
    category: 'structure',
    question: '',
    options: [
      { label: 'Peak intensity', value: 'intensity', description: 'Hit the viewer with your strongest visual' },
      { label: 'A breath', value: 'breath', description: 'Pull back so the energy lands in the music, not the visuals' },
      { label: 'A reveal', value: 'reveal', description: 'Something new appears for the first time' },
    ],
    condition: 'has-music-peak',
    priority: 2,
  },
  {
    id: 'structure-pacing',
    category: 'pacing',
    question: 'How should the energy flow through the edit?',
    options: [
      { label: 'Start slow, build up', value: 'building', description: 'Ease in, then accelerate toward the end' },
      { label: 'Steady energy throughout', value: 'consistent', description: 'Same intensity from start to finish' },
      { label: 'Peaks and valleys', value: 'peaks-and-valleys', description: 'Alternate between high-energy and breathing room' },
    ],
    condition: 'always',
    priority: 3,
  },
  {
    id: 'grading-look',
    category: 'grading',
    question: 'What look are you going for?',
    options: [
      { label: 'Clean and natural', value: 'natural', description: 'True-to-life colours, like being there in person' },
      { label: 'Warm and rich', value: 'warm', description: 'Golden tones, deep shadows, cinematic feel' },
      { label: 'Cool and moody', value: 'cool', description: 'Blue-tinted, desaturated, editorial vibe' },
      { label: 'High contrast punch', value: 'punchy', description: 'Bold colours, deep blacks, commercial energy' },
    ],
    condition: 'always',
    priority: 1,
  },
  {
    id: 'grading-consistency',
    category: 'grading',
    question: "Some clips were shot on different cameras. They'll look slightly different out of the box.",
    options: [
      { label: 'Match them', value: 'match', description: 'Make everything look like it came from one camera' },
      { label: 'Embrace the mix', value: 'embrace-mix', description: 'The different textures are part of the feel' },
    ],
    condition: 'mixed-cameras',
    priority: 2,
  },
  {
    id: 'audio-feel',
    category: 'audio',
    question: 'How should the audio feel?',
    options: [
      { label: 'Polished', value: 'polished', description: 'Clean and balanced, like a TV spot or brand video' },
      { label: 'Immersive', value: 'immersive', description: "You can hear the room, the atmosphere, the space you're in" },
      { label: 'Music-forward', value: 'music-forward', description: 'The song drives everything, other audio sits underneath' },
    ],
    condition: 'always',
    priority: 1,
  },
  {
    id: 'audio-noise',
    category: 'audio',
    question: 'Some clips have background noise — room chatter, traffic, ambient sound.',
    options: [
      { label: 'Clean it up', value: 'clean', description: 'I want a polished final product' },
      { label: 'Keep it', value: 'keep', description: 'It adds to the atmosphere' },
      { label: 'Keep it subtle', value: 'subtle', description: 'Leave a hint of it but mostly clean' },
    ],
    condition: 'has-ambient-noise',
    priority: 2,
  },
  {
    id: 'audio-music-level',
    category: 'audio',
    question: 'When the music plays, how present should it feel?',
    options: [
      { label: 'Front and centre', value: 'front', description: 'Like a music video — the song is the star' },
      { label: 'Cinematic', value: 'cinematic', description: 'Present and emotional, but not overpowering' },
      { label: 'In the background', value: 'background', description: 'Sets the mood but stays out of the way' },
    ],
    condition: 'has-music',
    priority: 2,
  },
  {
    id: 'titles-usage',
    category: 'titles',
    question: 'Do you want text in the video?',
    options: [
      { label: 'Minimal', value: 'minimal', description: 'A title at the start, maybe a logo at the end' },
      { label: 'Throughout', value: 'throughout', description: 'Lower thirds, captions, call-to-action overlays' },
      { label: 'No text', value: 'none', description: 'Let the visuals speak' },
    ],
    condition: 'always',
    priority: 3,
  },
]

interface AnalysisContext {
  footageProfile: FootageProfile
  musicStructure: MusicStructure | null
  brief: BriefFields
  clipCount: number
  cameras: string[]
  hasDialogue: boolean
  hasAmbientNoise: boolean
}

export class EditIntentService {
  generateQuestions(context: AnalysisContext): IntentQuestion[] {
    const applicable: IntentQuestion[] = []

    for (const q of QUESTION_CATALOGUE) {
      if (!this.conditionMet(q.condition, context)) continue

      const populated = { ...q }

      if (q.id === 'structure-peak' && context.musicStructure) {
        const peak = context.musicStructure.sections.find(s => s.energy === 'high' || s.type === 'drop')
        if (peak) {
          populated.question = `There's a big energy shift in the song at ${Math.round(peak.startTime)}s. What should that moment feel like?`
        } else {
          continue
        }
      }

      if (q.id === 'grading-look' && context.footageProfile.avgEnergy > 70) {
        populated.question = "Your footage has a lot of energy. What look suits it?"
      } else if (q.id === 'grading-look' && context.footageProfile.hasPersonContent && context.footageProfile.avgEnergy < 40) {
        populated.question = "This is intimate, people-focused footage. What feel are you after?"
      }

      applicable.push(populated)
    }

    return applicable.sort((a, b) => a.priority - b.priority)
  }

  private conditionMet(condition: string, ctx: AnalysisContext): boolean {
    switch (condition) {
      case 'always':
        return true
      case 'mixed-content':
        return ctx.footageProfile.hasPersonContent &&
          (ctx.footageProfile.dominantEnvironments.length > 0 || ctx.footageProfile.hasStaticContent)
      case 'has-drone':
        return ctx.footageProfile.hasDroneFootage
      case 'has-music-peak':
        return !!ctx.musicStructure?.sections.some(s => s.energy === 'high' || s.type === 'drop')
      case 'mixed-cameras':
        return ctx.cameras.length > 1
      case 'has-ambient-noise':
        return ctx.hasAmbientNoise
      case 'has-music':
        return !!ctx.musicStructure
      default:
        return false
    }
  }

  buildIntent(answers: Record<string, string>, projectId?: string, clientId?: string): EditIntent {
    return {
      id: crypto.randomUUID(),
      projectId,
      clientId,
      answeredAt: new Date().toISOString(),
      answers,

      structure: {
        focus: (answers['structure-focus'] as any) || null,
        droneUsage: (answers['structure-drone'] as any) || null,
        peakMoment: (answers['structure-peak'] as any) || null,
        pacing: (answers['structure-pacing'] as any) || null,
      },

      grading: {
        look: (answers['grading-look'] as any) || null,
        consistency: (answers['grading-consistency'] as any) || null,
      },

      audio: {
        feel: (answers['audio-feel'] as any) || null,
        backgroundNoise: (answers['audio-noise'] as any) || null,
        musicLevel: (answers['audio-music-level'] as any) || null,
      },

      titles: {
        textUsage: (answers['titles-usage'] as any) || null,
      },
    }
  }

  intentToAssemblyContext(intent: EditIntent): string {
    const lines: string[] = ['## EDITOR INTENT (from pre-edit questions)']

    if (intent.structure.focus) {
      const focusMap: Record<string, string> = {
        place: 'Focus on the venue/location/product. Use wide establishing shots, detail textures, environment shots. People are supporting cast.',
        people: 'Focus on people — faces, interactions, energy, emotion. Environments set context but people drive the story.',
        both: 'Balance between space and people. Alternate: establish the environment, then show the people in it.',
      }
      lines.push(`\nSTRUCTURE FOCUS: ${focusMap[intent.structure.focus]}`)
    }

    if (intent.structure.droneUsage) {
      const droneMap: Record<string, string> = {
        open: 'Open with aerial/drone footage to establish scale and location. Transition to ground level after the intro.',
        throughout: 'Use drone/aerial shots as breathers between ground-level sequences. They provide visual rest and scale contrast.',
        close: 'Save aerial footage for the ending. Build the ground-level story first, then pull back for a reveal/farewell shot.',
      }
      lines.push(`DRONE PLACEMENT: ${droneMap[intent.structure.droneUsage]}`)
    }

    if (intent.structure.peakMoment) {
      const peakMap: Record<string, string> = {
        intensity: 'At the music peak/drop, place the strongest, most impactful visual. Maximum energy. Hero shot.',
        breath: 'At the music peak/drop, pull back visually. Let the music carry the energy. Use a wide shot or a held moment.',
        reveal: 'At the music peak/drop, introduce something new — a location, a person, a product reveal. First appearance.',
      }
      lines.push(`PEAK MOMENT: ${peakMap[intent.structure.peakMoment]}`)
    }

    if (intent.structure.pacing) {
      const pacingMap: Record<string, string> = {
        building: 'Start with longer, slower shots. Progressively shorten cut lengths toward the end. Build momentum.',
        consistent: 'Maintain steady energy and cut rhythm throughout. No dramatic shifts in pacing.',
        'peaks-and-valleys': 'Alternate between high-energy fast-cut sections and slower breathing room. Create contrast.',
      }
      lines.push(`ENERGY FLOW: ${pacingMap[intent.structure.pacing]}`)
    }

    if (lines.length <= 1) return ''
    return lines.join('\n')
  }

  intentToGradingContext(intent: EditIntent): string {
    const lines: string[] = ['## GRADING INTENT']

    if (intent.grading.look) {
      const lookMap: Record<string, string> = {
        natural: 'Clean, true-to-life colour. Accurate skin tones. Neutral white balance. Minimal creative grading — just correct exposure and white balance. Let the footage speak.',
        warm: 'Push warmth into midtones and highlights. Golden hour feel. Rich shadows without crushing blacks. Skin tones lean warm. Think sunset, candlelight, nostalgia.',
        cool: 'Desaturate slightly. Blue-shift shadows. Cooler highlights. Editorial, fashion-forward. Skin tones stay neutral but environment goes cool. Think overcast, steel, moody.',
        punchy: 'Boost contrast. Saturate primary colours. Crush blacks slightly. Vivid, commercial, energetic. Everything pops. Think sports brand, fitness, food.',
      }
      lines.push(lookMap[intent.grading.look])
    }

    if (intent.grading.consistency) {
      const consistencyMap: Record<string, string> = {
        match: 'Match all clips to a consistent look regardless of source camera. Normalize white balance, exposure, and colour response across clips.',
        'embrace-mix': 'Allow natural differences between cameras. Different textures and responses add character. Only correct obvious mismatches.',
      }
      lines.push(`CAMERA MATCHING: ${consistencyMap[intent.grading.consistency]}`)
    }

    if (lines.length <= 1) return ''
    return lines.join('\n')
  }

  intentToAudioContext(intent: EditIntent): string {
    const lines: string[] = ['## AUDIO MIXING INTENT']

    if (intent.audio.feel) {
      const feelMap: Record<string, string> = {
        polished: 'Clean, balanced mix. Remove noise, normalize levels, compress for consistency. Broadcast quality. Dialogue is crystal clear, SFX are precise, music is well-balanced.',
        immersive: 'Preserve room tone and ambient sound. Let the environment breathe through the mix. Natural dynamics — not over-compressed. The viewer should feel like they are there.',
        'music-forward': 'Music is the primary audio layer. All other audio is secondary — duck it under the music or remove it. SFX are accents, not beds. Clean and simple.',
      }
      lines.push(feelMap[intent.audio.feel])
    }

    if (intent.audio.backgroundNoise) {
      const noiseMap: Record<string, string> = {
        clean: 'Apply noise reduction aggressively. Remove background chatter, traffic, HVAC, room tone. Clean audio only.',
        keep: 'Preserve ambient sound as-is. Background noise is intentional atmosphere. Only remove obvious problems (wind hits, handling noise).',
        subtle: 'Light noise reduction. Reduce background noise by ~50% — keep a hint of room atmosphere but clean up the mud.',
      }
      lines.push(`BACKGROUND NOISE: ${noiseMap[intent.audio.backgroundNoise]}`)
    }

    if (intent.audio.musicLevel) {
      const levelMap: Record<string, string> = {
        front: 'Music at -8 to -10 LUFS. Other audio ducked well underneath. Music drives the experience.',
        cinematic: 'Music at -14 to -16 LUFS. Present and emotional. Dialogue and key SFX can cut through when needed.',
        background: 'Music at -20 to -24 LUFS. Texture and mood only. Other audio layers are primary.',
      }
      lines.push(`MUSIC LEVEL: ${levelMap[intent.audio.musicLevel]}`)
    }

    if (lines.length <= 1) return ''
    return lines.join('\n')
  }

  intentToTitlesContext(intent: EditIntent): string {
    if (!intent.titles.textUsage || intent.titles.textUsage === 'none') return ''

    const map: Record<string, string> = {
      minimal: 'Title card at the start (brand/project name). Optional logo or tagline at the end. Nothing in between.',
      throughout: 'Title at start. Lower thirds to identify people or locations. End card with logo and CTA. Consider captions if dialogue is present.',
    }

    return `## TITLES INTENT\n${map[intent.titles.textUsage]}`
  }

  saveIntent(intent: EditIntent): void {
    const dir = dataPath('.taste', 'intents')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${intent.id}.json`), JSON.stringify(intent, null, 2), 'utf-8')
  }

  loadIntent(id: string): EditIntent | null {
    const filePath = dataPath('.taste', 'intents', `${id}.json`)
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }
}

let instance: EditIntentService | null = null

export function getEditIntentService(): EditIntentService {
  if (!instance) {
    instance = new EditIntentService()
  }
  return instance
}
