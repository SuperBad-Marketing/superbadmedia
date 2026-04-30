import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const SKILLS_DIR = path.join(process.cwd(), 'skills')
fs.mkdirSync(SKILLS_DIR, { recursive: true })

const anthropic = new Anthropic()

interface SkillSeed {
  id: string
  title: string
  category: 'resolve-core' | 'editorial-craft' | 'integration'
  topics: string[]
  searchQueries: string[]
}

const SKILL_SEEDS: SkillSeed[] = [
  {
    id: 'resolve-scripting-api',
    title: 'Resolve Scripting API',
    category: 'resolve-core',
    topics: [
      'Connecting to Resolve via Python (DaVinciResolveScript module)',
      'MediaPool: add clips, create bins, set clip metadata',
      'Timeline: create, add clips, move playhead',
      'Render: add to render queue, set format/codec, start render',
      'Fusion tab access from scripting API',
      'Error handling patterns and API limitations',
    ],
    searchQueries: [
      'DaVinci Resolve scripting API Python tutorial',
      'DaVinci Resolve automation Python scripting complete guide',
    ],
  },
  {
    id: 'resolve-color-grading',
    title: 'Resolve Colour Grading',
    category: 'resolve-core',
    topics: [
      'Node tree architecture: serial, parallel, layer',
      'Primary colour wheels: lift, gamma, gain, offset',
      'Qualifier/keying: HSL qualifier, power windows',
      'LUT management: applying, creating, technical vs creative',
      'Colour matching between clips',
      'Scopes: waveform, vectorscope, histogram, parade',
    ],
    searchQueries: [
      'DaVinci Resolve colour grading complete workflow tutorial',
      'Cullen Kelly DaVinci Resolve colour grading node tree',
    ],
  },
  {
    id: 'resolve-fusion',
    title: 'Resolve Fusion',
    category: 'resolve-core',
    topics: [
      'Fusion node flow: MediaIn → processing → MediaOut',
      'Text+ node: animated titles, lower thirds',
      'Merge node: compositing, blend modes, masks',
      'Keyframe animation: spline editor, easing',
      'Macros: creating reusable templates',
    ],
    searchQueries: [
      'DaVinci Resolve Fusion motion graphics tutorial complete',
      'DaVinci Resolve Fusion text animation titles tutorial',
    ],
  },
  {
    id: 'resolve-fairlight',
    title: 'Resolve Fairlight',
    category: 'resolve-core',
    topics: [
      'Fairlight page layout: timeline, mixer, meters',
      'EQ and dynamics for dialogue',
      'Bus routing: dialogue, music, SFX submixes',
      'Audio ducking: music under dialogue',
      'Noise reduction and dialogue isolation',
      'Loudness standards: LUFS for YouTube',
    ],
    searchQueries: [
      'DaVinci Resolve Fairlight audio editing complete tutorial',
      'DaVinci Resolve Fairlight mixing dialogue music ducking',
    ],
  },
  {
    id: 'resolve-media-management',
    title: 'Resolve Media Management',
    category: 'resolve-core',
    topics: [
      'Media pool organisation: bins, smart bins',
      'Metadata workflow: scene, shot, take, keywords',
      'Proxy media vs optimised media',
      'Project database: local vs network, backup',
    ],
    searchQueries: [
      'DaVinci Resolve media management project organisation tutorial',
      'DaVinci Resolve proxy workflow media pool organisation',
    ],
  },
  {
    id: 'editorial-pacing',
    title: 'Editorial Pacing',
    category: 'editorial-craft',
    topics: [
      'Cut motivation: why you cut matters more than when',
      'Hold times by content type',
      'Beat-synced editing: cutting on beats and across bars',
      'Energy curves: building tension and release',
      'J-cuts and L-cuts for flow',
      'Pacing by genre: commercial, documentary, social',
    ],
    searchQueries: [
      'This Guy Edits editorial pacing rhythm when to cut',
      'video editing pacing rhythm theory techniques tutorial',
    ],
  },
  {
    id: 'color-grading-creative',
    title: 'Colour Grading — Creative',
    category: 'editorial-craft',
    topics: [
      'Look development from reference images',
      'Colour psychology: warm vs cool, what each communicates',
      'Genre conventions: teal/orange, desaturated, high-key',
      'Skin tone protection while pushing creative grades',
      'Film emulation: achieving authentic film looks',
      'Consistency across a project',
    ],
    searchQueries: [
      'creative colour grading look development cinematic tutorial',
      'Darren Mostyn cinematic colour grading breakdown DaVinci Resolve',
    ],
  },
  {
    id: 'sound-design-craft',
    title: 'Sound Design',
    category: 'editorial-craft',
    topics: [
      'SFX categories: impacts, risers, transitions, ambience, foley',
      'Layering: combining multiple SFX for depth',
      'When silence works: strategic removal of all sound',
      'Room tone: ambient beds, matching between shots',
      'Volume relationships: dialogue vs music vs SFX hierarchy',
      'Transitions via sound: using audio to bridge visual cuts',
    ],
    searchQueries: [
      'sound design for video editors SFX layering tutorial',
      'cinematic sound design foley transitions video editing',
    ],
  },
  {
    id: 'transition-language',
    title: 'Transition Language',
    category: 'editorial-craft',
    topics: [
      'Hard cut: continuation, new information, reaction',
      'Dissolve: passage of time, connection between ideas',
      'Match cut: shape, colour, movement, concept',
      'Smash cut: tonal contrast for comedy or shock',
      'Jump cut: intentional vs accidental',
      'Motion graphics transitions: when they help vs template feel',
    ],
    searchQueries: [
      'video editing transitions when to use which type tutorial',
      'Every Frame a Painting editing transitions film theory',
    ],
  },
  {
    id: 'music-editorial',
    title: 'Music Editorial',
    category: 'editorial-craft',
    topics: [
      'Music selection: matching energy and emotion to content',
      'Structure awareness: intro, verse, chorus, where to enter and exit',
      'Cutting to music: visual cuts on beats, transitions on phrases',
      'Energy matching: video energy mirrors music energy curve',
      'Music beds vs featured tracks',
      'Stems: using separated tracks for editorial flexibility',
    ],
    searchQueries: [
      'editing to music cutting on beats video editing tutorial',
      'music driven video editing workflow music selection tips',
    ],
  },
  {
    id: 'social-format-editing',
    title: 'Social Format Editing',
    category: 'editorial-craft',
    topics: [
      'Reframing: 16:9 master to 9:16 and 1:1',
      'Hook patterns: text, visual, audio hooks in first 1-3 seconds',
      'Platform pacing: Reels, YouTube, TikTok differences',
      'Caption placement and styling by platform',
      'Batch workflows: edit once, export multiple formats',
    ],
    searchQueries: [
      'social media video editing reels tiktok format reframing tutorial',
      'short form content editing hooks pacing vertical video',
    ],
  },
  {
    id: 'interview-multicam',
    title: 'Interview & Multicam',
    category: 'editorial-craft',
    topics: [
      'Multicam setup in Resolve: syncing, angle switching',
      'Cutaway timing: B-roll to cover edits and reinforce points',
      'Dead air removal: pauses, ums, false starts',
      'J-cuts and L-cuts in interview editing',
      'Reaction shots: when they add vs feel manufactured',
      'Paper edit to timeline: transcripts to rough cut',
    ],
    searchQueries: [
      'DaVinci Resolve multicam interview editing workflow tutorial',
      'interview editing techniques cutaways B-roll J-cut L-cut',
    ],
  },
  {
    id: 'epidemic-sound-api',
    title: 'Epidemic Sound API',
    category: 'integration',
    topics: [
      'Search: query by mood, genre, tempo, energy',
      'Track metadata: BPM, key, energy level, genre tags',
      'Stems download: separated tracks',
      'Licensing: subscription coverage, attribution rules',
      'Rate limits and best practices',
    ],
    searchQueries: [
      'Epidemic Sound music licensing content creators how to use',
      'Epidemic Sound workflow tutorial music selection video editing',
    ],
  },
  {
    id: 'file-organisation-video',
    title: 'File Organisation for Video',
    category: 'integration',
    topics: [
      'Folder structure: footage, audio, graphics, exports, project files',
      'Naming conventions: date, project, client naming systems',
      'Ingest workflow: card dump, verify, rename, organise, backup',
      'Archive strategy: what to keep, cold storage',
      'Proxy generation during ingest',
    ],
    searchQueries: [
      'video editor file management folder structure organisation tutorial',
      'professional video production file naming ingest workflow',
    ],
  },
  {
    id: 'ffmpeg-video-ops',
    title: 'FFmpeg Video Operations',
    category: 'integration',
    topics: [
      'Format conversion: container and codec',
      'Quick trims without re-encoding',
      'Batch processing: loop over files',
      'Proxy generation from camera originals',
      'Hardware acceleration: GPU encoding on Mac',
      'Filter graphs: crop, scale, overlay, text',
    ],
    searchQueries: [
      'FFmpeg video editing tutorial format conversion batch processing',
      'FFmpeg commands video editors proxy generation quick trim',
    ],
  },
]

