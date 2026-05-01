import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getClipAnalysisService } from './clipAnalysis.js'
import { SfxService } from './sfx.js'
import { TransitionService } from './transitions.js'
import { SkillService } from './skills.js'
import { MusicAnalysisService, MusicStructure, type MusicSection } from './musicAnalysis.js'
import { getMediaLibrary } from './mediaLibrary.js'
import { getTasteProfileService } from './tasteProfile.js'
import { getEditIntentService, type EditIntent } from './editIntent.js'
import crypto from 'crypto'

const CUT_REVIEW_DIR = path.join(process.cwd(), '.cut-review')

const MAX_CLIP_USES = 2

export interface MoodAxes {
  intensity: number
  intimacy: number
  chaos: number
}

export interface FootageProfile {
  dominantSceneTypes: string[]
  avgEnergy: number
  avgMovement: string
  hasPersonContent: boolean
  hasActionContent: boolean
  hasStaticContent: boolean
  emotionalRange: string[]
  suggestedApproach: string
  shotTypeBreakdown: string[]
  dominantEnvironments: string[]
  dominantActivities: string[]
  hasDroneFootage: boolean
  hasInteractions: boolean
  lightingMix: string[]
  editUtilityMap: string[]
}

export interface BriefFields {
  duration: number
  platform: string
  mood: string
  pacing: 'fast' | 'medium' | 'slow'
  musicKeywords: string
  narrativeNotes: string
  clipSelectionHints: string
  moodAxes?: MoodAxes
}

export interface SfxPlacementResult {
  id: string
  category: string
  role: string
  searchQuery: string
  timelineStart: number
  timelineEnd?: number
  volume: number
  fadeIn: number
  fadeOut: number
  reason: string
  epidemicTrack?: { id: string; title: string; previewUrl?: string }
}

export interface TransitionResult {
  id: string
  afterClipPosition: number
  presetId: string
  presetName: string
  duration: number
  reason: string
}

export interface AssembledResult {
  assemblyId: string
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
    audioOffset: number
    reason: string
  }[]
  sfxPlacements: SfxPlacementResult[]
  transitions: TransitionResult[]
  musicQuery: string
  totalDuration: number
  narrative: string
}

interface StructuralPlan {
  sections: {
    label: string
    musicSectionType?: string
    targetDuration: number
    clips: { clipId: string; role: string; targetDuration: number }[]
  }[]
  narrative: string
  rhythmStrategy: string
}

const PARSE_SYSTEM = `You parse a video editing brief into structured fields. Respond with ONLY a JSON object.

Fields:
- "duration": target length in seconds (default 30)
- "platform": target platform — "instagram-reel", "youtube-short", "tiktok", "youtube", "linkedin", "facebook", "generic" (default "instagram-reel")
- "mood": one or two words describing the emotional tone (e.g. "high-energy", "warm", "cinematic", "playful")
- "pacing": "fast", "medium", or "slow"
- "musicKeywords": 2-4 word search query for finding a matching song (e.g. "upbeat electronic", "chill acoustic", "cinematic orchestral")
- "narrativeNotes": the user's full description of what they want — preserve all detail about structure, timing, pacing patterns, shot order, and rhythm. Do not summarize or lose specifics.
- "clipSelectionHints": what kinds of clips to prioritise (e.g. "exterior wide shots first, then detail close-ups, then people")
- "moodAxes": decompose the emotional tone into three 0-100 axes:
  - "intensity": 0 = meditative/calm, 50 = engaged/moderate, 100 = explosive/maximal
  - "intimacy": 0 = epic/grand/distant, 50 = observational, 100 = personal/close/vulnerable
  - "chaos": 0 = controlled/precise/symmetrical, 50 = organic/natural, 100 = raw/unpredictable/frenetic`

