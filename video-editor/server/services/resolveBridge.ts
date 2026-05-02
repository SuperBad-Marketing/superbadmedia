import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import readline from 'readline'

interface ResolveStatus {
  connected: boolean
  version?: string
  project?: string | null
  timeline?: string | null
  error?: string
  ffmpeg?: boolean
  sox?: boolean
}

interface ResolveCommand {
  action: string
  params?: Record<string, any>
}

interface FusionIngredient {
  id: string
  variant?: string
  params?: Record<string, any>
  fusion_script?: string
  tool_name?: string
}

interface AudioFilter {
  type: 'lowpass' | 'highpass' | 'bandpass' | 'reverb' | 'echo' | 'pitch' | 'speed' | 'flanger' | 'phaser' | 'overdrive' | 'downsample'
  [key: string]: any
}

interface RegisteredEffect {
  id: string
  ingredient_id: string
  variant: string
  type: string
  bypassed: boolean
  parameters: Record<string, any>
}

interface ClipEffectsState {
  clip_index: number
  color_nodes: { index: number; params: Record<string, any> }[]
  fusion_tools: { name: string; type: string }[]
  resolve_fx: { name: string; params: Record<string, any> }[]
  speed: number
  retime_mode: string
  transform: Record<string, number>
  audio_volume: number
  audio_muted: boolean
  audio_pan: number
  registered_effects: RegisteredEffect[]
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