function getYouTubeTranscript(url: string): string {
  const tmpId = crypto.randomUUID().slice(0, 8)
  const tmpBase = `/tmp/superedits-seed-${tmpId}`

  try {
    execSync(
      `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format srt --convert-subs srt -o "${tmpBase}" "${url}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 45000, maxBuffer: 10 * 1024 * 1024 }
    )

    for (const ext of ['.en.srt', '.en.vtt']) {
      const filePath = tmpBase + ext
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        try { fs.unlinkSync(filePath) } catch {}
        return cleanTranscript(content)
      }
    }
    return ''
  } catch {
    return ''
  }
}

function cleanTranscript(srt: string): string {
  return srt
    .replace(/^\[(?:youtube|download|info|warning|generic)].*/gm, '')
    .replace(/^Downloading .*/gm, '')
    .replace(/^\d+$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchYouTube(query: string, count: number): { id: string; title: string; channel: string }[] {
  const sanitized = query.replace(/["`$\\]/g, '')
  try {
    const result = execSync(
      `yt-dlp "ytsearch${count}:${sanitized}" --flat-playlist --dump-json --no-warnings 2>/dev/null`,
      { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    )
    return result
      .split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        const item = JSON.parse(line)
        return { id: item.id, title: item.title || '', channel: item.channel || item.uploader || '' }
      })
  } catch {
    return []
  }
}