function buildStructuralPlanSystem(
  footageProfile: FootageProfile,
  moodAxes: MoodAxes,
  musicStructure: MusicStructure | null,
  musicSkeleton: StructuralPlan | null,
): string {
  let musicInfo = ''
  let jobSection: string

  if (musicSkeleton && musicSkeleton.sections.length > 0) {
    musicInfo = `\n## MUSIC STRUCTURE (MANDATORY SCAFFOLD)

BPM: ${musicStructure!.bpm} | Beat interval: ${musicStructure!.beatInterval.toFixed(3)}s | Duration: ${musicStructure!.totalDuration.toFixed(1)}s

The following sections are LOCKED. Do NOT add, remove, merge, reorder, or rename them. Your ONLY job is to assign clips to these sections.

${musicSkeleton.sections.map(s => `### ${s.label} — ${s.targetDuration.toFixed(1)}s${s.musicSectionType ? ` (energy: ${musicStructure!.sections.find(ms => ms.type === s.musicSectionType)?.energy || 'medium'})` : ''}`).join('\n')}
`
    jobSection = `## YOUR JOB
1. The sections above are MANDATORY — use them exactly as given. Do NOT create new sections or change durations.
2. Assign clips to each section based on content, energy, and edit utility
3. Match clip energy to section energy — low-energy sections get breather/establishing clips, peak-energy sections get hero shots and high-movement clips
4. Specify each clip's role (opener, hero-shot, detail-insert, reaction, breather, transition-bridge, etc.)
5. Give approximate clip durations within each section — the precision editor will refine
6. Plan rhythm variety — mix staccato bursts, held moments, cascades, call-and-response across sections`
  } else {
    if (musicStructure && musicStructure.sections.length > 0) {
      musicInfo = `\n## MUSIC STRUCTURE

BPM: ${musicStructure.bpm} | Beat interval: ${musicStructure.beatInterval.toFixed(3)}s | Duration: ${musicStructure.totalDuration.toFixed(1)}s

Sections:
${musicStructure.sections.map(s => `- ${s.type} (${s.startTime.toFixed(1)}s – ${s.endTime.toFixed(1)}s) energy: ${s.energy}`).join('\n')}

Map your edit sections to these music sections. Low-energy music wants slower cuts and breathing room. High-energy sections want faster cuts. Drops are peak moments — put your strongest clips there.
`
    }
    jobSection = `## YOUR JOB
1. Divide the edit into 3-8 sections, each with a label and target duration that sum to the target
2. Assign clips to sections based on content, energy, and edit utility
3. Specify each clip's role (opener, hero-shot, detail-insert, reaction, breather, transition-bridge, etc.)
4. Give approximate durations — the precision editor will refine
5. If music structure is available, map sections to music section types
6. Plan rhythm variety — mix staccato bursts, held moments, cascades, call-and-response across sections`
  }

  return `You are a supervising editor creating a structural plan for a video edit. You decide WHICH clips to use, in WHAT order, for WHAT purpose. Another editor will handle precise in/out points, transitions, and SFX.

## EMOTIONAL SPACE
Intensity: ${moodAxes.intensity}/100 | Intimacy: ${moodAxes.intimacy}/100 | Chaos: ${moodAxes.chaos}/100

## FOOTAGE PROFILE
${footageProfile.suggestedApproach}
Dominant scenes: ${footageProfile.dominantSceneTypes.join(', ') || 'mixed'}
Shot types: ${footageProfile.shotTypeBreakdown.join(', ') || 'mixed'}
Environments: ${footageProfile.dominantEnvironments.join(', ') || 'varied'}
Activities: ${footageProfile.dominantActivities.join(', ') || 'general'}
Lighting: ${footageProfile.lightingMix.join(', ') || 'mixed'}
Has people: ${footageProfile.hasPersonContent} | Has drone: ${footageProfile.hasDroneFootage} | Has interactions: ${footageProfile.hasInteractions}
Edit roles: ${footageProfile.editUtilityMap.join(', ') || 'b-roll'}
${musicInfo}
${jobSection}

## CLIP SELECTION RULES
- Use editUtility tags: "opener" clips early, "closer" clips late, "establishing" at section starts
- Contrast environments across sections (indoor→outdoor, urban→nature)
- Never cluster 3+ clips of the same shotType consecutively
- Faces need 1.5s+ to read emotion — assign them longer target durations
- High-movement clips suit shorter holds; static/composed clips suit longer holds
- You MAY reuse the same clip in different sections for different moments
- Select more clips than strictly needed — the precision editor may drop some
- Each clip has a "timesUsed" count. STRONGLY prefer clips with timesUsed: 0. Clips with timesUsed >= ${MAX_CLIP_USES} are EXCLUDED and will not appear in the list.

Respond with ONLY a JSON object:
{
  "sections": [
    {
      "label": "intro-establish",
      "musicSectionType": "intro",
      "targetDuration": 4.0,
      "clips": [
        { "clipId": "uuid", "role": "establishing-aerial", "targetDuration": 3.0 },
        { "clipId": "uuid", "role": "detail-texture", "targetDuration": 1.0 }
      ]
    }
  ],
  "narrative": "one sentence describing the edit's arc",
  "rhythmStrategy": "describe the rhythm patterns planned for each section"
}`
}

function buildAssemblySystem(
  skills: string,
  footageProfile: FootageProfile,
  moodAxes: MoodAxes,
  variationSeed: number,
  musicStructure: MusicStructure | null,
  structuralPlan: StructuralPlan | null,
  tasteContext: string = '',
): string {
  let musicSection = ''
  if (musicStructure) {
    const beatExamples = musicStructure.beats.length > 4
      ? `\nBeat grid (first 20): ${musicStructure.beats.slice(0, 20).map(b => b.toFixed(3) + 's').join(', ')}`
      : ''
    musicSection = `\n## MUSIC BEAT GRID

BPM: ${musicStructure.bpm} | Beat interval: ${musicStructure.beatInterval.toFixed(3)}s
${beatExamples}

Sections:
${musicStructure.sections.map(s => `- ${s.type} (${s.startTime.toFixed(1)}s – ${s.endTime.toFixed(1)}s) energy: ${s.energy}`).join('\n')}

ALIGN CUTS TO BEATS. Major cuts land on beat boundaries (multiples of ${musicStructure.beatInterval.toFixed(3)}s). Held shots = beat-multiple durations (2 beats = ${(musicStructure.beatInterval * 2).toFixed(3)}s, 4 beats = ${(musicStructure.beatInterval * 4).toFixed(3)}s). Quick cuts in staccato sections can be half-beat (${(musicStructure.beatInterval / 2).toFixed(3)}s) or quarter-beat.
`
  }

  let planSection = ''
  if (structuralPlan) {
    planSection = `\n## STRUCTURAL PLAN (follow this structure)

${structuralPlan.sections.map(s =>
      `### ${s.label}${s.musicSectionType ? ` (music: ${s.musicSectionType})` : ''} — ~${s.targetDuration}s\n${s.clips.map(c => `- clipId: ${c.clipId} | role: ${c.role} | ~${c.targetDuration}s`).join('\n')}`
    ).join('\n\n')}

Narrative: ${structuralPlan.narrative}
Rhythm strategy: ${structuralPlan.rhythmStrategy}

FOLLOW THIS PLAN. Use the clips assigned to each section in order. You may adjust durations and drop clips to hit the target duration, but maintain the overall structure and narrative arc.
`
  }

  return `You are an expert video editor and sound designer. You build rough cuts that feel like a real editor made them — rhythmic, intentional, alive. You also design the full sound layer.

YOUR #1 JOB: obey the user's timing instructions to the letter. If they say "0.1-0.3s fast cuts with 2-3s cinematic holds", you deliver EXACTLY that.

## EMOTIONAL PARAMETER SPACE (drives all decisions)

Intensity: ${moodAxes.intensity}/100 ${moodAxes.intensity < 30 ? '(calm, measured, deliberate)' : moodAxes.intensity < 70 ? '(engaged, purposeful)' : '(explosive, maximal, relentless)'}
Intimacy: ${moodAxes.intimacy}/100 ${moodAxes.intimacy < 30 ? '(epic, grand, sweeping)' : moodAxes.intimacy < 70 ? '(observational, balanced)' : '(personal, close, vulnerable)'}
Chaos: ${moodAxes.chaos}/100 ${moodAxes.chaos < 30 ? '(controlled, precise, polished)' : moodAxes.chaos < 70 ? '(organic, natural variation)' : '(raw, unpredictable, frenetic)'}

HOW THESE AXES MODULATE:
- Cut duration ranges: Higher intensity = shorter floor. Higher chaos = wider range between min and max.
- Hold duration after bursts: Higher intimacy = longer holds on faces/emotion. Lower intimacy = shorter, grander holds on wide shots.
- SFX density: Higher intensity = more layers. Higher chaos = more varied/unexpected SFX choices. Lower chaos = more cohesive/subtle.
- Transition frequency: Higher chaos = fewer transitions (hard cuts feel rawer). Lower chaos = more deliberate transitions.
- Shot selection: Higher intimacy = prioritise faces, hands, detail. Lower intimacy = prioritise wides, aerials, environments.
${musicSection}${planSection}
## FOOTAGE PROFILE

${footageProfile.suggestedApproach}
Dominant scenes: ${footageProfile.dominantSceneTypes.join(', ') || 'mixed'}
Shot types available: ${footageProfile.shotTypeBreakdown.join(', ') || 'mixed'}
Environments: ${footageProfile.dominantEnvironments.join(', ') || 'varied'}
Activities: ${footageProfile.dominantActivities.join(', ') || 'general'}
Lighting: ${footageProfile.lightingMix.join(', ') || 'mixed'}
Average energy: ${footageProfile.avgEnergy}/100 | Average movement: ${footageProfile.avgMovement}
Has people: ${footageProfile.hasPersonContent} | Has drone: ${footageProfile.hasDroneFootage} | Has interactions: ${footageProfile.hasInteractions}
Emotional range: ${footageProfile.emotionalRange.join(', ') || 'neutral'}
Edit roles available: ${footageProfile.editUtilityMap.join(', ') || 'b-roll'}

## CLIP SELECTION BY CLASSIFICATION

Each clip has classification fields — use them to make informed sequencing decisions:
- **shotType**: Sequence wide→medium→close for establishment. Drone-aerial for openers/breathers. Close-up for detail inserts.
- **cameraMovement**: Static anchors held moments. Handheld/whip-pan for fast sections. Gimbal-smooth for premium feel.
- **humanContent**: emotion-joy/candid-moment for warmth. Interaction clips at intimacy > 50. Group/crowd for energy peaks.
- **activityType**: Sequence related activities together. Conversation/socialising when intimacy > 60.
- **environment**: Contrast environments across sections. Don't cluster same-environment unless building a location sequence.
- **lighting**: Match within sections. Golden-hour/backlit for openers/closers.
- **editUtility**: "opener" early, "closer" late, "establishing" at section starts, "detail-insert" between wider shots, "hero-shot" for held moments.

## PRECISION EDITING WITH RANKED MOMENTS

Each clip includes rankedMoments — timestamps scored 0-100 by edit potential. USE THESE to pick in/out points:
- For held shots (1s+): centre the in/out window on the highest-scored moment
- For flash cuts (<0.5s): pick moments scored 60+ for visual impact
- For establishing shots: use moments scored high for composition
- NEVER default startTime to 0 — always use rankedMoments or bestMoments to find the interesting part

## VARIATION SEED: ${variationSeed}

Use this seed to make creative choices. Different seeds = different valid edits from the same footage.

## CLIP RULES
1. endTime - startTime = how long this clip plays in the edit (CUT DURATION).
2. startTime and endTime are seconds within the SOURCE clip. Use rankedMoments to pick the best section.
3. Every clip: startTime >= 0, endTime <= clip's total duration.
4. Total edit duration within 10% of target.
5. You MAY reuse the same clip at different in/out points for fast-cut sequences. Never reuse the exact same segment.
6. MATCH cut duration to footage: high-movement clips → shorter holds. Static/composed shots → longer holds. Faces → 1.5-3s minimum.
7. Each clip has a "timesUsed" count showing how many previous projects used it. STRONGLY prefer timesUsed: 0 clips. Clips at the usage cap are already excluded from the list.

## RHYTHM VOCABULARY (mix 2-3 patterns per 30s)
- **Staccato burst → breath**: 4-8 rapid cuts then one held shot.
- **Accelerating cascade**: Progressively shorter cuts building toward a peak.
- **Call and response**: Alternate between two shot types (wide/close, action/reaction).
- **Waltz rhythm**: Long-short-short or short-short-long groupings.
- **Bookend**: Same shot type opens and closes a section.
- **Deceleration**: Start fast, gradually lengthen into stillness.
- **Syncopation**: Cut between beats for tension, on beats for resolution.

## TRANSITION RULES
- Choose from AVAILABLE TRANSITIONS by presetId. Hard cuts are default.
- Chaos < 30: deliberate transitions at section boundaries. Chaos > 70: almost no transitions.
- Match style to moment: impact for energy shifts, dissolve for breath, whip for velocity.

## J-CUT AND L-CUT RULES
Every clip has an "audioOffset" field that controls whether its audio starts before or after the visual cut.

- **audioOffset: 0** = straight cut. Audio and video switch at the same frame. DEFAULT for most cuts.
- **audioOffset: negative (e.g. -0.5)** = J-CUT. The NEXT clip's audio starts playing 0.5s BEFORE its video appears. The viewer hears the incoming scene before seeing it.
- **audioOffset: positive (e.g. 0.4)** = L-CUT. The CURRENT clip's audio continues playing 0.4s AFTER its video ends. The viewer still hears the outgoing scene over the new visual.

WHEN TO USE J-CUTS (audio leads the eye):
- Cutting TO a clip with distinctive ambient sound (ocean, crowd, machinery) — let the sound pull the viewer in
- Cutting TO a clip where someone is speaking or reacting — hear the voice before seeing the face
- Entering a new environment — the new room/location's sound arrives before the image
- Building anticipation before a reveal

WHEN TO USE L-CUTS (audio lingers):
- Cutting AWAY FROM an emotional moment — let the feeling hold while the visual moves on
- Cutting AWAY FROM a speaker to show what they're describing or reacting to
- Leaving a distinctive environment — the sound fades out gradually rather than chopping off
- After a held shot with rich ambient sound — smooths the exit

WHEN TO USE STRAIGHT CUTS (audioOffset: 0):
- Fast-cut montages and staccato bursts — split-audio would muddy the rhythm
- Beat-aligned cuts where music is the primary audio — clip audio is secondary
- Flash cuts under 0.5s — too short for audio overlap to register
- Any cut where neither clip has meaningful audio (silent b-roll over music)

TYPICAL VALUES:
- J-cuts: -0.3 to -0.8s (short anticipation). Never more than -1.0s.
- L-cuts: 0.3 to 0.8s (brief linger). Never more than -1.0s.
- Use sparingly: 2-4 per 30s edit. Not every cut needs one. Overuse destroys the effect.

## SFX RULES
- Layer: ambient beds underneath, risers building to drops, impacts on hard cuts, foley for texture.
- SFX searchQuery = specific Epidemic Sound search terms.
- Ambient: timelineStart to timelineEnd. Accents: timelineStart only.
- Volume: ambient 0.2-0.4, risers 0.4-0.6, impacts 0.6-0.9, foley 0.3-0.5.
- Risers END at the moment of impact. Set timelineStart 2-8s before the hit.
- Max 2-3 simultaneous SFX.

${skills ? `## EDITORIAL KNOWLEDGE\n\n${skills}\n` : ''}${tasteContext ? `\n${tasteContext}\n` : ''}
Respond with ONLY a JSON object:
{
  "clips": [
    { "clipId": "uuid", "startTime": 1.2, "endTime": 1.5, "audioOffset": 0, "reason": "flash — runner's feet" },
    { "clipId": "uuid", "startTime": 3.0, "endTime": 5.5, "audioOffset": -0.5, "reason": "J-cut — ocean audio leads before the wide shot appears" }
  ],
  "transitions": [
    { "afterClipIndex": 4, "presetId": "wipe-whip", "duration": 0.4, "reason": "whip into cinematic hold" }
  ],
  "sfx": [
    { "category": "ambient", "role": "bed", "searchQuery": "outdoor crowd atmosphere", "timelineStart": 0, "timelineEnd": 30, "volume": 0.3, "reason": "continuous atmosphere" },
    { "category": "riser", "role": "accent", "searchQuery": "cinematic tension riser", "timelineStart": 3.0, "timelineEnd": 5.0, "volume": 0.5, "reason": "builds into first hold" },
    { "category": "impact", "role": "punctuation", "searchQuery": "deep bass impact hit", "timelineStart": 5.0, "volume": 0.8, "reason": "lands on the hold" }
  ],
  "narrative": "One sentence describing the edit's arc and the rhythm patterns used"
}`
}

function buildReviewSystem(): string {
  return `You are a quality-control editor reviewing a rough cut assembly. Check for mechanical errors and artistic issues, then return corrections.

## MECHANICAL CHECKS
- Total duration within 10% of target
- Every clip: startTime >= 0, endTime <= source duration, endTime > startTime
- No identical in/out segments reused
- SFX timelineStart values are within the edit duration
- No more than 3 simultaneous SFX at any point
- Transitions reference valid clip positions

## ARTISTIC CHECKS
- No 3+ consecutive clips with the same shotType (breaks visual variety)
- No 3+ consecutive clips with the same environment (monotonous)
- Faces/people clips held at least 1.2s (unreadable otherwise)
- At least 2 different rhythm patterns used (not monotonous pacing)
- SFX risers end at or before impact moments (not after)
- Section energy roughly matches music section energy (if music provided)

For each issue found, provide a specific fix. If the assembly is clean, approve it.

Respond with ONLY a JSON object:
{
  "approved": true/false,
  "issues": [
    {
      "type": "mechanical" | "artistic",
      "description": "what's wrong",
      "clipIndex": 3,
      "fix": { "field": "startTime", "value": 1.5 }
    }
  ]
}`
}

export class BriefAssembler {
  private clipAnalysis = getClipAnalysisService()
  private sfxService = new SfxService()
  private transitionService = new TransitionService()
  private skillService = new SkillService()
  private musicAnalysis = new MusicAnalysisService()

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
        moodAxes: { intensity: 50, intimacy: 50, chaos: 50 },
      }
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
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
      moodAxes: {
        intensity: this.clampAxis(parsed.moodAxes?.intensity ?? 50),
        intimacy: this.clampAxis(parsed.moodAxes?.intimacy ?? 50),
        chaos: this.clampAxis(parsed.moodAxes?.chaos ?? 50),
      },
    }
  }

  private clampAxis(v: number): number {
    return Math.max(0, Math.min(100, Math.round(v)))
  }

  buildFootageProfile(clips: any[]): FootageProfile {
    const tally = (items: string[]) => {
      const counts = new Map<string, number>()
      for (const s of items) counts.set(s, (counts.get(s) || 0) + 1)
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
    }

    const sceneTypes = clips.map(c => c.analysis?.sceneType || '').filter(Boolean)
    const dominantSceneTypes = tally(sceneTypes).slice(0, 4)

    const energies = clips.map(c => c.analysis?.energyLevel ?? 50)
    const avgEnergy = Math.round(energies.reduce((a: number, b: number) => a + b, 0) / (energies.length || 1))

    const movements = clips.map(c => c.analysis?.movementLevel || 'medium')
    const movementScores = movements.map((m: string) => m === 'high' ? 3 : m === 'medium' ? 2 : m === 'low' ? 1 : 0)
    const avgMovementScore = movementScores.reduce((a: number, b: number) => a + b, 0) / (movementScores.length || 1)
    const avgMovement = avgMovementScore > 2.3 ? 'high' : avgMovementScore > 1.3 ? 'medium' : 'low'

    const hasPersonContent = clips.some(c => c.analysis?.hasFaces || c.analysis?.hasSmiles)
    const hasActionContent = clips.some(c => c.analysis?.hasAction || c.analysis?.movementLevel === 'high')
    const hasStaticContent = clips.some(c => c.analysis?.movementLevel === 'static' || c.analysis?.movementLevel === 'low')
    const hasDroneFootage = clips.some(c => c.analysis?.shotType === 'drone-aerial' || c.analysis?.cameraMovement === 'drone-orbit')
    const hasInteractions = clips.some(c => (c.analysis?.humanContent || []).includes('interaction') || (c.analysis?.humanContent || []).includes('group'))

    const emotionalTones = [...new Set(clips.map(c => c.analysis?.emotionalTone || '').filter(Boolean))]

    const shotTypes = tally(clips.map(c => c.analysis?.shotType || '').filter(Boolean)).slice(0, 5)
    const environments = tally(clips.map(c => c.analysis?.environment || '').filter(Boolean)).slice(0, 4)
    const activities = tally(clips.flatMap(c => c.analysis?.activityType || []).filter(Boolean)).slice(0, 5)
    const lightingTypes = tally(clips.map(c => c.analysis?.lighting || '').filter(Boolean)).slice(0, 3)
    const utilities = tally(clips.flatMap(c => c.analysis?.editUtility || []).filter(Boolean)).slice(0, 6)

    let suggestedApproach: string
    if (hasDroneFootage && hasPersonContent) {
      suggestedApproach = 'Mixed aerial and ground-level footage. Use drone shots as establishing/transition breathers between people content. Alternate scale: aerial wide → ground close → aerial pull-back.'
    } else if (hasDroneFootage && !hasPersonContent) {
      suggestedApproach = 'Aerial-heavy footage. Let drone shots breathe — longer holds on reveals and orbits. Build rhythm through altitude and angle changes rather than fast cuts.'
    } else if (hasInteractions && hasPersonContent) {
      suggestedApproach = 'People-and-interaction footage. Capture the energy between people — hold on reactions, cut to detail for texture, use candid moments as anchors. Sequence: establishing → interaction → reaction → detail.'
    } else if (hasActionContent && avgEnergy > 60) {
      suggestedApproach = 'High-energy footage collection. Suited for rapid montage with kinetic rhythm. Let the movement drive cut timing — fast footage wants fast cuts.'
    } else if (hasPersonContent && !hasActionContent) {
      suggestedApproach = 'People-focused footage. Hold on faces to read emotion. Use detail shots (hands, expressions) as connective tissue between wider shots.'
    } else if (hasStaticContent && avgEnergy < 40) {
      suggestedApproach = 'Composed, contemplative footage. Let shots breathe. Build rhythm through juxtaposition and transitions rather than cut speed.'
    } else if (dominantSceneTypes.length > 3) {
      suggestedApproach = 'Diverse footage collection. Use variety as a strength — contrast scene types across cuts. Build sections around thematic groupings.'
    } else {
      suggestedApproach = 'Mixed footage. Balance fast and slow sections. Use the energy range in the clips to create natural tension and release.'
    }

    return {
      dominantSceneTypes,
      avgEnergy,
      avgMovement,
      hasPersonContent,
      hasActionContent,
      hasStaticContent,
      emotionalRange: emotionalTones.slice(0, 5),
      suggestedApproach,
      shotTypeBreakdown: shotTypes,
      dominantEnvironments: environments,
      dominantActivities: activities,
      hasDroneFootage,
      hasInteractions,
      lightingMix: lightingTypes,
      editUtilityMap: utilities,
    }
  }

  private loadSkillsForAssembly(selectedSkillIds?: string[]): string {
    const skills = selectedSkillIds && selectedSkillIds.length > 0
      ? this.skillService.getSkillsByIds(selectedSkillIds)
      : this.skillService.getLlmReadySkills()

    if (skills.length === 0) return ''

    const sorted = [...skills].sort((a, b) => {
      const aReady = a.llmReady === true ? 1 : 0
      const bReady = b.llmReady === true ? 1 : 0
      return bReady - aReady
    })

    let result = ''
    for (const s of sorted) {
      const block = `### ${s.name}\n${s.content}\n\n`
      if (result.length + block.length > 150000) break
      result += block
    }

    return result.trim()
  }

  autoSelectSkills(clips: any[], brief: BriefFields): string[] {
    const footageProfile = this.buildFootageProfile(clips)
    return this.skillService.autoSelectSkills(
      footageProfile,
      brief.pacing,
      brief.moodAxes?.intensity ?? 50,
    )
  }

  private async refineMotionCutPoints(result: AssembledResult, musicStructure: MusicStructure | null): Promise<void> {
    const beatSet = new Set<number>()
    if (musicStructure) {
      for (const beat of musicStructure.beats) {
        beatSet.add(Math.round(beat * 100))
      }
    }

    for (const clip of result.storyboardClips) {
      if (clip.endTime - clip.startTime < 0.5) continue
      if (clip.codec === 'static') continue

      const nudgeIn = this.findMotionRestPoint(clip.filePath, clip.startTime, clip.duration)
      const nudgeOut = this.findMotionRestPoint(clip.filePath, clip.endTime, clip.duration)

      if (nudgeIn !== null) {
        const timelinePos = this.clipTimelinePosition(result, clip.position)
        const onBeat = beatSet.has(Math.round((timelinePos) * 100))
        if (!onBeat) {
          const newStart = Math.max(0, nudgeIn)
          if (newStart < clip.endTime - 0.2) clip.startTime = newStart
        }
      }

      if (nudgeOut !== null) {
        const newEnd = Math.min(clip.duration, nudgeOut)
        if (newEnd > clip.startTime + 0.2) clip.endTime = newEnd
      }
    }

    result.totalDuration = result.storyboardClips.reduce(
      (sum, sc) => sum + (sc.endTime - sc.startTime), 0,
    )
  }

  private clipTimelinePosition(result: AssembledResult, position: number): number {
    let t = 0
    for (const sc of result.storyboardClips) {
      if (sc.position >= position) break
      t += sc.endTime - sc.startTime
    }
    return t
  }

  private findMotionRestPoint(filePath: string, timestamp: number, clipDuration: number): number | null {
    const windowSize = 0.15
    const searchStart = Math.max(0, timestamp - windowSize)
    const searchEnd = Math.min(clipDuration, timestamp + windowSize)
    const searchDuration = searchEnd - searchStart

    if (searchDuration < 0.05) return null

    try {
      const buf = execSync(
        `ffmpeg -ss ${searchStart.toFixed(3)} -t ${searchDuration.toFixed(3)} -i "${filePath}" -vf "scale=80:-1,format=gray" -f rawvideo -pix_fmt gray pipe:1 2>/dev/null`,
        { timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
      )

      const probe = execSync(
        `ffprobe -v quiet -select_streams v:0 -show_entries stream=height -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8', timeout: 5000 },
      ).trim()
      const srcHeight = parseInt(probe) || 720
      const scaledHeight = Math.round(srcHeight * (80 / 1920))
      const frameSize = 80 * Math.max(scaledHeight, 1)
      const frameCount = Math.floor(buf.length / frameSize)

      if (frameCount < 3) return null

      const fps = frameCount / searchDuration
      let minDiff = Infinity
      let minIdx = 0

      for (let i = 0; i < frameCount - 1; i++) {
        const a = buf.subarray(i * frameSize, (i + 1) * frameSize)
        const b = buf.subarray((i + 1) * frameSize, (i + 2) * frameSize)
        let diff = 0
        for (let p = 0; p < frameSize; p++) {
          diff += Math.abs(a[p] - b[p])
        }
        diff /= frameSize
        if (diff < minDiff) {
          minDiff = diff
          minIdx = i
        }
      }

      const restTimestamp = searchStart + (minIdx / fps)
      if (Math.abs(restTimestamp - timestamp) < 0.02) return null

      return Math.round(restTimestamp * 1000) / 1000
    } catch {
      return null
    }
  }

  private buildMusicSkeleton(musicStructure: MusicStructure, brief: BriefFields): StructuralPlan {
    const targetDuration = brief.duration
    const musicDuration = musicStructure.totalDuration
    const scale = targetDuration / musicDuration

    const sections = musicStructure.sections.map((ms, i) => {
      const sectionDuration = (ms.endTime - ms.startTime) * scale
      const label = musicStructure.sections.filter((s, j) => j <= i && s.type === ms.type).length > 1
        ? `${ms.type}-${musicStructure.sections.filter((s, j) => j <= i && s.type === ms.type).length}`
        : ms.type

      return {
        label,
        musicSectionType: ms.type,
        targetDuration: Math.round(sectionDuration * 10) / 10,
        clips: [],
      }
    })

    return {
      sections,
      narrative: '',
      rhythmStrategy: '',
    }
  }

  private recordClipUsage(result: AssembledResult, projectId?: string): void {
    if (!projectId) return
    const library = getMediaLibrary()
    const filePaths = result.storyboardClips.map(sc => sc.filePath)
    library.recordUsage(projectId, filePaths)
  }

  async assemble(
    brief: BriefFields,
    clientClips?: any[],
    options?: { musicBpm?: number; musicMood?: string[]; musicPreviewUrl?: string; musicDuration?: number; selectedSkillIds?: string[]; projectId?: string; clientId?: string; referenceStyleId?: string; editIntent?: EditIntent },
  ): Promise<AssembledResult> {
    const serverClips = this.clipAnalysis.getAllAnalysed()
    const rawClips = serverClips.length > 0 ? serverClips : (clientClips || [])

    const emptyResult: AssembledResult = {
      assemblyId: '',
      storyboardClips: [],
      sfxPlacements: [],
      transitions: [],
      musicQuery: brief.musicKeywords,
      totalDuration: 0,
      narrative: 'No analysed clips available. Import and ingest footage first.',
    }

    if (rawClips.length === 0) return emptyResult

    const library = getMediaLibrary()
    const usageCounts = library.getUsageCounts()

    const allClips = rawClips.filter((c: any) => {
      const uses = usageCounts.get(c.filePath) || 0
      return uses < MAX_CLIP_USES
    })

    if (allClips.length === 0) {
      return {
        ...emptyResult,
        narrative: `All ${rawClips.length} clips have reached the usage cap (${MAX_CLIP_USES} projects each). Add new footage to continue.`,
      }
    }

    const client = this.getClient()
    if (!client) return this.assembleByHeuristics(allClips, brief)

    const moodAxes = brief.moodAxes || { intensity: 50, intimacy: 50, chaos: 50 }
    const footageProfile = this.buildFootageProfile(allClips)
    const skillsContent = this.loadSkillsForAssembly(options?.selectedSkillIds)
    const variationSeed = Math.floor(Math.random() * 1000)

    let musicStructure: MusicStructure | null = null
    if (options?.musicBpm) {
      try {
        musicStructure = await this.musicAnalysis.analyzeTrack(
          options.musicPreviewUrl || null,
          options.musicBpm,
          options.musicDuration || brief.duration,
        )
      } catch (err: any) {
        console.error('Music analysis failed, continuing without:', err.message)
      }
    }

    const compactSummaries = allClips.map((c: any) => ({
      id: c.id,
      fileName: c.fileName,
      duration: Math.round(c.duration * 10) / 10,
      timesUsed: usageCounts.get(c.filePath) || 0,
      tags: (c.analysis?.contentTags || []).slice(0, 5),
      description: c.analysis?.description || '',
      movement: c.analysis?.movementLevel || 'medium',
      energy: c.analysis?.energyLevel || 50,
      quality: c.analysis?.qualityRating || 3,
      sceneType: c.analysis?.sceneType || '',
      emotionalTone: c.analysis?.emotionalTone || '',
      shotType: c.analysis?.shotType || '',
      cameraMovement: c.analysis?.cameraMovement || '',
      humanContent: c.analysis?.humanContent || [],
      activityType: c.analysis?.activityType || [],
      environment: c.analysis?.environment || '',
      lighting: c.analysis?.lighting || '',
      editUtility: c.analysis?.editUtility || [],
    }))

    const fullSummaries = allClips.map((c: any) => ({
      ...compactSummaries.find(s => s.id === c.id)!,
      fps: c.fps,
      composition: c.analysis?.composition || '',
      bestMoments: c.analysis?.bestMomentTimestamps || [],
      rankedMoments: (c.analysis?.rankedMoments || []).slice(0, 8),
    }))

    const transitionPresets = this.transitionService.getPresets().map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      duration: t.duration,
      description: t.description,
    }))

    const sfxCatalogue = await this.sfxService.buildSfxCatalogue(
      footageProfile.dominantEnvironments,
      footageProfile.dominantActivities,
      moodAxes.intensity,
    )
    const sfxCatalogueJson = sfxCatalogue.map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      tags: s.tags.slice(0, 5),
      duration: s.duration,
    }))

    const musicSkeleton = musicStructure && musicStructure.sections.length > 0
      ? this.buildMusicSkeleton(musicStructure, brief)
      : null

    const tasteService = getTasteProfileService()
    let tasteContext = tasteService.getTasteContext()
    if (options?.clientId) {
      tasteContext += '\n' + tasteService.getClientStyleContext(options.clientId)
    }
    if (options?.referenceStyleId) {
      tasteContext += '\n' + tasteService.getReferenceStyleContext(options.referenceStyleId)
    }
    if (options?.editIntent) {
      const intentService = getEditIntentService()
      tasteContext += '\n' + intentService.intentToAssemblyContext(options.editIntent)
    }

    try {
      const plan = await this.runStructuralPlan(
        client, brief, compactSummaries, footageProfile, moodAxes, musicStructure, musicSkeleton,
      )

      const assembled = await this.runPrecisionEdit(
        client, brief, fullSummaries, footageProfile, moodAxes, variationSeed,
        musicStructure, plan, skillsContent, transitionPresets, sfxCatalogueJson, tasteContext,
      )

      const result = this.buildFromEdits(
        assembled.clips || [], allClips, brief, assembled.narrative || '',
      )
      result.transitions = this.buildTransitions(assembled.transitions || [])
      result.sfxPlacements = await this.resolveSfx(assembled.sfx || [])

      await this.refineMotionCutPoints(result, musicStructure)

      const reviewed = await this.runSelfReview(
        client, result, brief, allClips, musicStructure,
      )

      const finalResult = await this.runCutPointVisualReview(client, reviewed, allClips)

      const assemblyId = crypto.randomUUID()
      finalResult.assemblyId = assemblyId

      tasteService.saveOriginalAssembly({
        id: assemblyId,
        projectId: options?.projectId,
        clientId: options?.clientId,
        timestamp: new Date().toISOString(),
        clips: finalResult.storyboardClips.map(sc => {
          const source = allClips.find((c: any) => c.id === sc.clipId)
          return {
            clipId: sc.clipId,
            filePath: sc.filePath,
            startTime: sc.startTime,
            endTime: sc.endTime,
            position: sc.position,
            shotType: source?.analysis?.shotType,
            hasFaces: source?.analysis?.hasFaces,
            environment: source?.analysis?.environment,
            movement: source?.analysis?.movementLevel,
          }
        }),
        transitions: finalResult.transitions.map(t => ({
          afterPosition: t.afterClipPosition,
          presetId: t.presetId,
        })),
        sfxCount: finalResult.sfxPlacements.length,
        totalDuration: finalResult.totalDuration,
        brief: { duration: brief.duration, mood: brief.mood, pacing: brief.pacing },
      })

      this.recordClipUsage(finalResult, options?.projectId)

      return finalResult
    } catch (err: any) {
      console.error('Two-pass assembly failed, falling back to heuristics:', err.message)
      const fallback = this.assembleByHeuristics(allClips, brief)
      this.recordClipUsage(fallback, options?.projectId)
      return fallback
    }
  }

  private async runStructuralPlan(
    client: Anthropic,
    brief: BriefFields,
    clips: any[],
    footageProfile: FootageProfile,
    moodAxes: MoodAxes,
    musicStructure: MusicStructure | null,
    musicSkeleton: StructuralPlan | null = null,
  ): Promise<StructuralPlan> {
    const system = buildStructuralPlanSystem(footageProfile, moodAxes, musicStructure, musicSkeleton)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages: [{
        role: 'user',
        content: `TARGET: ${brief.duration}s | Platform: ${brief.platform} | Mood: ${brief.mood} | Pacing: ${brief.pacing}

TIMING INSTRUCTIONS:
${brief.narrativeNotes}

${brief.clipSelectionHints ? `CLIP PREFERENCES: ${brief.clipSelectionHints}\n\n` : ''}${musicSkeleton ? `LOCKED SECTIONS (use these exactly — do not add, remove, or rename):\n${musicSkeleton.sections.map(s => `- ${s.label}: ${s.targetDuration}s`).join('\n')}\n\n` : ''}AVAILABLE CLIPS (${clips.length}):
${JSON.stringify(clips, null, 2)}

${musicSkeleton ? 'Fill clips into the locked sections above.' : `Create the structural plan now. Section durations must sum to ~${brief.duration}s.`}`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

    let plan: StructuralPlan = {
      sections: parsed.sections || [],
      narrative: parsed.narrative || '',
      rhythmStrategy: parsed.rhythmStrategy || '',
    }

    if (musicSkeleton) {
      plan = this.enforceMusicSkeleton(plan, musicSkeleton)
    }

    return plan
  }

  private enforceMusicSkeleton(plan: StructuralPlan, skeleton: StructuralPlan): StructuralPlan {
    if (plan.sections.length === skeleton.sections.length) return plan

    const enforced: StructuralPlan = {
      sections: skeleton.sections.map((skel) => {
        const match = plan.sections.find(s =>
          s.label === skel.label || s.musicSectionType === skel.musicSectionType
        )
        return {
          ...skel,
          clips: match?.clips || [],
        }
      }),
      narrative: plan.narrative,
      rhythmStrategy: plan.rhythmStrategy,
    }

    const assignedClipIds = new Set(enforced.sections.flatMap(s => s.clips.map(c => c.clipId)))
    const unassigned = plan.sections.flatMap(s => s.clips).filter(c => !assignedClipIds.has(c.clipId))

    if (unassigned.length > 0) {
      for (const clip of unassigned) {
        const emptiest = enforced.sections.reduce((a, b) =>
          a.clips.length <= b.clips.length ? a : b
        )
        emptiest.clips.push(clip)
      }
    }

    return enforced
  }

  private async runPrecisionEdit(
    client: Anthropic,
    brief: BriefFields,
    clips: any[],
    footageProfile: FootageProfile,
    moodAxes: MoodAxes,
    variationSeed: number,
    musicStructure: MusicStructure | null,
    plan: StructuralPlan,
    skills: string,
    transitionPresets: any[],
    sfxCatalogue: any[],
    tasteContext: string = '',
  ): Promise<{ clips: any[]; transitions: any[]; sfx: any[]; narrative: string }> {
    const system = buildAssemblySystem(
      skills, footageProfile, moodAxes, variationSeed, musicStructure, plan, tasteContext,
    )

    const musicLine = musicStructure
      ? `\nMUSIC: ${musicStructure.bpm} BPM | Beat interval: ${musicStructure.beatInterval.toFixed(3)}s`
      : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100000,
      system,
      messages: [{
        role: 'user',
        content: `TARGET: ${brief.duration}s | Platform: ${brief.platform} | Mood: ${brief.mood}
${musicLine}
TIMING INSTRUCTIONS (follow these EXACTLY):
${brief.narrativeNotes}

${brief.clipSelectionHints ? `CLIP PREFERENCES: ${brief.clipSelectionHints}\n\n` : ''}AVAILABLE CLIPS (${clips.length}) — use rankedMoments to pick precise in/out points:
${JSON.stringify(clips, null, 2)}

AVAILABLE TRANSITIONS:
${JSON.stringify(transitionPresets, null, 2)}

AVAILABLE SFX (pre-searched — prefer these, but write custom searchQuery for sounds not covered):
${JSON.stringify(sfxCatalogue, null, 2)}

Build the precision edit now. Follow the structural plan. Use rankedMoments to pick the best in/out points for each clip. Align cuts to the beat grid. Layer SFX.`,
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

    return {
      clips: parsed.clips || [],
      transitions: parsed.transitions || [],
      sfx: parsed.sfx || [],
      narrative: parsed.narrative || '',
    }
  }

  private async runSelfReview(
    client: Anthropic,
    result: AssembledResult,
    brief: BriefFields,
    allClips: any[],
    musicStructure: MusicStructure | null,
  ): Promise<AssembledResult> {
    const clipLookup = new Map(allClips.map(c => [c.id, c]))

    const reviewInput = {
      targetDuration: brief.duration,
      actualDuration: result.totalDuration,
      clips: result.storyboardClips.map(sc => {
        const source = clipLookup.get(sc.clipId)
        return {
          index: sc.position,
          clipId: sc.clipId,
          startTime: sc.startTime,
          endTime: sc.endTime,
          cutDuration: Math.round((sc.endTime - sc.startTime) * 1000) / 1000,
          sourceDuration: sc.duration,
          shotType: source?.analysis?.shotType || '',
          environment: source?.analysis?.environment || '',
          hasFaces: source?.analysis?.hasFaces || false,
        }
      }),
      sfxCount: result.sfxPlacements.length,
      transitionCount: result.transitions.length,
      musicSections: musicStructure?.sections || [],
    }

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: buildReviewSystem(),
        messages: [{
          role: 'user',
          content: `Review this assembly:\n${JSON.stringify(reviewInput, null, 2)}`,
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
      const review = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      if (review.approved || !review.issues?.length) return result

      const fixed = { ...result, storyboardClips: [...result.storyboardClips] }

      for (const issue of review.issues) {
        if (issue.clipIndex == null || !issue.fix) continue
        const clip = fixed.storyboardClips[issue.clipIndex]
        if (!clip) continue

        const source = clipLookup.get(clip.clipId)
        const maxDuration = source?.duration || clip.duration

        if (issue.fix.field === 'startTime' && typeof issue.fix.value === 'number') {
          const newStart = Math.max(0, Math.min(issue.fix.value, maxDuration - 0.1))
          if (newStart < clip.endTime) clip.startTime = newStart
        }
        if (issue.fix.field === 'endTime' && typeof issue.fix.value === 'number') {
          const newEnd = Math.max(clip.startTime + 0.1, Math.min(issue.fix.value, maxDuration))
          clip.endTime = newEnd
        }
        if (issue.fix.field === 'remove') {
          fixed.storyboardClips[issue.clipIndex] = null as any
        }
      }

      fixed.storyboardClips = fixed.storyboardClips.filter(Boolean)
      for (let i = 0; i < fixed.storyboardClips.length; i++) {
        fixed.storyboardClips[i].position = i
      }

      fixed.totalDuration = fixed.storyboardClips.reduce(
        (sum, sc) => sum + (sc.endTime - sc.startTime), 0,
      )

      return fixed
    } catch (err: any) {
      console.error('Self-review failed, returning unreviewed result:', err.message)
      return result
    }
  }

  private buildTransitions(raw: any[]): TransitionResult[] {
    const allPresets = this.transitionService.getPresets()
    return raw.map(t => {
      const preset = allPresets.find(p => p.id === t.presetId)
      return {
        id: crypto.randomUUID(),
        afterClipPosition: t.afterClipIndex ?? 0,
        presetId: t.presetId || 'dissolve-soft',
        presetName: preset?.name || t.presetId || 'Dissolve',
        duration: t.duration || preset?.duration || 0.5,
        reason: t.reason || '',
      }
    })
  }

  private async resolveSfx(raw: any[]): Promise<SfxPlacementResult[]> {
    const results: SfxPlacementResult[] = []

    const searches = raw.map(async (s: any) => {
      const intent = {
        category: s.category || 'impact',
        role: s.role || 'accent',
        searchQuery: s.searchQuery || '',
      }

      let epidemicTrack: { id: string; title: string; previewUrl?: string } | undefined

      if (intent.searchQuery) {
        const best = await this.sfxService.searchAndScore(intent.searchQuery, intent)
        if (best) {
          epidemicTrack = { id: best.id, title: best.title, previewUrl: best.previewUrl }
        }
      }

      results.push({
        id: crypto.randomUUID(),
        category: intent.category,
        role: intent.role,
        searchQuery: intent.searchQuery,
        timelineStart: s.timelineStart ?? 0,
        timelineEnd: s.timelineEnd,
        volume: s.volume ?? 0.5,
        fadeIn: s.category === 'ambient' ? 0.5 : 0.05,
        fadeOut: s.category === 'ambient' ? 1.0 : 0.2,
        reason: s.reason || '',
        epidemicTrack,
      })
    })
    await Promise.all(searches)

    return results.sort((a, b) => a.timelineStart - b.timelineStart)
  }

  private buildFromEdits(
    edits: { clipId: string; startTime: number; endTime: number; reason: string }[],
    allClips: any[],
    brief: BriefFields,
    narrative: string,
  ): AssembledResult {
    const storyboardClips: AssembledResult['storyboardClips'] = []
    let accumulated = 0

    for (const edit of edits) {
      const clip = allClips.find(c => c.id === edit.clipId)
      if (!clip) continue

      const startTime = Math.max(0, Math.min(edit.startTime, clip.duration - 0.1))
      const endTime = Math.max(startTime + 0.1, Math.min(edit.endTime, clip.duration))
      const useDuration = endTime - startTime

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
        startTime,
        endTime,
        position: storyboardClips.length,
        audioOffset: (edit as any).audioOffset ?? 0,
        reason: edit.reason,
      })

      accumulated += useDuration
    }

    return {
      assemblyId: '',
      storyboardClips,
      sfxPlacements: [],
      transitions: [],
      musicQuery: brief.musicKeywords,
      totalDuration: accumulated,
      narrative: narrative || `${storyboardClips.length} clips, ~${Math.round(accumulated)}s. ${brief.mood}, ${brief.pacing} pacing.`,
    }
  }

  private async runCutPointVisualReview(
    client: Anthropic,
    result: AssembledResult,
    allClips: any[],
  ): Promise<AssembledResult> {
    if (result.storyboardClips.length < 2) return result

    fs.mkdirSync(CUT_REVIEW_DIR, { recursive: true })

    const cutPairs: { index: number; outFrame: string; inFrame: string }[] = []

    for (let i = 0; i < result.storyboardClips.length - 1; i++) {
      const clipA = result.storyboardClips[i]
      const clipB = result.storyboardClips[i + 1]

      const outTimestamp = Math.max(0, clipA.endTime - 0.04)
      const inTimestamp = clipB.startTime + 0.04

      const outPath = path.join(CUT_REVIEW_DIR, `cut_${i}_out.jpg`)
      const inPath = path.join(CUT_REVIEW_DIR, `cut_${i}_in.jpg`)

      try {
        execSync(
          `ffmpeg -y -ss ${outTimestamp.toFixed(3)} -i "${clipA.filePath}" -frames:v 1 -q:v 2 "${outPath}" 2>/dev/null`,
          { timeout: 5000 },
        )
        execSync(
          `ffmpeg -y -ss ${inTimestamp.toFixed(3)} -i "${clipB.filePath}" -frames:v 1 -q:v 2 "${inPath}" 2>/dev/null`,
          { timeout: 5000 },
        )

        if (fs.existsSync(outPath) && fs.existsSync(inPath)) {
          cutPairs.push({ index: i, outFrame: outPath, inFrame: inPath })
        }
      } catch {
        // Skip this cut point if frame extraction fails
      }
    }

    if (cutPairs.length === 0) return result

    const BATCH_SIZE = 5
    const allIssues: { cutIndex: number; action: string; detail: string }[] = []

    for (let b = 0; b < cutPairs.length; b += BATCH_SIZE) {
      const batch = cutPairs.slice(b, b + BATCH_SIZE)

      const imageContent: Anthropic.Messages.ContentBlockParam[] = []
      for (const pair of batch) {
        const outData = fs.readFileSync(pair.outFrame)
        const inData = fs.readFileSync(pair.inFrame)

        imageContent.push(
          { type: 'text', text: `Cut ${pair.index} → ${pair.index + 1}:` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: outData.toString('base64') } },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: inData.toString('base64') } },
        )
      }

      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: `You review cut points in a video edit. For each pair of frames (last frame of outgoing clip, first frame of incoming clip), check:

1. VISUAL CONTINUITY — do the shots contrast enough to justify a cut? Two nearly identical frames = bad cut (jump cut).
2. FRAME QUALITY — is either frame blurry, overexposed, obstructed, or mid-blink?
3. COMPOSITIONAL CLASH — does the eye have to jump too far between frames? (e.g. subject hard-left then hard-right with no motivation)

For each cut, respond "ok" or flag the issue with an action:
- "nudge-out": push the outgoing clip's end point earlier (bad exit frame)
- "nudge-in": push the incoming clip's start point later (bad entry frame)
- "swap": the two clips would flow better in reversed order
- "extend": the outgoing clip is cut too short to read

Respond with ONLY a JSON array:
[{ "cut": 0, "status": "ok" }, { "cut": 1, "status": "issue", "action": "nudge-in", "detail": "incoming frame is motion-blurred" }]`,
          messages: [{ role: 'user', content: imageContent }],
        })

        const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
        const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')

        for (const item of parsed) {
          if (item.status === 'issue' && item.action) {
            allIssues.push({
              cutIndex: batch[0].index + (item.cut ?? 0),
              action: item.action,
              detail: item.detail || '',
            })
          }
        }
      } catch (err: any) {
        console.error('[CutReview] Vision batch failed:', err.message)
      }
    }

    // Clean up frame files
    for (const pair of cutPairs) {
      try { fs.unlinkSync(pair.outFrame) } catch {}
      try { fs.unlinkSync(pair.inFrame) } catch {}
    }

    if (allIssues.length === 0) return result

    const fixed = { ...result, storyboardClips: [...result.storyboardClips] }
    const clipLookup = new Map(allClips.map(c => [c.id, c]))

    for (const issue of allIssues) {
      const clipA = fixed.storyboardClips[issue.cutIndex]
      const clipB = fixed.storyboardClips[issue.cutIndex + 1]
      if (!clipA || !clipB) continue

      const sourceA = clipLookup.get(clipA.clipId)
      const sourceB = clipLookup.get(clipB.clipId)

      switch (issue.action) {
        case 'nudge-out': {
          const newEnd = clipA.endTime - 0.15
          if (newEnd > clipA.startTime + 0.2) clipA.endTime = Math.round(newEnd * 1000) / 1000
          break
        }
        case 'nudge-in': {
          const maxDur = sourceB?.duration || clipB.duration
          const newStart = clipB.startTime + 0.15
          if (newStart < clipB.endTime - 0.2 && newStart < maxDur) clipB.startTime = Math.round(newStart * 1000) / 1000
          break
        }
        case 'swap': {
          const posA = clipA.position
          const posB = clipB.position
          clipA.position = posB
          clipB.position = posA
          fixed.storyboardClips[issue.cutIndex] = clipB
          fixed.storyboardClips[issue.cutIndex + 1] = clipA
          break
        }
        case 'extend': {
          const maxDur = sourceA?.duration || clipA.duration
          const newEnd = Math.min(clipA.endTime + 0.3, maxDur)
          if (newEnd > clipA.endTime) clipA.endTime = Math.round(newEnd * 1000) / 1000
          break
        }
      }
    }

    fixed.totalDuration = fixed.storyboardClips.reduce(
      (sum, sc) => sum + (sc.endTime - sc.startTime), 0,
    )

    return fixed
  }

  private assembleByHeuristics(allClips: any[], brief: BriefFields): AssembledResult {
    const sorted = [...allClips].sort((a, b) => {
      const qa = a.analysis?.qualityRating || 3
      const qb = b.analysis?.qualityRating || 3
      return qb - qa
    })

    let accumulated = 0
    const storyboardClips: AssembledResult['storyboardClips'] = []
    let shortNext = true

    for (const clip of sorted) {
      if (accumulated >= brief.duration) break

      let useDuration: number
      if (brief.pacing === 'fast') {
        useDuration = shortNext ? 0.5 + Math.random() * 1 : 2 + Math.random() * 2
        shortNext = !shortNext
      } else if (brief.pacing === 'slow') {
        useDuration = 3 + Math.random() * 3
      } else {
        useDuration = 1.5 + Math.random() * 3
      }

      useDuration = Math.min(useDuration, clip.duration, brief.duration - accumulated)
      if (useDuration < 0.1) continue

      const maxStart = Math.max(0, clip.duration - useDuration)
      const startTime = maxStart > 0 ? Math.random() * maxStart : 0

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
        startTime: Math.round(startTime * 10) / 10,
        endTime: Math.round((startTime + useDuration) * 10) / 10,
        position: storyboardClips.length,
        audioOffset: 0,
        reason: 'Selected by quality rating',
      })

      accumulated += useDuration
    }

    return {
      assemblyId: '',
      storyboardClips,
      sfxPlacements: [],
      transitions: [],
      musicQuery: brief.musicKeywords,
      totalDuration: accumulated,
      narrative: `${storyboardClips.length} clips selected by quality, ~${Math.round(accumulated)}s total.`,
    }
  }
}
