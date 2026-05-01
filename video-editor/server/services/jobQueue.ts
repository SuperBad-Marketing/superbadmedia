import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { BriefAssembler, type BriefFields } from './briefAssembler.js'
import { IngestService } from './ingest.js'
import { VisionAnalysisService } from './visionAnalysis.js'
import { clientService } from './clients.js'
import { resolveBridge } from './resolveBridge.js'
import Anthropic from '@anthropic-ai/sdk'

export interface StructuredBrief {
  businessName: string
  contactName: string
  email: string
  projectTitle?: string
  briefType: 'shoot' | 'edit' | 'shoot-edit'
  description: string
  keyMessages?: string
  targetAudience?: string
  deliverables?: string
  styleReferences?: string
  budgetRange?: string
  deliveryDate?: string
  notes?: string
}

export interface QueueJob {
  id: string
  projectId: string
  projectName: string
  sourcePath: string
  clientId?: string
  structuredBrief: StructuredBrief
  editBrief?: BriefFields
  status: 'pending' | 'importing' | 'analyzing-vision' | 'translating' | 'assembling' | 'pushing-resolve' | 'saving' | 'complete' | 'error'
  progress: number
  statusText: string
  result?: { clipCount: number; totalDuration: number; narrative: string; resolveProject?: string }
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

const QUEUE_DIR = path.join(process.cwd(), '.queue')
const QUEUE_FILE = path.join(QUEUE_DIR, 'jobs.json')
const PROJECTS_DIR = path.join(process.cwd(), 'projects')

class JobQueue {
  private jobs: QueueJob[] = []
  private processing = false
  private assembler = new BriefAssembler()
  private ingestService = new IngestService()
  private visionService = new VisionAnalysisService()

