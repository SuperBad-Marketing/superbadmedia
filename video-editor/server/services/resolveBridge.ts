import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import readline from 'readline'

interface ResolveStatus {
  connected: boolean
  version?: string
  project?: string | null
  timeline?: string | null
  error?: string
}

interface ResolveCommand {
  action: string
  params?: Record<string, any>
}

type PendingRequest = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

export class ResolveBridgeService {
  private process: ChildProcess | null = null
  private rl: readline.Interface | null = null
  private pendingRequests: PendingRequest[] = []
  private _status: ResolveStatus = { connected: false }
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  get status(): ResolveStatus {
    return this._status
  }

  async start(): Promise<ResolveStatus> {
    if (this.process) {
      return this._status
    }

    const bridgePath = path.join(process.cwd(), 'python', 'bridge.py')

    try {
      this.process = spawn('python3', [bridgePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this.rl = readline.createInterface({ input: this.process.stdout! })

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Bridge startup timeout')), 10000)

        const onFirstLine = (line: string) => {
          clearTimeout(timeout)
          try {
            const data = JSON.parse(line)
            if (data.ready) {
              resolve()
            } else {
              reject(new Error('Unexpected first message from bridge'))
            }
          } catch {
            reject(new Error('Invalid JSON from bridge'))
          }
        }

        this.rl!.once('line', onFirstLine)
      })

      this.rl.on('line', (line) => {
        if (this.pendingRequests.length === 0) return
        const pending = this.pendingRequests.shift()!
        clearTimeout(pending.timer)
        try {
          pending.resolve(JSON.parse(line))
        } catch {
          pending.resolve({ error: 'Invalid JSON response' })
        }
      })

      this.process.stderr?.on('data', (data) => {
        console.error('[Resolve Bridge]', data.toString().trim())
      })

      this.process.on('exit', (code) => {
        this._status = { connected: false }
        this.process = null
        this.rl = null
        for (const p of this.pendingRequests) {
          clearTimeout(p.timer)
          p.reject(new Error('Bridge process exited'))
        }
        this.pendingRequests = []

        if (code !== 0 && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.start().catch(() => {})
          }, 5000)
        }
      })

      await readyPromise

      const connectResult = await this.send({ action: 'connect' })
      this._status = connectResult as ResolveStatus

      return this._status
    } catch (err: any) {
      this.stop()
      this._status = { connected: false, error: err.message }
      return this._status
    }
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
    this._status = { connected: false }
  }

  async send(command: ResolveCommand): Promise<any> {
    if (!this.process?.stdin?.writable) {
      return { error: 'Bridge not running' }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingRequests.findIndex(p => p.timer === timer)
        if (idx !== -1) this.pendingRequests.splice(idx, 1)
        resolve({ error: 'Command timeout' })
      }, 30000)

      this.pendingRequests.push({ resolve, reject, timer })

      this.process!.stdin!.write(JSON.stringify(command) + '\n')
    })
  }

  async getStatus(): Promise<ResolveStatus> {
    if (!this.process) {
      return { connected: false, error: 'Bridge not started' }
    }
    const result = await this.send({ action: 'status' })
    this._status = result
    return result
  }

  async createProject(name: string, frameRate = 24, width = 1920, height = 1080) {
    return this.send({
      action: 'create_project',
      params: { name, frame_rate: frameRate, width, height },
    })
  }

  async importMedia(filePaths: string[]) {
    return this.send({
      action: 'import_media',
      params: { file_paths: filePaths },
    })
  }

  async createTimeline(name: string) {
    return this.send({
      action: 'create_timeline',
      params: { name },
    })
  }

  async addClipsToTimeline(clipIndices: number[]) {
    return this.send({
      action: 'add_clips',
      params: { clip_indices: clipIndices },
    })
  }

  async getTimelineClips() {
    return this.send({ action: 'get_timeline_clips' })
  }

  async setGrade(clipIndex: number, gradeParams: Record<string, any>) {
    return this.send({
      action: 'set_grade',
      params: { clip_index: clipIndex, grade_params: gradeParams },
    })
  }

  async applyLut(clipIndex: number, lutPath: string) {
    return this.send({
      action: 'apply_lut',
      params: { clip_index: clipIndex, lut_path: lutPath },
    })
  }

  async addTransition(clipIndex: number, transitionType = 'Cross Dissolve', duration = 1.0) {
    return this.send({
      action: 'add_transition',
      params: { clip_index: clipIndex, transition_type: transitionType, duration },
    })
  }

  async setClipSpeed(clipIndex: number, speedPercent: number) {
    return this.send({
      action: 'set_clip_speed',
      params: { clip_index: clipIndex, speed_percent: speedPercent },
    })
  }

  async addFusionComp(clipIndex: number, fusionScript = '') {
    return this.send({
      action: 'add_fusion_comp',
      params: { clip_index: clipIndex, fusion_script: fusionScript },
    })
  }

  async render(outputPath: string, width = 1920, height = 1080, codec = 'H.264', quality = 'High') {
    return this.send({
      action: 'render',
      params: { output_path: outputPath, width, height, codec, quality },
    })
  }

  async getRenderStatus() {
    return this.send({ action: 'render_status' })
  }

  async pushTimeline(
    projectName: string,
    clips: { filePath: string; startTime: number; endTime: number; position: number }[],
    transitions?: { afterClipPosition: number; type: string; duration: number }[],
  ): Promise<{ success: boolean; error?: string }> {
    if (!this._status.connected) {
      const connectResult = await this.start()
      if (!connectResult.connected) {
        return { success: false, error: 'Could not connect to Resolve' }
      }
    }

    const createResult = await this.createProject(projectName)
    if (createResult.error) {
      return { success: false, error: createResult.error }
    }

    const filePaths = [...new Set(clips.map(c => c.filePath))]
    const importResult = await this.importMedia(filePaths)
    if (importResult.error) {
      return { success: false, error: importResult.error }
    }

    const timelineResult = await this.createTimeline(projectName)
    if (timelineResult.error) {
      return { success: false, error: timelineResult.error }
    }

    const sorted = [...clips].sort((a, b) => a.position - b.position)
    const filePathToIndex = new Map(filePaths.map((fp, i) => [fp, i]))

    for (const clip of sorted) {
      const mediaIndex = filePathToIndex.get(clip.filePath) ?? 0
      await this.addClipsToTimeline([mediaIndex])
    }

    if (transitions) {
      for (const t of transitions) {
        await this.addTransition(t.afterClipPosition, t.type || 'Cross Dissolve', t.duration)
      }
    }

    return { success: true }
  }
}

export const resolveBridge = new ResolveBridgeService()
