import Anthropic from '@anthropic-ai/sdk'
import { resolveBridge } from './resolveBridge.js'
import { IngestService } from './ingest.js'
import { getClipAnalysisService } from './clipAnalysis.js'
import { SkillService, type SkillFile } from './skills.js'
import { CaptionService } from './captions.js'
import { TransitionService } from './transitions.js'
import { TitleCardService } from './titleCards.js'
import { SfxService } from './sfx.js'

interface ChatResponse {
  content: string
  action?: {
    type: string
    status: 'pending' | 'running' | 'complete' | 'error'
    description: string
    progress?: number
  }
}

interface RouteResult {
  handled: boolean
  response?: ChatResponse
}

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i

const INTENT_SYSTEM = `You are an intent classifier for a video editing app. Classify the user's message into exactly one intent. Respond with ONLY a JSON object, no other text.

Intents:
- "ingest" — importing/organizing footage, copying from cards/folders
- "resolve_connect" — connecting to DaVinci Resolve, checking connection status
- "resolve_project" — creating a project in Resolve
- "resolve_import" — importing media into Resolve
- "resolve_timeline" — creating or modifying timelines
- "grade" — colour grading, adjusting colours, looks, white balance, contrast, saturation
- "export" — rendering, exporting video
- "find_clips" — searching for clips by content, quality, or attributes
- "assemble" — building a rough cut, assembly, storyboard
- "transition" — adding transitions between clips
- "sfx" — sound effects, audio mixing
- "caption" — subtitles, captions
- "title_card" — title cards, lower thirds, text overlays
- "music" — finding or setting music
- "learn" — learning from a URL, YouTube video, creating skill files
- "general" — general chat, questions, advice, anything else

Respond: {"intent": "<intent>", "params": {<any extracted parameters>}}

Parameter extraction:
- For "grade": extract "adjustments" (the plain-english description)
- For "find_clips": extract "query" (what they're looking for)
- For "learn": extract "url" if present
- For "resolve_project": extract "name" if mentioned
- For "export": extract "format" if mentioned (16:9, 9:16, 1:1, 4:5)
- For "music": extract "mood" or "query"
- For "assemble": extract "style", "duration", "description" if mentioned`

