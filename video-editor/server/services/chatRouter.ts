import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'
import { resolveBridge } from './resolveBridge.js'
import { IngestService } from './ingest.js'
import { getClipAnalysisService } from './clipAnalysis.js'
import { SkillService, type SkillFile } from './skills.js'
import { CaptionService } from './captions.js'
import { TransitionService } from './transitions.js'
import { TitleCardService } from './titleCards.js'
import { SfxService } from './sfx.js'
import { planZooms, zoomToFusionScript } from './dynamicZoom.js'
import { detectSlowMoCandidates } from './slowMoDetector.js'
import { resolveOrchestrator } from './resolveOrchestrator.js'

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
- "resolve_project" — creating, listing, opening, switching, or closing projects in Resolve. Triggers: "list projects", "show projects", "open project", "switch project", "close project", "what projects", "my projects"
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
- "effects" — cinematic effects, visual effects, film looks, lens effects, speed ramps, glitch, film grain, light leaks, camera shake, glow, halation, environmental overlays, dust, rain, snow, mood or feel changes, "make it look like X", flashback, dream sequence, any creative visual/audio processing that isn't basic colour grading
- "recut" — changing the music and recutting the edit, re-editing to a different song, swapping the track
- "stabilize" — stabilising shaky footage, fixing handheld shake, smoothing camera movement
- "zoom" — Ken Burns effect, dynamic zoom, push-in, pull-out, slow zoom on clips
- "slow_mo" — slow motion, speed ramp, slowing down a moment, dramatic slow-down
- "learn" — learning from a URL, YouTube video, creating skill files
- "general" — general chat, questions, advice, anything else

Respond: {"intent": "<intent>", "params": {<any extracted parameters>}}