  constructor() {
    fs.mkdirSync(QUEUE_DIR, { recursive: true })
    fs.mkdirSync(PROJECTS_DIR, { recursive: true })
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        this.jobs = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'))
      }
    } catch {
      this.jobs = []
    }
  }

  private save() {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.jobs, null, 2))
  }

  getAll(): QueueJob[] {
    return this.jobs
  }

  get(id: string): QueueJob | undefined {
    return this.jobs.find(j => j.id === id)
  }

  isProcessing(): boolean {
    return this.processing
  }

  add(sourcePath: string, brief: StructuredBrief, clientId?: string): QueueJob {
    const projectName = brief.projectTitle || `${brief.businessName} — ${brief.briefType}`
    const job: QueueJob = {
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      projectName,
      sourcePath,
      clientId,
      structuredBrief: brief,
      status: 'pending',
      progress: 0,
      statusText: 'Waiting in queue',
      createdAt: new Date().toISOString(),
    }
    this.jobs.push(job)
    this.save()
    return job
  }

  remove(id: string): boolean {
    const idx = this.jobs.findIndex(j => j.id === id)
    if (idx === -1) return false
    const activeStatuses = ['importing', 'analyzing-vision', 'translating', 'assembling', 'saving']
    if (activeStatuses.includes(this.jobs[idx].status)) return false
    this.jobs.splice(idx, 1)
    this.save()
    return true
  }

  async startProcessing() {
    if (this.processing) return
    this.processing = true

    while (this.processing) {
      const next = this.jobs.find(j => j.status === 'pending')
      if (!next) {
        this.processing = false
        break
      }
      await this.processJob(next)
    }
  }

  stopProcessing() {
    this.processing = false
  }

  private updateJob(id: string, updates: Partial<QueueJob>) {
    const job = this.jobs.find(j => j.id === id)
    if (job) {
      Object.assign(job, updates)
      this.save()
    }
  }

  private async processJob(job: QueueJob) {
    job.startedAt = new Date().toISOString()

    try {
      // --- Step 1: Import footage ---
      this.updateJob(job.id, {
        status: 'importing',
        progress: 5,
        statusText: 'Importing footage',
      })

      const ingestJob = await this.ingestService.startIngest(
        job.sourcePath,
        job.structuredBrief.businessName,
        'folder',
      )
      job.projectId = ingestJob.projectId

      // Poll ingest until complete
      let ingest = this.ingestService.getJob(ingestJob.id)
      while (ingest && ingest.status !== 'complete' && ingest.status !== 'error') {
        await new Promise(r => setTimeout(r, 500))
        ingest = this.ingestService.getJob(ingestJob.id)
        if (ingest) {
          const ingestProgress = Math.round(ingest.progress * 0.35)
          this.updateJob(job.id, {
            progress: 5 + ingestProgress,
            statusText: ingest.status === 'copying'
              ? `Copying files (${ingest.processedFiles}/${ingest.totalFiles})`
              : ingest.status === 'analyzing'
                ? `Analyzing clips (${ingest.processedFiles}/${ingest.totalFiles})`
                : ingest.status === 'cleaning-audio'
                  ? 'Cleaning up audio'
                  : 'Importing footage',
          })
        }
      }

      if (!ingest || ingest.status === 'error') {
        throw new Error(ingest?.errors?.[0] || 'Footage import failed')
      }

      const clips = ingest.clips || []
      if (clips.length === 0) {
        throw new Error('No media files found in footage folder')
      }

      // --- Step 2: Vision analysis ---
      this.updateJob(job.id, {
        status: 'analyzing-vision',
        progress: 40,
        statusText: `Watching footage — 0 of ${clips.length}`,
      })

      let analyzedCount = 0
      for (const clip of clips) {
        if (clip.analysis?.visionAnalyzed) {
          analyzedCount++
          continue
        }
        try {
          const visionResult = await this.visionService.analyzeClipVision(
            clip.filePath,
            clip.id,
            clip.duration,
          )
          clip.analysis = { ...clip.analysis, ...visionResult, visionAnalyzed: true }
        } catch (err: any) {
          console.error(`Vision analysis failed for ${clip.fileName}:`, err.message)
        }
        analyzedCount++
        this.updateJob(job.id, {
          progress: 40 + Math.round((analyzedCount / clips.length) * 20),
          statusText: `Watching footage — ${analyzedCount} of ${clips.length}`,
        })
      }

      // --- Step 3: Translate brief (with client instructions) ---
      this.updateJob(job.id, {
        status: 'translating',
        progress: 62,
        statusText: 'Reading the brief',
      })

      const clientInstructions = job.clientId ? clientService.getInstructionsPrompt(job.clientId) : ''
      const editBrief = await this.translateBrief(job.structuredBrief, clientInstructions)
      this.updateJob(job.id, { editBrief, progress: 68, statusText: 'Brief translated' })

      // --- Step 4: Assemble ---
      this.updateJob(job.id, {
        status: 'assembling',
        progress: 70,
        statusText: 'Building the rough cut',
      })

      const result = await this.assembler.assemble(editBrief, clips, {})

      // --- Step 5: Push to Resolve ---
      let resolveProjectName: string | undefined
      if (resolveBridge.status.connected) {
        this.updateJob(job.id, {
          status: 'pushing-resolve',
          progress: 88,
          statusText: 'Pushing timeline to Resolve',
        })

        const timelineClips = result.storyboardClips.map((sc: any) => ({
          filePath: sc.filePath,
          startTime: sc.startTime,
          endTime: sc.endTime,
          position: sc.position,
        }))

        const timelineTransitions = result.transitions.map((t: any) => ({
          afterClipPosition: t.afterClipPosition,
          type: t.presetName || 'Cross Dissolve',
          duration: t.duration,
        }))

        resolveProjectName = job.projectName
        const pushResult = await resolveBridge.pushTimeline(
          resolveProjectName,
          timelineClips,
          timelineTransitions,
        )

        if (!pushResult.success) {
          console.error('Resolve push failed:', pushResult.error)
          resolveProjectName = undefined
        }
      }

      // --- Step 6: Save project ---
      this.updateJob(job.id, {
        status: 'saving',
        progress: 94,
        statusText: 'Saving project',
      })

      if (job.clientId) {
        clientService.addProjectId(job.clientId, job.projectId)
      }

      const projectData = {
        id: job.projectId,
        name: job.projectName,
        clientName: job.structuredBrief.businessName,
        clientId: job.clientId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'editing',
        clipCount: clips.length,
        storyboardClipCount: result.storyboardClips.length,
        totalDuration: result.totalDuration,
        state: {
          currentProject: {
            id: job.projectId,
            name: job.projectName,
            clientName: job.structuredBrief.businessName,
            clientId: job.clientId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'editing',
          },
          clips,
          storyboardClips: result.storyboardClips.map((sc: any) => {
            const clip = clips.find((c: any) => c.id === sc.clipId)
            return {
              id: sc.id,
              clipId: sc.clipId,
              clip: clip || null,
              startTime: sc.startTime,
              endTime: sc.endTime,
              position: sc.position,
            }
          }),
          sfxPlacements: result.sfxPlacements,
          editTransitions: result.transitions,
          chatMessages: [],
          selectedTrack: null,
        },
      }

      fs.writeFileSync(
        path.join(PROJECTS_DIR, `${job.projectId}.json`),
        JSON.stringify(projectData, null, 2),
      )

      this.updateJob(job.id, {
        status: 'complete',
        progress: 100,
        statusText: resolveProjectName
          ? `Done — ${result.storyboardClips.length} clips, ${Math.round(result.totalDuration)}s. Resolve project: ${resolveProjectName}`
          : `Done — ${result.storyboardClips.length} clips, ${Math.round(result.totalDuration)}s`,
        result: {
          clipCount: result.storyboardClips.length,
          totalDuration: result.totalDuration,
          narrative: result.narrative,
          resolveProject: resolveProjectName,
        },
        completedAt: new Date().toISOString(),
      })
    } catch (err: any) {
      this.updateJob(job.id, {
        status: 'error',
        progress: 0,
        statusText: err.message || 'Unknown error',
        error: err.message || 'Unknown error',
        completedAt: new Date().toISOString(),
      })
    }
  }

  private async translateBrief(brief: StructuredBrief, clientInstructions?: string): Promise<BriefFields> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return this.translateBriefFallback(brief)
    }

    const client = new Anthropic({ apiKey })

    const prompt = `You are translating a client brief into video editing parameters. The client has submitted a brief for a video project. Extract the editing parameters from their description.
${clientInstructions ? `\n${clientInstructions}\n\nApply the client-specific instructions above when determining mood, pacing, duration, and clip selection hints.\n` : ''}
CLIENT BRIEF:
- Business: ${brief.businessName}
- Project: ${brief.projectTitle || 'Untitled'}
- Type: ${brief.briefType}
- What they need: ${brief.description}
${brief.keyMessages ? `- Key messages: ${brief.keyMessages}` : ''}
${brief.targetAudience ? `- Target audience: ${brief.targetAudience}` : ''}
${brief.deliverables ? `- Deliverables: ${brief.deliverables}` : ''}
${brief.styleReferences ? `- Style references: ${brief.styleReferences}` : ''}
${brief.notes ? `- Additional notes: ${brief.notes}` : ''}

Respond with ONLY a JSON object with these fields:
- "duration": target length in seconds (default 30 for reels, 60 for short-form, 120+ for long-form)
- "platform": "instagram-reel", "youtube-short", "tiktok", "youtube", "linkedin", "facebook", or "generic"
- "mood": one or two words (e.g. "high-energy", "warm", "cinematic")
- "pacing": "fast", "medium", or "slow"
- "musicKeywords": 2-4 word music search query
- "narrativeNotes": preserve all client detail about structure, timing, desired feel
- "clipSelectionHints": what clips to prioritise based on their brief
- "moodAxes": { "intensity": 0-100, "intimacy": 0-100, "chaos": 0-100 }`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

    return {
      duration: parsed.duration || 30,
      platform: parsed.platform || 'instagram-reel',
      mood: parsed.mood || 'cinematic',
      pacing: parsed.pacing || 'medium',
      musicKeywords: parsed.musicKeywords || 'cinematic',
      narrativeNotes: parsed.narrativeNotes || brief.description,
      clipSelectionHints: parsed.clipSelectionHints || '',
      moodAxes: {
        intensity: Math.max(0, Math.min(100, parsed.moodAxes?.intensity ?? 50)),
        intimacy: Math.max(0, Math.min(100, parsed.moodAxes?.intimacy ?? 50)),
        chaos: Math.max(0, Math.min(100, parsed.moodAxes?.chaos ?? 50)),
      },
    }
  }

  private translateBriefFallback(brief: StructuredBrief): BriefFields {
    const isShortForm = brief.deliverables?.toLowerCase().includes('reel') ||
      brief.deliverables?.toLowerCase().includes('short') ||
      brief.deliverables?.toLowerCase().includes('tiktok')

    return {
      duration: isShortForm ? 30 : 60,
      platform: isShortForm ? 'instagram-reel' : 'generic',
      mood: 'cinematic',
      pacing: 'medium',
      musicKeywords: 'cinematic upbeat',
      narrativeNotes: brief.description,
      clipSelectionHints: brief.keyMessages || '',
      moodAxes: { intensity: 50, intimacy: 50, chaos: 50 },
    }
  }
}

export const jobQueue = new JobQueue()