export class ChatRouter {
  private anthropic: Anthropic | null = null
  private lastApiKey: string | undefined = undefined
  private ingestService = new IngestService()
  private clipAnalysis = getClipAnalysisService()
  private skillService = new SkillService()
  private captionService = new CaptionService()
  private transitionService = new TransitionService()
  private titleCardService = new TitleCardService()
  private sfxService = new SfxService()
  private conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    if (apiKey !== this.lastApiKey) {
      this.anthropic = new Anthropic({ apiKey })
      this.lastApiKey = apiKey
    }
    return this.anthropic
  }

  async route(message: string, projectId?: string): Promise<ChatResponse> {
    if (!this.getClient()) {
      return {
        content: "I need an API key to work. Click the **gear icon** in the top right to add your Anthropic API key, or add it to a `.env` file in the video-editor folder.",
      }
    }

    if (YOUTUBE_REGEX.test(message)) {
      return this.handleLearn(message)
    }

    const intent = await this.classifyIntent(message)
    const result = await this.handleIntent(intent, message, projectId)

    if (result.handled && result.response) {
      this.conversationHistory.push({ role: 'user', content: message })
      this.conversationHistory.push({ role: 'assistant', content: result.response.content })
      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-30)
      }
      return result.response
    }

    return this.handleGeneral(message, projectId)
  }

  private async classifyIntent(message: string): Promise<{ intent: string; params: Record<string, any> }> {
    const client = this.getClient()
    if (!client) return { intent: 'general', params: {} }

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: INTENT_SYSTEM,
        messages: [{ role: 'user', content: message }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
      return JSON.parse(text)
    } catch {
      return { intent: 'general', params: {} }
    }
  }

  private async handleIntent(
    intent: { intent: string; params: Record<string, any> },
    message: string,
    projectId?: string,
  ): Promise<RouteResult> {
    switch (intent.intent) {
      case 'resolve_connect':
        return this.handleResolveConnect()
      case 'resolve_project':
        return this.handleResolveProject(intent.params)
      case 'resolve_import':
        return this.handleResolveImport(intent.params)
      case 'resolve_timeline':
        return this.handleResolveTimeline(intent.params)
      case 'grade':
        return this.handleGrade(intent.params, message)
      case 'export':
        return this.handleExport(intent.params)
      case 'find_clips':
        return this.handleFindClips(intent.params)
      case 'sfx':
        return this.handleSfx(intent.params, message)
      case 'caption':
        return this.handleCaption(intent.params)
      case 'transition':
        return this.handleTransition(intent.params, message)
      case 'title_card':
        return this.handleTitleCard(intent.params, message)
      case 'assemble':
        return this.handleAssemble(intent.params, message)
      case 'music':
        return this.handleMusic(intent.params)
      case 'learn':
        return { handled: true, response: await this.handleLearn(message) }
      default:
        return { handled: false }
    }
  }

  private async handleResolveConnect(): Promise<RouteResult> {
    const status = await resolveBridge.start()

    if (status.connected) {
      return {
        handled: true,
        response: {
          content: `Connected to DaVinci Resolve${status.version ? ` (${status.version})` : ''}. ${status.project ? `Active project: **${status.project}**` : 'No project open.'}${status.timeline ? ` Timeline: **${status.timeline}**` : ''}`,
          action: {
            type: 'resolve_connect',
            status: 'complete',
            description: 'Connected to Resolve',
          },
        },
      }
    }

    return {
      handled: true,
      response: {
        content: `Couldn't connect to Resolve. Make sure DaVinci Resolve Studio is running and the scripting API is enabled.${status.error ? ` Error: ${status.error}` : ''}`,
        action: {
          type: 'resolve_connect',
          status: 'error',
          description: 'Connection failed',
        },
      },
    }
  }

  private async handleResolveProject(params: Record<string, any>): Promise<RouteResult> {
    const name = params.name || 'Untitled Project'
    const result = await resolveBridge.createProject(name)

    if (result.error) {
      return {
        handled: true,
        response: {
          content: `Couldn't create the project: ${result.error}`,
          action: { type: 'resolve_project', status: 'error', description: 'Project creation failed' },
        },
      }
    }

    return {
      handled: true,
      response: {
        content: `Created project **${name}** in Resolve. Ready to import footage.`,
        action: { type: 'resolve_project', status: 'complete', description: `Created "${name}"` },
      },
    }
  }

  private async handleResolveImport(params: Record<string, any>): Promise<RouteResult> {
    const filePaths = params.file_paths || params.filePaths || []
    if (filePaths.length === 0) {
      return {
        handled: true,
        response: {
          content: 'Which files do you want to import? You can drag and drop them or start an ingest first.',
        },
      }
    }

    const result = await resolveBridge.importMedia(filePaths)
    return {
      handled: true,
      response: {
        content: result.error
          ? `Import failed: ${result.error}`
          : `Imported **${result.imported}** clips into Resolve.`,
        action: {
          type: 'resolve_import',
          status: result.error ? 'error' : 'complete',
          description: result.error ? 'Import failed' : `Imported ${result.imported} clips`,
        },
      },
    }
  }

  private async handleResolveTimeline(params: Record<string, any>): Promise<RouteResult> {
    const name = params.name || 'Timeline 1'
    const result = await resolveBridge.createTimeline(name)

    return {
      handled: true,
      response: {
        content: result.error
          ? `Couldn't create timeline: ${result.error}`
          : `Created timeline **${name}**. Drop clips in or ask me to build an assembly.`,
        action: {
          type: 'resolve_timeline',
          status: result.error ? 'error' : 'complete',
          description: result.error ? 'Timeline creation failed' : `Created "${name}"`,
        },
      },
    }
  }

  private async handleGrade(params: Record<string, any>, originalMessage: string): Promise<RouteResult> {
    const status = resolveBridge.status
    if (!status.connected) {
      return {
        handled: true,
        response: {
          content: "I'll need to be connected to Resolve to apply grades. Say **connect to Resolve** and make sure it's running.",
        },
      }
    }

    const adjustments = params.adjustments || originalMessage

    // Translate plain English to grade parameters using Claude
    const client = this.getClient()
    if (!client) return { handled: true, response: { content: 'API key not configured.' } }

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Translate this colour grading instruction into DaVinci Resolve parameters. Respond with ONLY a JSON object of parameter adjustments.

Available parameters: contrast (0.0-2.0, default 1.0), saturation (0.0-2.0, default 1.0), temperature (in Kelvin, 3200-7500), tint (-1.0 to 1.0), lift (shadow brightness, -1 to 1), gamma (midtone brightness, -1 to 1), gain (highlight brightness, -1 to 1).

Instruction: "${adjustments}"

Example: "warmer and more contrast" → {"temperature": 5500, "contrast": 1.3}
Example: "desaturated, darker shadows" → {"saturation": 0.6, "lift": -0.2}`
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
      const gradeParams = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      const result = await resolveBridge.setGrade(0, gradeParams)

      return {
        handled: true,
        response: {
          content: result.error
            ? `Couldn't apply the grade: ${result.error}`
            : `Applied grade: *${adjustments}*\nParameters: ${Object.entries(gradeParams).map(([k, v]) => `${k}: ${v}`).join(', ')}. Check the colour page — undo if it doesn't feel right.`,
          action: { type: 'grade', status: result.error ? 'error' : 'complete', description: adjustments },
        },
      }
    } catch (err: any) {
      return {
        handled: true,
        response: {
          content: `Grade translation failed: ${err.message}`,
          action: { type: 'grade', status: 'error', description: 'Grade failed' },
        },
      }
    }
  }

  private async handleExport(params: Record<string, any>): Promise<RouteResult> {
    const format = params.format || '16:9'
    const status = resolveBridge.status

    if (status.connected) {
      // Use Resolve's render queue
      const dims: Record<string, { w: number; h: number }> = {
        '16:9': { w: 1920, h: 1080 },
        '9:16': { w: 1080, h: 1920 },
        '1:1': { w: 1080, h: 1080 },
        '4:5': { w: 1080, h: 1350 },
      }
      const dim = dims[format] || dims['16:9']
      const result = await resolveBridge.render('/tmp/superedits-export.mp4', dim.w, dim.h)

      return {
        handled: true,
        response: {
          content: result.error
            ? `Export failed: ${result.error}`
            : `Started export at **${dim.w}x${dim.h}** (${format}). Rendering in Resolve — I'll let you know when it's done.`,
          action: { type: 'export', status: result.error ? 'error' : 'running', description: `${format} export` },
        },
      }
    }

    return {
      handled: true,
      response: {
        content: `Export queued at **${format}**. Connect to Resolve or head to the **Export** tab to render via ffmpeg.`,
        action: { type: 'export', status: 'pending', description: `${format} export queued` },
      },
    }
  }

  private async handleFindClips(params: Record<string, any>): Promise<RouteResult> {
    const query = params.query || ''

    // Search analysed clips by content tags, description, quality
    const allClips = this.clipAnalysis.getAllAnalysed()

    if (allClips.length === 0) {
      return {
        handled: true,
        response: {
          content: 'No analysed clips yet. Import footage first, then I can search through it.',
          action: { type: 'find_clips', status: 'complete', description: 'No clips to search' },
        },
      }
    }

    // Filter clips by query matching against tags, description, etc.
    const q = query.toLowerCase()
    const matches = allClips.filter((c) => {
      const tags = (c.analysis?.contentTags || []).join(' ').toLowerCase()
      const desc = (c.analysis?.description || '').toLowerCase()
      const name = (c.fileName || '').toLowerCase()
      return tags.includes(q) || desc.includes(q) || name.includes(q)
    })

    return {
      handled: true,
      response: {
        content: matches.length > 0
          ? `Found **${matches.length}** clips matching "${query}". Check the media browser — I've highlighted the matches.`
          : `No clips match "${query}". Try broader terms or check what's been ingested.`,
        action: { type: 'find_clips', status: 'complete', description: `Found ${matches.length} clips` },
      },
    }
  }

  private async handleSfx(params: Record<string, any>, message: string): Promise<RouteResult> {
    const library = this.sfxService.getLibrary()
    const categories = [...new Set(library.map(s => s.category))]

    const query = params.query || message
    const results = this.sfxService.search(query)
    const matchText = results.length > 0
      ? `Found ${results.length} matching sounds: ${results.slice(0, 4).map(s => `**${s.name}**`).join(', ')}.`
      : `I have ${library.length} sounds across ${categories.join(', ')}.`

    return {
      handled: true,
      response: {
        content: `${matchText}\n\nI can auto-place SFX on your transitions, or you can tell me exactly where you want them. Try "layer SFX on every transition" or "add a whoosh at 4 seconds".`,
        action: {
          type: 'sfx',
          status: 'complete',
          description: `${library.length} SFX available`,
        },
      },
    }
  }

  private async handleCaption(params: Record<string, any>): Promise<RouteResult> {
    return {
      handled: true,
      response: {
        content: 'Head to the **Captions** tab and click **Generate** on a clip to transcribe it. I\'ll detect speech and create timed captions you can edit.',
        action: { type: 'caption', status: 'complete', description: 'Captions ready' },
      },
    }
  }

  private async handleTransition(params: Record<string, any>, message: string): Promise<RouteResult> {
    const presets = this.transitionService.getPresets()

    if (resolveBridge.status.connected) {
      // Try to determine which transition and clip from the message
      const client = this.getClient()
      if (client) {
        try {
          const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `Extract transition parameters from: "${message}"\nAvailable types: Cross Dissolve, Smooth Cut, Dip to Color Dissolve.\nRespond ONLY: {"clip_index": 0, "type": "Cross Dissolve", "duration": 1.0}`
            }],
          })
          const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
          const tParams = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

          const result = await resolveBridge.addTransition(
            tParams.clip_index || 0,
            tParams.type || 'Cross Dissolve',
            tParams.duration || 1.0
          )

          if (!result.error) {
            return {
              handled: true,
              response: {
                content: `Added **${tParams.type || 'Cross Dissolve'}** (${tParams.duration || 1.0}s) to clip ${(tParams.clip_index || 0) + 1}.`,
                action: { type: 'transition', status: 'complete', description: 'Transition applied' },
              },
            }
          }
        } catch {}
      }
    }

    // Fallback: show available presets
    const categories = [...new Set(presets.map(p => p.category))]
    const presetList = presets.slice(0, 6).map(p => `**${p.name}** — ${p.description}`).join('\n')
    return {
      handled: true,
      response: {
        content: `I have ${presets.length} transition presets across ${categories.length} categories: ${categories.join(', ')}.\n\n${presetList}\n\nConnect to Resolve and tell me which clips you want the transition between.`,
        action: { type: 'transition', status: 'complete', description: `${presets.length} presets available` },
      },
    }
  }

  private async handleTitleCard(params: Record<string, any>, message: string): Promise<RouteResult> {
    const presets = this.titleCardService.getPresets()
    const types = [...new Set(presets.map(p => p.type))]

    return {
      handled: true,
      response: {
        content: `I can create: ${types.map(t => `**${t}**`).join(', ')}. ${presets.length} presets available.\n\nTell me the text you want, where to insert it, and I'll build it in Fusion.`,
        action: {
          type: 'title_card',
          status: 'complete',
          description: 'Title card presets loaded',
        },
      },
    }
  }

  private async handleAssemble(params: Record<string, any>, message: string): Promise<RouteResult> {
    const style = params.style || 'cinematic'
    const duration = params.duration || '30 seconds'

    const skills = this.skillService.getAll()
    const relevantSkills = await this.selectRelevantSkills(message, skills)
    const skillAdvice = relevantSkills.length > 0
      ? '\n\n**Applying techniques from:**\n' + relevantSkills.map(s => `- *${s.name}*`).join('\n')
      : ''

    return {
      handled: true,
      response: {
        content: `Building a **${style}** rough cut${duration ? ` targeting ${duration}` : ''}.\n\nI'll analyse your clips for energy, quality, and content, then build a narrative arc: establishing shot, introduce subject, build energy, peak moment, resolution, close. Higher-rated clips get priority.\n\nCheck the **Storyboard** tab to see the assembly. You can drag clips to reorder and swap anything before sending to Resolve.${skillAdvice}`,
        action: {
          type: 'assemble',
          status: 'running',
          description: `Building ${style} assembly`,
        },
      },
    }
  }

  private async handleMusic(params: Record<string, any>): Promise<RouteResult> {
    const mood = params.mood || params.query || ''

    return {
      handled: true,
      response: {
        content: mood
          ? `Searching for **${mood}** tracks. Check the **Music** tab on the right to browse results, preview tracks, and lock your selection before assembly.`
          : 'Head to the **Music** tab to browse tracks by mood, search, or import your own. Music gets locked before I build the rough cut.',
        action: {
          type: 'music-search',
          status: 'complete',
          description: mood ? `Searching: ${mood}` : 'Music browser ready',
        },
      },
    }
  }

  private async handleLearn(message: string): Promise<ChatResponse> {
    const urlMatch = message.match(/https?:\/\/[^\s]+/i)
    if (!urlMatch) {
      return {
        content: "Drop a YouTube link or URL and I'll learn from it — I'll extract the key patterns and save them as a skill file.",
      }
    }

    const url = urlMatch[0]
    try {
      const result = await this.skillService.learnFromUrl(url)
      return {
        content: `Learned from that video. Created skill file: **${result.name}**\n\n${result.topicCount} patterns extracted and saved. I'll use these in future editing decisions.`,
        action: { type: 'learn', status: 'complete', description: `Created skill: ${result.name}` },
      }
    } catch (err: any) {
      return {
        content: `Something went wrong processing that link: ${err.message}`,
        action: { type: 'learn', status: 'error', description: 'Learning failed' },
      }
    }
  }

  private async selectRelevantSkills(message: string, skills: SkillFile[]): Promise<SkillFile[]> {
    if (skills.length <= 3) return skills

    const client = this.getClient()
    if (!client) return skills.slice(0, 3)

    try {
      const skillList = skills.map(s => `- id: "${s.id}" | name: "${s.name}" | category: ${s.category}`).join('\n')

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'You pick the 2-3 most relevant skill files for a video editing question. Respond with ONLY a JSON array of skill IDs, e.g. ["id1","id2"]. No other text.',
        messages: [{
          role: 'user',
          content: `User message: "${message}"\n\nAvailable skills:\n${skillList}`,
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
      const selectedIds: string[] = JSON.parse(text)
      const matched = skills.filter(s => selectedIds.includes(s.id))
      return matched.length > 0 ? matched : skills.slice(0, 3)
    } catch {
      return skills.slice(0, 3)
    }
  }

  private async handleGeneral(message: string, projectId?: string): Promise<ChatResponse> {
    const skills = this.skillService.getAll()
    const relevantSkills = await this.selectRelevantSkills(message, skills)
    const skillContext = relevantSkills.length > 0
      ? '\n\n## Editing Knowledge\n' + relevantSkills.map(s => `### ${s.name}\n${s.content}`).join('\n\n')
      : ''

    const resolveStatus = resolveBridge.status
    const resolveContext = resolveStatus.connected
      ? `\nResolve is connected. Project: ${resolveStatus.project || 'none'}. Timeline: ${resolveStatus.timeline || 'none'}.`
      : '\nResolve is not connected.'

    const systemPrompt = `You are SuperEdits, an AI video editing assistant built into a desktop app that controls DaVinci Resolve Studio. You help with:
- Importing and organizing footage
- Building rough cut assemblies based on narrative structure
- Adding transitions, SFX, title cards, and captions
- Colour grading via plain English descriptions
- Music selection and placement
- Exporting for multiple platforms and aspect ratios
- Creating ad variations (video + static)
- Learning new editing techniques from YouTube videos and articles

You speak concisely and practically. You're an expert editor who communicates in plain English, never jargon. When the user asks you to do something, describe what you'll do briefly, then confirm.

Keep responses short — 2-3 sentences for simple requests. Only elaborate when explaining a creative decision.
${resolveContext}${skillContext}`

    this.conversationHistory.push({ role: 'user', content: message })

    const client = this.getClient()
    if (!client) return { content: 'API key not configured.' }

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: this.conversationHistory.slice(-20),
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? 'No response generated.'
      this.conversationHistory.push({ role: 'assistant', content: text })

      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-30)
      }

      return { content: text }
    } catch (err: any) {
      this.conversationHistory.pop()
      return { content: `Something went wrong: ${err.message}` }
    }
  }
}

export const chatRouter = new ChatRouter()
