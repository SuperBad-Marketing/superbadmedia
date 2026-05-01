import Anthropic from '@anthropic-ai/sdk'
import { resolveBridge } from './resolveBridge.js'
import { getEditIntentService, type EditIntent } from './editIntent.js'
import { getClipAnalysisService } from './clipAnalysis.js'
import { TitleCardService, type TitleCardRequest } from './titleCards.js'
import type { BriefFields } from './briefAssembler.js'

interface TitlePlacement {
  clipIndex: number
  presetId: string
  text: string
  subtext?: string
  duration: number
  position: 'center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  reason: string
}

interface TitlePipelineResult {
  placed: number
  placements: TitlePlacement[]
}

export class TitlePipelineService {
  private clipAnalysis = getClipAnalysisService()
  private titleService = new TitleCardService()

  async applyTitles(
    intent: EditIntent,
    brief?: BriefFields,
    projectName?: string,
    clientName?: string,
  ): Promise<TitlePipelineResult> {
    if (!intent.titles.textUsage || intent.titles.textUsage === 'none') {
      return { placed: 0, placements: [] }
    }

    const timelineClips = await resolveBridge.getTimelineClips()
    if (timelineClips.error || !timelineClips.clips?.length) {
      return { placed: 0, placements: [] }
    }

    const analysedClips = this.clipAnalysis.getAllAnalysed()
    const clipSummaries = timelineClips.clips.map((tc: any, i: number) => {
      const analysed = analysedClips.find((c: any) =>
        c.fileName === tc.name || c.filePath?.endsWith(tc.name)
      )
      return {
        index: i,
        name: tc.name,
        duration: tc.duration,
        sceneType: analysed?.analysis?.sceneType || 'unknown',
        shotType: analysed?.analysis?.shotType || 'unknown',
        environment: analysed?.analysis?.environment || 'unknown',
        hasFaces: analysed?.analysis?.hasFaces || false,
        contentTags: analysed?.analysis?.contentTags?.slice(0, 5) || [],
        description: analysed?.analysis?.description || '',
      }
    })

    const placements = await this.generatePlacements(
      intent, clipSummaries, projectName, clientName, brief,
    )

    for (const placement of placements) {
      await this.applyPlacement(placement)
    }

    return { placed: placements.length, placements }
  }

  private async generatePlacements(
    intent: EditIntent,
    clipSummaries: any[],
    projectName?: string,
    clientName?: string,
    brief?: BriefFields,
  ): Promise<TitlePlacement[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return this.generateFallbackPlacements(intent, clipSummaries, projectName, clientName)
    }

    const presets = this.titleService.getPresets()
    const presetList = presets.map(p => `${p.id}: ${p.name} (${p.type}) — ${p.description}`).join('\n')

    const mode = intent.titles.textUsage
    const client = new Anthropic({ apiKey })

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a title designer for video editing. Given the timeline and the editor's intent, decide where to place titles.

Available title presets:
${presetList}

MODE: ${mode}
${mode === 'minimal' ? 'Place only: one title card at the start, optionally a logo/end card at the end. Nothing else.' : ''}
${mode === 'throughout' ? 'Place: title at start, lower thirds to identify people or key locations, end card at the end. Use location supers when the environment changes. Keep it tasteful — no clip needs more than one title.' : ''}

PROJECT: ${projectName || 'Untitled'}
CLIENT: ${clientName || 'Unknown'}
${brief?.narrativeNotes ? `NOTES: ${brief.narrativeNotes}` : ''}

Respond with ONLY a JSON array:
[
  { "clipIndex": 0, "presetId": "doc-main-title", "text": "PROJECT NAME", "subtext": "optional subtitle", "duration": 4, "position": "center", "reason": "opening title" }
]

Rules:
- clipIndex is which timeline clip to overlay the title on
- Pick the best preset for each placement
- Title text should be relevant to the project/client, not generic
- Duration 3-6 seconds typically
- Lower thirds use bottom-left or bottom-right position
- Location supers use bottom-right
- End cards always use center
- Don't overcrowd — space titles out`,
        messages: [{
          role: 'user',
          content: `Timeline has ${clipSummaries.length} clips:\n${clipSummaries.map(c =>
            `[${c.index}] ${c.name} — ${c.sceneType}, ${c.shotType}, ${c.environment}${c.hasFaces ? ', has faces' : ''}${c.description ? ` — "${c.description}"` : ''}`
          ).join('\n')}`,
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
      const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')

      return parsed.map((p: any) => ({
        clipIndex: p.clipIndex ?? 0,
        presetId: p.presetId || 'doc-main-title',
        text: p.text || projectName || 'Untitled',
        subtext: p.subtext,
        duration: p.duration || 4,
        position: p.position || 'center',
        reason: p.reason || '',
      }))
    } catch {
      return this.generateFallbackPlacements(intent, clipSummaries, projectName, clientName)
    }
  }

  private generateFallbackPlacements(
    intent: EditIntent,
    clipSummaries: any[],
    projectName?: string,
    clientName?: string,
  ): TitlePlacement[] {
    const placements: TitlePlacement[] = []
    const name = projectName || clientName || 'Untitled'

    placements.push({
      clipIndex: 0,
      presetId: 'doc-main-title',
      text: name,
      subtext: clientName && clientName !== name ? clientName : undefined,
      duration: 4,
      position: 'center',
      reason: 'Opening title',
    })

    if (intent.titles.textUsage === 'throughout' && clipSummaries.length > 4) {
      const locationChanges = clipSummaries.filter((c, i) =>
        i > 1 && i < clipSummaries.length - 1 &&
        c.environment !== 'unknown' &&
        c.environment !== clipSummaries[i - 1]?.environment
      )

      for (const loc of locationChanges.slice(0, 2)) {
        placements.push({
          clipIndex: loc.index,
          presetId: 'doc-location',
          text: loc.environment.charAt(0).toUpperCase() + loc.environment.slice(1),
          duration: 3,
          position: 'bottom-right',
          reason: 'Environment change',
        })
      }
    }

    if (clipSummaries.length > 2) {
      placements.push({
        clipIndex: clipSummaries.length - 1,
        presetId: 'doc-end-card',
        text: name,
        subtext: clientName && clientName !== name ? `A ${clientName} film` : undefined,
        duration: 5,
        position: 'center',
        reason: 'End card',
      })
    }

    return placements
  }

  private async applyPlacement(placement: TitlePlacement): Promise<void> {
    const fps = 24

    const request: TitleCardRequest = {
      presetId: placement.presetId,
      text: placement.text,
      subtext: placement.subtext,
      duration: placement.duration,
      position: placement.position,
      fps,
      insertAt: placement.clipIndex,
    }

    const fusionScript = this.titleService.generateFusionScript(request)

    await resolveBridge.injectFusionComp(placement.clipIndex, fusionScript)
  }
}

let instance: TitlePipelineService | null = null

export function getTitlePipelineService(): TitlePipelineService {
  if (!instance) {
    instance = new TitlePipelineService()
  }
  return instance
}