Parameter extraction:
- For "grade": extract "adjustments" (the plain-english description)
- For "find_clips": extract "query" (what they're looking for)
- For "learn": extract "url" if present
- For "resolve_project": extract "name" if mentioned, "action" as one of "create", "list", "open", "close"
- For "export": extract "format" if mentioned (16:9, 9:16, 1:1, 4:5)
- For "music": extract "mood" or "query"
- For "effects": extract "description" (the plain-english effect description), "clip_index" if a specific clip is mentioned
- For "assemble": extract "style", "duration", "description" if mentioned
- For "recut": extract "mood" or "style" if mentioned
- For "stabilize": extract "clip_index" if a specific clip is mentioned, "mode" (translation or perspective)
- For "zoom": extract "clip_index" if mentioned, "direction" (push-in, pull-out), "speed" (slow, medium, fast)
- For "slow_mo": extract "clip_index" if mentioned, "speed" (25, 50, 75 percent)`

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
    const lower = message.toLowerCase()

    if (/\brecut\b/.test(lower) || (/\bchange\b.*\b(music|song|track)\b/.test(lower) && /\b(recut|re-edit|re-cut|rebuild|redo)\b/.test(lower))) {
      return { intent: 'recut', params: {} }
    }

    if (/\bstabili[sz]e\b/.test(lower) || /\bfix.*\bshak(y|e|ing)\b/.test(lower)) {
      const clipMatch = lower.match(/clip\s*(\d+)/)
      return { intent: 'stabilize', params: clipMatch ? { clip_index: parseInt(clipMatch[1]) - 1 } : {} }
    }

    if (/\bken burns\b/.test(lower) || (/\b(zoom|push[\s-]?in|pull[\s-]?out)\b/.test(lower) && !/\bblur\b/.test(lower))) {
      const clipMatch = lower.match(/clip\s*(\d+)/)
      const direction = /pull[\s-]?out/.test(lower) ? 'pull-out' : 'push-in'
      return { intent: 'zoom', params: { direction, ...(clipMatch ? { clip_index: parseInt(clipMatch[1]) - 1 } : {}) } }
    }

    if (/\bslow[\s-]?mo\b/.test(lower) || (/\bslow\b.*\bdown\b/.test(lower) && /\bclip\b/.test(lower))) {
      const clipMatch = lower.match(/clip\s*(\d+)/)
      const speedMatch = lower.match(/(\d+)\s*%/)
      return { intent: 'slow_mo', params: { ...(clipMatch ? { clip_index: parseInt(clipMatch[1]) - 1 } : {}), ...(speedMatch ? { speed: parseInt(speedMatch[1]) } : {}) } }
    }

    const projectKeywords = /\b(list|show|open|switch|close|my)\b.*\bproject/i
    const projectKeywords2 = /\bproject.*\b(list|open|switch|close|show)\b/i
    if (projectKeywords.test(message) || projectKeywords2.test(message)) {
      const nameMatch = message.match(/(?:open|switch to|load)\s+(?:project\s+)?["']?(.+?)["']?\s*$/i)
      const isOpen = /\b(open|switch|load)\b/i.test(lower)
      const isClose = /\bclose\b/i.test(lower)
      const isList = /\b(list|show|my|all)\b/i.test(lower) && !isOpen && !isClose
      return {
        intent: 'resolve_project',
        params: {
          action: isClose ? 'close' : isOpen ? 'open' : isList ? 'list' : 'list',
          ...(nameMatch && isOpen ? { name: nameMatch[1].trim() } : {}),
        },
      }
    }

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
      case 'effects':
        return this.handleEffects(intent.params, message)
      case 'assemble':
        return this.handleAssemble(intent.params, message)
      case 'music':
        return this.handleMusic(intent.params)
      case 'recut':
        return this.handleRecut(intent.params)
      case 'stabilize':
        return this.handleStabilize(intent.params)
      case 'zoom':
        return this.handleZoom(intent.params)
      case 'slow_mo':
        return this.handleSlowMo(intent.params)
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
    if (!resolveBridge.status.connected) {
      const connectResult = await resolveBridge.start()
      if (!connectResult.connected) {
        return {
          handled: true,
          response: {
            content: "Can't reach Resolve. Make sure it's running and try again.",
            action: { type: 'resolve_project', status: 'error', description: 'Not connected' },
          },
        }
      }
    }

    const action = params.action || (params.name ? 'create' : 'list')

    if (action === 'list') {
      const result = await resolveBridge.listProjects()
      if (result.error) {
        return {
          handled: true,
          response: {
            content: `Couldn't list projects: ${result.error}`,
            action: { type: 'resolve_project', status: 'error', description: 'List failed' },
          },
        }
      }
      const projects = result.projects || []
      if (projects.length === 0) {
        return {
          handled: true,
          response: {
            content: 'No projects found in the current Resolve database. Want me to create one?',
            action: { type: 'resolve_project', status: 'complete', description: 'No projects found' },
          },
        }
      }
      const suggestions = projects.map((p: string) => ({ label: p, message: `open project ${p}` }))
      return {
        handled: true,
        response: {
          content: `Found **${projects.length}** project${projects.length === 1 ? '' : 's'} in Resolve:`,
          action: {
            type: 'resolve_project',
            status: 'complete',
            description: `Listed ${projects.length} projects`,
            data: { suggestions },
          },
        },
      }
    }

    if (action === 'open') {
      const name = params.name
      if (!name) {
        const result = await resolveBridge.listProjects()
        const projects = result.projects || []
        if (projects.length === 0) {
          return { handled: true, response: { content: 'No projects found. Want me to create one?' } }
        }
        const suggestions = projects.map((p: string) => ({ label: p, message: `open project ${p}` }))
        return {
          handled: true,
          response: {
            content: 'Which project?',
            action: {
              type: 'resolve_project',
              status: 'complete',
              description: 'Select a project',
              data: { suggestions },
            },
          },
        }
      }
      const result = await resolveBridge.loadProject(name)
      if (result.error) {
        return {
          handled: true,
          response: {
            content: `Couldn't open "${name}": ${result.error}`,
            action: { type: 'resolve_project', status: 'error', description: 'Open failed' },
          },
        }
      }
      return {
        handled: true,
        response: {
          content: `Opened **${name}**${result.timeline ? ` — timeline: **${result.timeline}**` : ''}. Ready to go.`,
          action: { type: 'resolve_project', status: 'complete', description: `Opened "${name}"` },
        },
      }
    }

    if (action === 'close') {
      const result = await resolveBridge.closeProject()
      if (result.error) {
        return {
          handled: true,
          response: {
            content: `Couldn't close: ${result.error}`,
            action: { type: 'resolve_project', status: 'error', description: 'Close failed' },
          },
        }
      }
      return {
        handled: true,
        response: {
          content: 'Project saved and closed.',
          action: { type: 'resolve_project', status: 'complete', description: 'Project closed' },
        },
      }
    }

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

  private effectsCatalogueCache: string | null = null

  private async loadEffectsCatalogue(): Promise<string> {
    if (this.effectsCatalogueCache) return this.effectsCatalogueCache
    const cataloguePath = path.join(process.cwd(), 'docs', 'cinematic-effects-catalogue.md')
    this.effectsCatalogueCache = await fs.readFile(cataloguePath, 'utf-8')
    return this.effectsCatalogueCache
  }

  private async handleEffects(params: Record<string, any>, originalMessage: string): Promise<RouteResult> {
    const status = resolveBridge.status
    if (!status.connected) {
      return {
        handled: true,
        response: {
          content: "I'll need Resolve running to apply effects. Say **connect to Resolve** first.",
        },
      }
    }

    const client = this.getClient()
    if (!client) return { handled: true, response: { content: 'API key not configured.' } }

    const description = params.description || originalMessage
    const clipIndex = params.clip_index ?? 0

    let catalogue: string
    try {
      catalogue = await this.loadEffectsCatalogue()
    } catch {
      return {
        handled: true,
        response: {
          content: 'Effects catalogue not found. Make sure `docs/cinematic-effects-catalogue.md` exists.',
          action: { type: 'effects', status: 'error', description: 'Catalogue missing' },
        },
      }
    }

    let clipState: Record<string, any> | null = null
    try {
      clipState = await resolveBridge.getClipEffectsState(clipIndex)
    } catch {}

    try {
      const planResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `You are a cinematic effects planner for DaVinci Resolve. You have a full effects catalogue below. Your job is to translate the user's request into a structured effect plan.

RULES:
1. If the request is VAGUE ("make it cinematic", "make it look good", "add some style"), respond with {"discovery": true, "questions": [...]} — ask 2-3 short questions to narrow down what they want. Each question should have 2-3 concrete options.
2. If the request is SPECIFIC, respond with {"discovery": false, "plan": {...}} containing the effect plan.
3. Check the clip's current effects state (provided) to avoid duplicates or conflicts.
4. Never exceed 2 heavy + 4 medium effects per clip.

For a specific request, the plan format is:
{
  "discovery": false,
  "plan": {
    "summary": "one-line description of what you're doing",
    "steps": [
      {
        "type": "color-node" | "fusion" | "resolve-fx" | "clip-property" | "audio-preprocess" | "audio-automation" | "sfx-layer" | "timeline-op" | "marker" | "masking",
        "ingredient_id": "the ingredient name from the catalogue",
        "variant": "subtle" | "standard" | "heavy",
        "action": "the bridge command to call",
        "params": { ... bridge command parameters ... },
        "description": "what this step does in plain English"
      }
    ],
    "warnings": ["any performance or conflict warnings"],
    "performance_note": "light" | "moderate" | "heavy"
  }
}

Bridge commands available:
- set_grade(clip_index, grade_params) — CDL-style grading
- add_color_node(clip_index, node_type) — add serial/parallel/layer node
- set_node_params(clip_index, node_index, params) — set node grading params
- apply_resolve_fx(clip_index, effect_name, parameters) — OpenFX effect
- inject_fusion_comp(clip_index, fusion_script) — single Fusion comp (one per clip!)
- build_compound_fusion(clip_index, ingredients[]) — multiple Fusion effects combined
- set_clip_speed(clip_index, speed_percent) — speed change
- set_retiming(clip_index, mode, speed) — optical flow retiming
- set_clip_transform(clip_index, params) — zoom, position, rotation, crop
- set_clip_opacity(clip_index, opacity) — opacity
- set_clip_volume(clip_index, volume_db) — volume
- set_volume_keyframe(clip_index, frame, volume_db) — volume automation
- mute_clip_audio(clip_index, muted) — mute
- preprocess_audio(source_file_path, start_time, end_time, filters[]) — server-side audio processing
- add_marker(clip_index, frame, color, name, note) — marker for manual steps
- set_keyframe(clip_index, node_index, param, frame, value) — colour keyframe
- place_sfx(search_query, category, role, timeline_position) — search Epidemic Sound, download, and place SFX on timeline
- add_power_window(clip_index, node_index, window_type, params) — regional grading via Power Window (circular/linear/polygon/gradient)
- add_qualifier(clip_index, node_index, qualifier_type, params) — colour-based pixel selection (HSL qualifier for skin tones, sky, etc.)
- setup_magic_mask(clip_index, mask_mode, node_index) — AI-powered masking (person/face/object). Auto-tracks. Requires Resolve Studio.
- setup_masked_grade(clip_index, mask_type, mask_params, grade_params, invert) — all-in-one: node + mask + grade. Best for common masking workflows.

EFFECTS CATALOGUE:
${catalogue}`,
        messages: [{
          role: 'user',
          content: `Request: "${description}"
Clip index: ${clipIndex}
${clipState ? `Current clip state: ${JSON.stringify(clipState)}` : 'No clip state available.'}`,
        }],
      })

      const text = planResponse.content.find(b => b.type === 'text')?.text ?? '{}'
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      if (parsed.discovery) {
        const questions = (parsed.questions || []) as string[]
        return {
          handled: true,
          response: {
            content: `I want to get this right. A few quick questions:\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n')}\n\nAnswer however you like and I'll build the effect.`,
            action: { type: 'effects-discovery', status: 'complete', description: 'Gathering preferences' },
          },
        }
      }

      const plan = parsed.plan
      if (!plan?.steps?.length) {
        return {
          handled: true,
          response: {
            content: "I couldn't figure out how to translate that into effects. Could you describe what you're after differently?",
            action: { type: 'effects', status: 'error', description: 'No plan generated' },
          },
        }
      }

      const results: { step: string; success: boolean; error?: string; ingredientId?: string; variant?: string; params?: Record<string, any> }[] = []
      const fusionSteps = plan.steps.filter((s: any) => s.type === 'fusion')

      if (fusionSteps.length > 1) {
        const ingredients = fusionSteps.map((s: any) => ({
          id: s.ingredient_id,
          variant: s.variant,
          params: s.params?.parameters,
          fusion_script: s.params?.fusion_script,
        }))
        const result = await resolveBridge.buildCompoundFusion(clipIndex, ingredients)
        for (const fs of fusionSteps) {
          results.push({
            step: fs.description || fs.ingredient_id,
            success: !result.error,
            error: result.error,
            ingredientId: fs.ingredient_id,
            variant: fs.variant,
            params: fs.params,
          })
        }
      }

      for (const step of plan.steps) {
        if (step.type === 'fusion' && fusionSteps.length > 1) continue

        try {
          let result: any
          switch (step.action) {
            case 'set_grade':
              result = await resolveBridge.setGrade(clipIndex, step.params?.grade_params || step.params)
              break
            case 'add_color_node':
              result = await resolveBridge.addColorNode(clipIndex, step.params?.node_type)
              break
            case 'set_node_params':
              result = await resolveBridge.setNodeParams(clipIndex, step.params?.node_index ?? 1, step.params?.params || step.params)
              break
            case 'apply_resolve_fx':
              result = await resolveBridge.applyResolveFx(clipIndex, step.params?.effect_name, step.params?.parameters)
              break
            case 'inject_fusion_comp':
              result = await resolveBridge.injectFusionComp(clipIndex, step.params?.fusion_script || '')
              break
            case 'build_compound_fusion':
              result = await resolveBridge.buildCompoundFusion(clipIndex, step.params?.ingredients || [])
              break
            case 'set_clip_speed':
              result = await resolveBridge.setClipSpeed(clipIndex, step.params?.speed_percent || 100)
              break
            case 'set_retiming':
              result = await resolveBridge.setRetiming(clipIndex, step.params?.mode || 'optical_flow', step.params?.speed || 50)
              break
            case 'set_clip_transform':
              result = await resolveBridge.setClipTransform(clipIndex, step.params?.params || step.params)
              break
            case 'set_clip_opacity':
              result = await resolveBridge.setClipOpacity(clipIndex, step.params?.opacity ?? 100)
              break
            case 'set_clip_volume':
              result = await resolveBridge.setClipVolume(clipIndex, step.params?.volume_db ?? 0)
              break
            case 'set_volume_keyframe':
              result = await resolveBridge.setVolumeKeyframe(clipIndex, step.params?.frame || 0, step.params?.volume_db ?? 0)
              break
            case 'mute_clip_audio':
              result = await resolveBridge.muteClipAudio(clipIndex, step.params?.muted ?? true)
              break
            case 'preprocess_audio':
              result = await resolveBridge.preprocessAudio(
                step.params?.source_file_path || '',
                step.params?.start_time || 0,
                step.params?.end_time || 0,
                step.params?.filters || [],
              )
              break
            case 'set_keyframe':
              result = await resolveBridge.setKeyframe(
                clipIndex,
                step.params?.node_index ?? 1,
                step.params?.param || '',
                step.params?.frame || 0,
                step.params?.value ?? 0,
              )
              break
            case 'add_marker':
              result = await resolveBridge.addMarker(
                clipIndex,
                step.params?.frame || 0,
                step.params?.color || 'Blue',
                step.params?.name || '',
                step.params?.note || '',
              )
              break
            case 'place_sfx': {
              const sfxQuery = step.params?.search_query || step.ingredient_id || ''
              const sfxResult = await this.sfxService.findAndDownload(sfxQuery, {
                category: step.params?.category || 'sfx',
                role: step.params?.role || 'accent',
                searchQuery: sfxQuery,
              })
              if (sfxResult) {
                const trackResult = await resolveBridge.addAudioTrack('SFX')
                const trackIndex = trackResult?.track_index ?? 1
                result = await resolveBridge.importAudioToTrack(
                  trackIndex,
                  sfxResult.filePath,
                  step.params?.timeline_position || 0,
                )
                if (!result?.error) {
                  result = { success: true, sfx_title: sfxResult.track.title }
                }
              } else {
                result = { error: `No SFX found for "${sfxQuery}"` }
              }
              break
            }
            case 'add_power_window':
              result = await resolveBridge.addPowerWindow(clipIndex, step.params?.node_index, step.params?.window_type, step.params?.params)
              break
            case 'add_qualifier':
              result = await resolveBridge.addQualifier(clipIndex, step.params?.node_index, step.params?.qualifier_type, step.params?.params)
              break
            case 'setup_magic_mask':
              result = await resolveBridge.setupMagicMask(clipIndex, step.params?.mask_mode || 'person', step.params?.node_index)
              break
            case 'setup_masked_grade':
              result = await resolveBridge.setupMaskedGrade(
                clipIndex,
                step.params?.mask_type || 'magic_mask',
                step.params?.mask_params,
                step.params?.grade_params,
                step.params?.invert ?? false,
              )
              break
            default:
              result = { error: `Unknown action: ${step.action}` }
          }
          results.push({ step: step.description || step.ingredient_id, success: !result?.error, error: result?.error, ingredientId: step.ingredient_id, variant: step.variant, params: step.params })
        } catch (err: any) {
          results.push({ step: step.description || step.ingredient_id, success: false, error: err.message, ingredientId: step.ingredient_id, variant: step.variant })
        }
      }

      const succeeded = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      let content = `**${plan.summary}**\n\n`
      if (succeeded.length > 0) {
        content += succeeded.map(r => `- ${r.step}`).join('\n') + '\n'
      }
      if (failed.length > 0) {
        content += `\n**Couldn't apply:**\n${failed.map(r => `- ${r.step}: ${r.error}`).join('\n')}\n`
      }
      if (plan.warnings?.length) {
        content += `\n*${plan.warnings.join('. ')}*`
      }
      content += '\n\nCheck the viewer. Undo in Resolve if anything feels off.'

      const appliedEffects = succeeded
        .filter(r => r.ingredientId)
        .map(r => ({
          id: crypto.randomUUID(),
          clipId: String(clipIndex),
          ingredientId: r.ingredientId!,
          variant: r.variant || 'standard',
          parameters: r.params || {},
          appliedAt: new Date().toISOString(),
          bypassed: false,
        }))

      return {
        handled: true,
        response: {
          content,
          action: {
            type: 'effects',
            status: failed.length === results.length ? 'error' : 'complete',
            description: plan.summary,
            data: appliedEffects.length > 0 ? { appliedEffects } : undefined,
          },
        },
      }
    } catch (err: any) {
      return {
        handled: true,
        response: {
          content: `Effect planning failed: ${err.message}`,
          action: { type: 'effects', status: 'error', description: 'Planning failed' },
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
    const client = this.getClient()

    if (!client) {
      return { handled: true, response: { content: 'API key not configured.' } }
    }

    const presetList = presets.map(p => `- ${p.id}: ${p.name} (${p.type}) — ${p.description}`).join('\n')

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You select title card templates and extract parameters for a video editor. Given the user's request, pick the best template and extract the content.

Available templates:
${presetList}

Respond with ONLY a JSON object:
{
  "preset_id": "template id",
  "text": "main text content",
  "subtext": "subtitle/role/attribution if any",
  "duration": 4,
  "font": "Futura",
  "position": "center",
  "needs_resolve": true,
  "summary": "one-line description of what you're creating"
}

Font recommendations:
- Documentary/modern: "Futura" (default)
- Editorial/literary: "Georgia"
- Clean/corporate: "Helvetica Neue" or "Avenir"
- Bold impact: "Futura" with fontStyle "Bold"

If the user hasn't specified text content, set text to a placeholder and ask in summary.
Position options: center, bottom-left, bottom-right, top-left, top-right (only for location/reveal types).`,
        messages: [{ role: 'user', content: message }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      if (!parsed.preset_id || !parsed.text) {
        const types = [...new Set(presets.map(p => p.type))]
        return {
          handled: true,
          response: {
            content: `I have ${presets.length} premium title templates: ${types.map(t => `**${t}**`).join(', ')}.\n\n${presets.map(p => `**${p.name}** — ${p.description}`).join('\n')}\n\nTell me the text and which style you want, and I'll build it in Fusion.`,
            action: { type: 'title-card', status: 'complete', description: 'Templates listed' },
          },
        }
      }

      const fusionScript = this.titleCardService.generateFusionScript({
        presetId: parsed.preset_id,
        text: parsed.text,
        subtext: parsed.subtext,
        duration: parsed.duration || 4,
        position: parsed.position,
        font: parsed.font,
        fontStyle: parsed.fontStyle,
        fps: parsed.fps,
        insertAt: 0,
      })

      if (resolveBridge.status.connected) {
        const clipIndex = params.clip_index ?? 0
        const result = await resolveBridge.injectFusionComp(clipIndex, fusionScript)

        if (!result.error) {
          return {
            handled: true,
            response: {
              content: `Built **${parsed.summary || presets.find(p => p.id === parsed.preset_id)?.name || 'title card'}** in Fusion.\n\nText: *"${parsed.text}"*${parsed.subtext ? `\nSubtitle: *"${parsed.subtext}"*` : ''}\nDuration: ${parsed.duration || 4}s\n\nOpen the Fusion page to tweak typography, timing, or colours — it's a real Fusion comp, not locked.`,
              action: { type: 'title-card', status: 'complete', description: parsed.summary || 'Title card applied' },
            },
          }
        }

        return {
          handled: true,
          response: {
            content: `Couldn't inject the title card into Resolve: ${result.error}\n\nThe Fusion script is ready though — I can try again or you can paste it manually in the Fusion page.`,
            action: { type: 'title-card', status: 'error', description: 'Injection failed' },
          },
        }
      }

      return {
        handled: true,
        response: {
          content: `Built **${parsed.summary || 'title card'}** as a Fusion composition.\n\nText: *"${parsed.text}"*${parsed.subtext ? `\nSubtitle: *"${parsed.subtext}"*` : ''}\n\nConnect to Resolve and I'll inject it onto the timeline. The comp uses proper bezier easing and staggered animation — no template look.`,
          action: { type: 'title-card', status: 'pending', description: 'Waiting for Resolve' },
        },
      }
    } catch (err: any) {
      return {
        handled: true,
        response: {
          content: `Title card creation failed: ${err.message}`,
          action: { type: 'title-card', status: 'error', description: 'Failed' },
        },
      }
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

  private async handleRecut(params: Record<string, any>): Promise<RouteResult> {
    return {
      handled: true,
      response: {
        content: "Pick a new track in the **Music** tab, then hit **Recut** — I'll rebuild the edit to match the new song's energy and beat grid. The storyboard will update and auto-push to Resolve.",
        action: {
          type: 'recut',
          status: 'complete',
          description: 'Ready to recut',
          data: { triggerMusicPicker: true },
        },
      },
    }
  }

  private async handleStabilize(params: Record<string, any>): Promise<RouteResult> {
    if (!resolveBridge.status.connected) {
      return {
        handled: true,
        response: {
          content: "I need Resolve running to stabilise footage. Say **connect to Resolve** first.",
        },
      }
    }

    const clipIndex = params.clip_index ?? null
    const mode = (params.mode as 'translation' | 'perspective') || 'perspective'

    if (clipIndex !== null) {
      const result = await resolveBridge.stabilize(clipIndex, mode)
      return {
        handled: true,
        response: {
          content: result.error
            ? `Couldn't stabilise clip ${clipIndex + 1}: ${result.error}`
            : `Stabilised clip ${clipIndex + 1} using **${mode}** mode. Check the viewer — Resolve's built-in stabiliser is doing the heavy lifting.`,
          action: { type: 'stabilize', status: result.error ? 'error' : 'complete', description: `Stabilised clip ${clipIndex + 1}` },
        },
      }
    }

    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return {
        handled: true,
        response: {
          content: "No clips on the timeline yet. Build an assembly first, then I can stabilise the shaky ones.",
        },
      }
    }

    const analysed = this.clipAnalysis.getAllAnalysed()
    let stabilised = 0

    for (let i = 0; i < timelineClips.clips.length; i++) {
      const tc = timelineClips.clips[i]
      const match = analysed.find(c => c.fileName === tc.name || c.filePath?.endsWith(tc.name))
      const movement = match?.analysis?.movementLevel
      if (movement === 'high' || movement === 'medium') {
        const result = await resolveBridge.stabilize(i, mode)
        if (!result.error) stabilised++
      }
    }

    if (stabilised === 0) {
      return {
        handled: true,
        response: {
          content: "None of the timeline clips look particularly shaky based on the analysis. Want me to stabilise a specific clip anyway? Tell me which one.",
        },
      }
    }

    return {
      handled: true,
      response: {
        content: `Stabilised **${stabilised}** shaky clip${stabilised === 1 ? '' : 's'} using Resolve's ${mode} stabiliser. Check the viewer to make sure nothing got cropped too aggressively.`,
        action: { type: 'stabilize', status: 'complete', description: `Stabilised ${stabilised} clips` },
      },
    }
  }

  private async handleZoom(params: Record<string, any>): Promise<RouteResult> {
    if (!resolveBridge.status.connected) {
      return {
        handled: true,
        response: {
          content: "I need Resolve running to apply zooms. Say **connect to Resolve** first.",
        },
      }
    }

    const clipIndex = params.clip_index ?? null
    const direction = params.direction || 'push-in'

    if (clipIndex !== null) {
      const zoom = {
        clipIndex,
        type: (direction === 'pull-out' ? 'pull-out' : 'push-in') as 'push-in' | 'pull-out',
        variant: 'standard' as const,
        scaleStart: direction === 'pull-out' ? 1.12 : 1.0,
        scaleEnd: direction === 'pull-out' ? 1.0 : 1.12,
        reason: 'Manual zoom request',
      }
      const tc = await resolveBridge.getTimelineClips()
      const clip = tc.clips?.[clipIndex]
      const fps = clip?.fps || 24
      const durFrames = Math.round((clip?.duration || 4) * fps)
      const script = zoomToFusionScript(zoom, durFrames, fps)
      const result = await resolveBridge.injectFusionComp(clipIndex, script)
      return {
        handled: true,
        response: {
          content: result.error
            ? `Couldn't apply zoom to clip ${clipIndex + 1}: ${result.error}`
            : `Applied a **${direction}** Ken Burns zoom to clip ${clipIndex + 1}. It's a Fusion comp — tweak the scale and easing on the Fusion page if you want.`,
          action: { type: 'zoom', status: result.error ? 'error' : 'complete', description: `${direction} on clip ${clipIndex + 1}` },
        },
      }
    }

    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return {
        handled: true,
        response: { content: "No clips on the timeline yet. Build an assembly first, then I can add zooms." },
      }
    }

    const analysed = this.clipAnalysis.getAllAnalysed()
    const storyboardEntries = timelineClips.clips.map((tc: any, i: number) => {
      const match = analysed.find(c => c.fileName === tc.name || c.filePath?.endsWith(tc.name))
      return {
        clipId: match?.id || tc.name,
        startTime: 0,
        endTime: tc.duration || 3,
        position: i,
        analysis: {
          cameraMovement: match?.analysis?.movementLevel === 'static' ? 'static' : match?.analysis?.movementLevel === 'low' ? 'static' : 'dynamic',
          shotType: match?.analysis?.contentTags?.includes('wide') ? 'wide' : match?.analysis?.hasFaces ? 'medium' : 'unknown',
          editUtility: match?.analysis?.isBestMoment ? ['hero-shot'] : [],
          hasFaces: match?.analysis?.hasFaces || false,
        },
      }
    })

    const zoomPlan = planZooms(storyboardEntries)

    if (zoomPlan.length === 0) {
      return {
        handled: true,
        response: {
          content: "I looked at your clips but none jumped out as good candidates for Ken Burns zooms — most already have camera movement. Want me to add a zoom to a specific clip?",
        },
      }
    }

    let applied = 0
    for (const zoom of zoomPlan) {
      const tc = timelineClips.clips[zoom.clipIndex]
      const fps = tc?.fps || 24
      const durFrames = Math.round((tc?.duration || 3) * fps)
      const script = zoomToFusionScript(zoom, durFrames, fps)
      const result = await resolveBridge.injectFusionComp(zoom.clipIndex, script)
      if (!result.error) applied++
    }

    return {
      handled: true,
      response: {
        content: `Applied **${applied}** Ken Burns zoom${applied === 1 ? '' : 's'} to static shots — gentle push-ins on establishing shots, subtle movement on interview clips. Check the timeline; each is a Fusion comp you can tweak.`,
        action: { type: 'zoom', status: 'complete', description: `${applied} zooms applied` },
      },
    }
  }

  private async handleSlowMo(params: Record<string, any>): Promise<RouteResult> {
    if (!resolveBridge.status.connected) {
      return {
        handled: true,
        response: {
          content: "I need Resolve running to apply slow motion. Say **connect to Resolve** first.",
        },
      }
    }

    const clipIndex = params.clip_index ?? null
    const speed = params.speed ?? 50

    if (clipIndex !== null) {
      const result = await resolveBridge.setRetiming(clipIndex, 'optical_flow', speed)
      return {
        handled: true,
        response: {
          content: result.error
            ? `Couldn't apply slow-mo to clip ${clipIndex + 1}: ${result.error}`
            : `Slowed clip ${clipIndex + 1} to **${speed}%** speed using Resolve's optical flow retiming. Smooth as butter if the footage is clean.`,
          action: { type: 'slow_mo', status: result.error ? 'error' : 'complete', description: `${speed}% on clip ${clipIndex + 1}` },
        },
      }
    }

    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return {
        handled: true,
        response: { content: "No clips on the timeline yet. Build an assembly first." },
      }
    }

    const analysed = this.clipAnalysis.getAllAnalysed()
    const storyboardEntries = timelineClips.clips.map((tc: any, i: number) => {
      const match = analysed.find((c: any) => c.fileName === tc.name || c.filePath?.endsWith(tc.name))
      return {
        clipId: match?.id || tc.name,
        startTime: 0,
        endTime: tc.duration || 3,
        position: i,
        analysis: {
          hasAction: (match?.analysis?.energyLevel ?? 0) > 60,
          emotionalTone: (match?.analysis?.energyLevel ?? 0) > 80 ? 'intense' : undefined,
          humanContent: match?.analysis?.hasFaces ? ['candid-moment'] : [],
          editUtility: match?.analysis?.isBestMoment ? ['hero-shot'] : [],
          rankedMoments: match?.analysis?.isBestMoment ? [{ timestamp: 0, score: 85, reason: 'Best moment' }] : [],
          cameraMovement: match?.analysis?.movementLevel || 'static',
          movementLevel: match?.analysis?.movementLevel || 'static',
        },
      }
    })

    const candidates = detectSlowMoCandidates(storyboardEntries)

    if (candidates.length === 0) {
      return {
        handled: true,
        response: {
          content: "No obvious slow-mo moments detected in the analysis. Want me to slow down a specific clip? Tell me which one and how much (25%, 50%, 75%).",
        },
      }
    }

    let applied = 0
    for (const candidate of candidates) {
      const result = await resolveBridge.setRetiming(
        candidate.clipIndex,
        candidate.useOpticalFlow ? 'optical_flow' : 'nearest',
        candidate.speed,
      )
      if (!result.error) applied++
    }

    const momentDescs = candidates.slice(0, 3).map(c =>
      `clip ${c.clipIndex + 1} at ${c.speed}%`
    ).join(', ')

    return {
      handled: true,
      response: {
        content: `Applied slow-mo to **${applied}** key moment${applied === 1 ? '' : 's'}: ${momentDescs}. Using optical flow retiming for smooth interpolation. Check each one — if any look artifacty, bump the speed up to 50%.`,
        action: { type: 'slow_mo', status: 'complete', description: `${applied} slow-mo moments` },
      },
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
