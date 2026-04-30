import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

interface ExportConfig {
  clipPaths: string[]
  outputPath: string
  format: '16:9' | '9:16' | '1:1' | '4:5'
  codec: 'h264' | 'h265' | 'prores'
  resolution: '1080p' | '4k'
  musicTrack?: { path: string; volume: number }
}

interface ExportJob {
  id: string
  status: 'queued' | 'rendering' | 'complete' | 'error'
  progress: number
  outputPath: string
  error?: string
  startedAt: string
  completedAt?: string
}

const DIMENSIONS: Record<string, Record<string, { w: number; h: number }>> = {
  '16:9': { '1080p': { w: 1920, h: 1080 }, '4k': { w: 3840, h: 2160 } },
  '9:16': { '1080p': { w: 1080, h: 1920 }, '4k': { w: 2160, h: 3840 } },
  '1:1':  { '1080p': { w: 1080, h: 1080 }, '4k': { w: 2160, h: 2160 } },
  '4:5':  { '1080p': { w: 1080, h: 1350 }, '4k': { w: 2160, h: 2700 } },
}

const CODEC_FLAGS: Record<string, string[]> = {
  h264:   ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'],
  h265:   ['-c:v', 'libx265', '-preset', 'medium', '-crf', '20'],
  prores: ['-c:v', 'prores_ks', '-profile:v', '3'],
}

export class ExportService {
  private jobs: Map<string, ExportJob> = new Map()

  async startRender(config: ExportConfig): Promise<ExportJob> {
    if (!config.clipPaths.length) {
      throw new Error('No clips provided for export')
    }

    for (const clip of config.clipPaths) {
      if (!fs.existsSync(clip)) {
        throw new Error(`Clip not found: ${clip}`)
      }
    }

    const id = crypto.randomUUID()
    const job: ExportJob = {
      id,
      status: 'queued',
      progress: 0,
      outputPath: config.outputPath,
      startedAt: new Date().toISOString(),
    }

    this.jobs.set(id, job)
    this.runRender(id, config)
    return job
  }

  getStatus(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId)
  }

  private async runRender(jobId: string, config: ExportConfig) {
    const job = this.jobs.get(jobId)!
    job.status = 'rendering'

    let concatListPath: string | undefined

    try {
      // Build the concat demuxer list file
      concatListPath = path.join(os.tmpdir(), `superedits-concat-${jobId}.txt`)
      const listContent = config.clipPaths
        .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
        .join('\n')
      fs.writeFileSync(concatListPath, listContent)

      // Resolve dimensions
      const dim = DIMENSIONS[config.format]?.[config.resolution]
      if (!dim) {
        throw new Error(`Invalid format/resolution: ${config.format} / ${config.resolution}`)
      }

      // Build ffmpeg args
      const args: string[] = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
      ]

      // Add music input if provided
      if (config.musicTrack) {
        if (!fs.existsSync(config.musicTrack.path)) {
          throw new Error(`Music track not found: ${config.musicTrack.path}`)
        }
        args.push('-i', config.musicTrack.path)
      }

      // Video filter: scale + pad to target dimensions
      const vf = `scale=${dim.w}:${dim.h}:force_original_aspect_ratio=decrease,pad=${dim.w}:${dim.h}:(ow-iw)/2:(oh-ih)/2`
      args.push('-vf', vf)

      // Audio filter: mix music if present
      if (config.musicTrack) {
        const vol = config.musicTrack.volume ?? 0.3
        args.push(
          '-filter_complex',
          `[0:a][1:a]amix=inputs=2:duration=shortest:weights=1 ${vol}`,
        )
      } else {
        args.push('-c:a', 'aac', '-b:a', '192k')
      }

      // Codec flags
      const codecFlags = CODEC_FLAGS[config.codec]
      if (!codecFlags) {
        throw new Error(`Unsupported codec: ${config.codec}`)
      }
      args.push(...codecFlags)

      // Output
      const outputDir = path.dirname(config.outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      args.push(config.outputPath)

      // Spawn ffmpeg
      const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })

      let totalDuration = 0

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const text = data.toString()

        // Try to grab total duration from the initial file info
        const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
        if (durationMatch && totalDuration === 0) {
          const [, h, m, s] = durationMatch.map(Number)
          totalDuration = h * 3600 + m * 60 + s
        }

        // Parse progress from time= lines
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
        if (timeMatch && totalDuration > 0) {
          const [, h, m, s] = timeMatch.map(Number)
          const currentTime = h * 3600 + m * 60 + s
          job.progress = Math.min(99, Math.round((currentTime / totalDuration) * 100))
        }
      })

      ffmpeg.on('close', (code) => {
        // Clean up temp file
        if (concatListPath && fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath)
        }

        if (code === 0) {
          job.status = 'complete'
          job.progress = 100
          job.completedAt = new Date().toISOString()
        } else {
          job.status = 'error'
          job.error = `ffmpeg exited with code ${code}`
        }
      })

      ffmpeg.on('error', (err) => {
        if (concatListPath && fs.existsSync(concatListPath)) {
          fs.unlinkSync(concatListPath)
        }
        job.status = 'error'
        job.error = `Failed to spawn ffmpeg: ${err.message}`
      })
    } catch (err: any) {
      if (concatListPath && fs.existsSync(concatListPath)) {
        fs.unlinkSync(concatListPath)
      }
      job.status = 'error'
      job.error = err.message
    }
  }
}