    const slowActions = new Set(['load_project', 'close_project', 'render', 'build_compound_fusion', 'inject_fusion_comp'])
    const timeoutMs = slowActions.has(command.action) ? 120000 : 30000

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingRequests.findIndex(p => p.timer === timer)
        if (idx !== -1) this.pendingRequests.splice(idx, 1)
        resolve({ error: 'Command timeout' })
      }, timeoutMs)

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

  // --- Visual effects ---

  async applyResolveFx(clipIndex: number, effectName: string, parameters?: Record<string, any>) {
    return this.send({ action: 'apply_resolve_fx', params: { clip_index: clipIndex, effect_name: effectName, parameters } })
  }

  async injectFusionComp(clipIndex: number, fusionScript: string) {
    return this.send({ action: 'inject_fusion_comp', params: { clip_index: clipIndex, fusion_script: fusionScript } })
  }

  async buildCompoundFusion(clipIndex: number, ingredients: FusionIngredient[]) {
    return this.send({ action: 'build_compound_fusion', params: { clip_index: clipIndex, ingredients } })
  }

  async setFusionParam(clipIndex: number, toolName: string, param: string, value: any) {
    return this.send({ action: 'set_fusion_param', params: { clip_index: clipIndex, tool_name: toolName, param, value } })
  }

  // --- Colour ---

  async applyCst(clipIndex: number, nodeIndex: number, inputColorSpace: string, inputGamma: string, outputColorSpace = 'Rec.709', outputGamma = 'Gamma 2.4') {
    return this.send({ action: 'apply_cst', params: { clip_index: clipIndex, node_index: nodeIndex, input_color_space: inputColorSpace, input_gamma: inputGamma, output_color_space: outputColorSpace, output_gamma: outputGamma } })
  }

  async addColorNode(clipIndex: number, nodeType: 'serial' | 'parallel' | 'layer' = 'serial') {
    return this.send({ action: 'add_color_node', params: { clip_index: clipIndex, node_type: nodeType } })
  }

  async setNodeParams(clipIndex: number, nodeIndex: number, params: Record<string, any>) {
    return this.send({ action: 'set_node_params', params: { clip_index: clipIndex, node_index: nodeIndex, params } })
  }

  async setKeyframe(clipIndex: number, nodeIndex: number, param: string, frame: number, value: number) {
    return this.send({ action: 'set_keyframe', params: { clip_index: clipIndex, node_index: nodeIndex, param, frame, value } })
  }

  // --- Audio Tier A ---

  async setClipVolume(clipIndex: number, volumeDb: number) {
    return this.send({ action: 'set_clip_volume', params: { clip_index: clipIndex, volume_db: volumeDb } })
  }

  async setVolumeKeyframe(clipIndex: number, frame: number, volumeDb: number) {
    return this.send({ action: 'set_volume_keyframe', params: { clip_index: clipIndex, frame, volume_db: volumeDb } })
  }

  async setClipPan(clipIndex: number, pan: number) {
    return this.send({ action: 'set_clip_pan', params: { clip_index: clipIndex, pan } })
  }

  async muteClipAudio(clipIndex: number, muted: boolean) {
    return this.send({ action: 'mute_clip_audio', params: { clip_index: clipIndex, muted } })
  }

  async addAudioTrack(name = 'SFX') {
    return this.send({ action: 'add_audio_track', params: { name } })
  }

  async importAudioToTrack(trackIndex: number, filePath: string, timelinePosition: number) {
    return this.send({ action: 'import_audio_to_track', params: { track_index: trackIndex, file_path: filePath, timeline_position: timelinePosition } })
  }

  // --- Audio Tier B ---

  async preprocessAudio(sourceFilePath: string, startTime: number, endTime: number, filters: AudioFilter[]) {
    return this.send({ action: 'preprocess_audio', params: { source_file_path: sourceFilePath, start_time: startTime, end_time: endTime, filters } })
  }

  async replaceClipAudio(clipIndex: number, processedAudioPath: string) {
    return this.send({ action: 'replace_clip_audio', params: { clip_index: clipIndex, processed_audio_path: processedAudioPath } })
  }

  // --- Timeline operations ---

  async addAdjustmentLayer(startFrame: number, endFrame: number) {
    return this.send({ action: 'add_adjustment_layer', params: { start_frame: startFrame, end_frame: endFrame } })
  }

  async setCompositeMode(clipIndex: number, mode: string) {
    return this.send({ action: 'set_composite_mode', params: { clip_index: clipIndex, mode } })
  }

  async duplicateToTrack(clipIndex: number, targetTrack: number) {
    return this.send({ action: 'duplicate_to_track', params: { clip_index: clipIndex, target_track: targetTrack } })
  }

  async addMarker(clipIndex: number, frame: number, color = 'Blue', name = '', note = '') {
    return this.send({ action: 'add_marker', params: { clip_index: clipIndex, frame, color, name, note } })
  }

  async razorAt(clipIndex: number, frame: number) {
    return this.send({ action: 'razor_at', params: { clip_index: clipIndex, frame } })
  }

  async setSpeedCurve(clipIndex: number, keyframes: { frame: number; speed: number }[]) {
    return this.send({ action: 'set_speed_curve', params: { clip_index: clipIndex, keyframes } })
  }

  // --- Clip properties ---

  async setClipOpacity(clipIndex: number, opacity: number) {
    return this.send({ action: 'set_clip_opacity', params: { clip_index: clipIndex, opacity } })
  }

  async setRetiming(clipIndex: number, mode: 'optical_flow' | 'nearest' | 'frame_blend', speed: number) {
    return this.send({ action: 'set_retiming', params: { clip_index: clipIndex, mode, speed } })
  }

  async setClipTransform(clipIndex: number, params: Record<string, number>) {
    return this.send({ action: 'set_clip_transform', params: { clip_index: clipIndex, params } })
  }

  async stabilize(clipIndex: number, mode: 'translation' | 'perspective' = 'perspective', strength = 1.0) {
    return this.applyResolveFx(clipIndex, 'Stabilization', { mode, strength, zoom: mode === 'perspective' })
  }

  // --- Effect management ---

  async getClipEffectsState(clipIndex: number): Promise<ClipEffectsState> {
    return this.send({ action: 'get_clip_effects_state', params: { clip_index: clipIndex } })
  }

  async removeEffect(clipIndex: number, effectId: string) {
    return this.send({ action: 'remove_effect', params: { clip_index: clipIndex, effect_id: effectId } })
  }

  async updateEffectParam(clipIndex: number, effectId: string, param: string, value: any) {
    return this.send({ action: 'update_effect_param', params: { clip_index: clipIndex, effect_id: effectId, param, value } })
  }

  async bypassEffect(clipIndex: number, effectId: string, bypassed: boolean) {
    return this.send({ action: 'bypass_effect', params: { clip_index: clipIndex, effect_id: effectId, bypassed } })
  }

  async renderStill(clipIndex: number, frame: number, effectsMask?: string[]): Promise<{ still_path?: string; success: boolean }> {
    return this.send({ action: 'render_still', params: { clip_index: clipIndex, frame, effects_mask: effectsMask } })
  }

  async reorderEffects(clipIndex: number, effectIds: string[]) {
    return this.send({ action: 'reorder_effects', params: { clip_index: clipIndex, effect_ids: effectIds } })
  }

  async listProjects(): Promise<{ projects: string[] }> {
    return this.send({ action: 'list_projects' })
  }

  async loadProject(name: string) {
    return this.send({ action: 'load_project', params: { name } })
  }

  async closeProject() {
    return this.send({ action: 'close_project' })
  }

  async addPowerWindow(clipIndex: number, nodeIndex?: number, windowType = 'circular', params?: Record<string, any>) {
    return this.send({ action: 'add_power_window', params: { clip_index: clipIndex, node_index: nodeIndex, window_type: windowType, params } })
  }

  async addQualifier(clipIndex: number, nodeIndex?: number, qualifierType = 'hsl', params?: Record<string, any>) {
    return this.send({ action: 'add_qualifier', params: { clip_index: clipIndex, node_index: nodeIndex, qualifier_type: qualifierType, params } })
  }

  async setupMagicMask(clipIndex: number, maskMode = 'person', nodeIndex?: number) {
    return this.send({ action: 'setup_magic_mask', params: { clip_index: clipIndex, mask_mode: maskMode, node_index: nodeIndex } })
  }

  async setupMaskedGrade(clipIndex: number, maskType = 'magic_mask', maskParams?: Record<string, any>, gradeParams?: Record<string, any>, invert = false) {
    return this.send({ action: 'setup_masked_grade', params: { clip_index: clipIndex, mask_type: maskType, mask_params: maskParams, grade_params: gradeParams, invert } })
  }

  // --- Transport ---

  async getPlayhead(): Promise<{ timecode?: string; error?: string }> {
    return this.send({ action: 'get_playhead' })
  }

  async seekTimecode(timecode: string): Promise<{ success: boolean; timecode?: string; error?: string }> {
    return this.send({ action: 'seek_timecode', params: { timecode } })
  }

  async transportPlay(): Promise<{ success: boolean; error?: string }> {
    return this.send({ action: 'transport_play' })
  }

  async transportStop(): Promise<{ success: boolean; error?: string }> {
    return this.send({ action: 'transport_stop' })
  }

  // --- Full timeline push ---

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