async function distillForSkill(
  transcript: string,
  videoTitle: string,
  skill: SkillSeed
): Promise<{ title: string; content: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are building a knowledge base for a video editor's AI assistant called SuperEdits.

SKILL: "${skill.title}"
TOPICS THIS SKILL SHOULD COVER:
${skill.topics.map(t => `- ${t}`).join('\n')}

SOURCE VIDEO: "${videoTitle}"

TRANSCRIPT:
${transcript.slice(0, 10000)}

Distill this transcript into actionable knowledge that maps to the skill topics above. Output ONLY a JSON object:

{
  "title": "${skill.title}",
  "content": "Structured markdown with ## section headers for each major topic area. Use bullet points for techniques, tips, and patterns. Focus on ACTIONABLE knowledge — things the editor or AI can apply. Remove filler, self-promotion, and tangential content. If the transcript doesn't cover a topic, skip it rather than inventing content."
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return { title: skill.title, content: transcript.slice(0, 3000) }
}

async function seedSkill(skill: SkillSeed): Promise<boolean> {
  const existing = fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8')))
    .find((s: any) => s.name === skill.title)

  if (existing) {
    console.log(`  ⤳ Already exists, skipping`)
    return true
  }

  let bestTranscript = ''
  let bestVideoTitle = ''
  let bestVideoUrl = ''

  for (const query of skill.searchQueries) {
    console.log(`  Searching: "${query}"`)
    const results = searchYouTube(query, 3)

    for (const video of results) {
      console.log(`  Trying: "${video.title}" (${video.channel})`)
      const transcript = getYouTubeTranscript(`https://youtube.com/watch?v=${video.id}`)

      if (transcript.length > bestTranscript.length && transcript.length > 500) {
        bestTranscript = transcript
        bestVideoTitle = video.title
        bestVideoUrl = `https://youtube.com/watch?v=${video.id}`
        if (transcript.length > 3000) break
      }
    }

    if (bestTranscript.length > 3000) break
  }

  if (bestTranscript.length < 200) {
    console.log(`  ✗ No usable transcript found`)
    return false
  }

  console.log(`  Distilling from: "${bestVideoTitle}" (${bestTranscript.length} chars)`)

  const distilled = await distillForSkill(bestTranscript, bestVideoTitle, skill)

  const categoryMap: Record<string, 'resolve-core' | 'editorial-craft' | 'integration'> = {
    'resolve-core': 'resolve-core',
    'editorial-craft': 'editorial-craft',
    'integration': 'integration',
  }

  const skillFile = {
    id: crypto.randomUUID(),
    name: distilled.title || skill.title,
    category: categoryMap[skill.category],
    source: 'youtube' as const,
    sourceUrl: bestVideoUrl,
    content: distilled.content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topicCount: distilled.content.split('\n').filter(l => l.trim().startsWith('-')).length || 1,
  }

  fs.writeFileSync(path.join(SKILLS_DIR, `${skillFile.id}.json`), JSON.stringify(skillFile, null, 2))
  console.log(`  ✓ Saved: "${skillFile.name}" (${skillFile.topicCount} topics)`)
  return true
}

async function main() {
  console.log('SuperEdits Skill Seeder')
  console.log('======================')
  console.log(`Skills to seed: ${SKILL_SEEDS.length}`)
  console.log(`Skills directory: ${SKILLS_DIR}`)
  console.log()

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set in .env')
    process.exit(1)
  }

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < SKILL_SEEDS.length; i++) {
    const skill = SKILL_SEEDS[i]
    console.log(`[${i + 1}/${SKILL_SEEDS.length}] ${skill.title}`)

    try {
      const ok = await seedSkill(skill)
      if (ok) succeeded++
      else failed++
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`)
      failed++
    }

    console.log()
  }

  console.log('======================')
  console.log(`Done: ${succeeded} succeeded, ${failed} failed`)
}

main()
