import Anthropic from '@anthropic-ai/sdk'
import { clientService } from './clients.js'

interface RevisionContext {
  projectId: string
  clientId?: string
  storyboardClips: any[]
  clips: any[]
  sfxPlacements: any[]
  transitions: any[]
  brief: any
  narrative: string
}

interface RevisionResult {
  response: string
  storyboardUpdates?: any[]
  sfxUpdates?: any[]
  transitionUpdates?: any[]
  learnedInstructions?: { category: 'editing' | 'style' | 'avoid' | 'general'; instruction: string }[]
}

const REVISION_SYSTEM = `You are an AI video editor reviewing a rough cut with a client. The client will give you feedback about the edit. You have two jobs:

1. ADJUST THE EDIT based on feedback — reorder clips, change in/out points, swap clips, modify transitions/SFX
2. LEARN CLIENT PREFERENCES — extract reusable editing rules from their feedback

When adjusting the edit, respond with a JSON block containing your changes. When you learn something about the client's preferences that should apply to future edits, include it in learnedInstructions.

THE EDIT IS BUILT FOR DAVINCI RESOLVE. You're adjusting the timeline data that gets pushed into Resolve — clip selection, in/out points, ordering, transitions. Resolve handles the actual rendering, color, and effects.

Respond with ONLY a JSON object:
{
  "response": "Conversational response to the client explaining what you changed and why",
  "storyboardUpdates": [
    { "action": "reorder", "clipId": "uuid", "newPosition": 2 },
    { "action": "trim", "clipId": "uuid", "startTime": 1.5, "endTime": 3.0 },
    { "action": "remove", "clipId": "uuid" },
    { "action": "swap", "clipId": "uuid", "replaceWithClipId": "uuid" },
    { "action": "add", "clipId": "uuid", "position": 3, "startTime": 0, "endTime": 2.5 }
  ],
  "sfxUpdates": [
    { "action": "remove", "sfxId": "uuid" },
    { "action": "add", "category": "ambient", "searchQuery": "ocean waves", "timelineStart": 0, "timelineEnd": 10, "volume": 0.3 }
  ],
  "transitionUpdates": [
    { "action": "remove", "afterClipPosition": 3 },
    { "action": "add", "afterClipPosition": 2, "presetId": "dissolve-soft", "duration": 0.5 }
  ],
  "learnedInstructions": [
    { "category": "editing", "instruction": "Always open with a wide establishing shot" },
    { "category": "avoid", "instruction": "No handheld footage in final cuts" }
  ]
}

Only include update arrays if you're actually making changes. learnedInstructions should only include preferences that are clearly reusable across future projects — not one-off feedback specific to this edit.`

export class RevisionService {
  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    return new Anthropic({ apiKey })
  }

  async processRevision(
    context: RevisionContext,
    feedback: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<RevisionResult> {
    const client = this.getClient()
    if (!client) {
      return { response: 'No API key configured. Cannot process revisions.' }
    }

    let clientInstructions = ''
    if (context.clientId) {
      clientInstructions = clientService.getInstructionsPrompt(context.clientId)
    }

    const clipSummaries = context.clips.map(c => ({
      id: c.id,
      fileName: c.fileName,
      duration: c.duration,
      description: c.analysis?.description || '',
      shotType: c.analysis?.shotType || '',
      environment: c.analysis?.environment || '',
      emotionalTone: c.analysis?.emotionalTone || '',
      editUtility: c.analysis?.editUtility || [],
    }))

    const currentEdit = {
      storyboard: context.storyboardClips.map(sc => ({
        id: sc.id,
        clipId: sc.clipId,
        fileName: sc.clip?.fileName || '',
        startTime: sc.startTime,
        endTime: sc.endTime,
        position: sc.position,
        description: sc.clip?.analysis?.description || '',
      })),
      sfx: context.sfxPlacements.map(s => ({
        id: s.id,
        category: s.category,
        searchQuery: s.searchQuery,
        timelineStart: s.timelineStart,
        timelineEnd: s.timelineEnd,
        volume: s.volume,
      })),
      transitions: context.transitions.map(t => ({
        id: t.id,
        afterClipPosition: t.afterClipPosition,
        presetName: t.presetName,
        duration: t.duration,
      })),
      narrative: context.narrative,
    }

    const systemPrompt = `${REVISION_SYSTEM}

${clientInstructions ? `\n${clientInstructions}\n` : ''}
## CURRENT EDIT

${JSON.stringify(currentEdit, null, 2)}

## AVAILABLE CLIPS (not all are in the current edit)

${JSON.stringify(clipSummaries, null, 2)}

## BRIEF

${JSON.stringify(context.brief, null, 2)}`

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: feedback },
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'

    try {
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

      if (parsed.learnedInstructions?.length > 0 && context.clientId) {
        for (const learned of parsed.learnedInstructions) {
          clientService.addInstruction(context.clientId, learned.category, learned.instruction)
        }
      }

      return {
        response: parsed.response || 'I made some adjustments.',
        storyboardUpdates: parsed.storyboardUpdates,
        sfxUpdates: parsed.sfxUpdates,
        transitionUpdates: parsed.transitionUpdates,
        learnedInstructions: parsed.learnedInstructions,
      }
    } catch {
      return { response: text }
    }
  }
}

export const revisionService = new RevisionService()
