import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import fss from 'fs'
import crypto from 'crypto'

const execAsync = promisify(exec)

interface ClipMetadata {
  id: string
  filePath: string
  fileName: string
  thumbnailPath: string
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  isLog: boolean
  camera: string | null
  fileSize: number
  bitrate: number
  audioCodec: string | null
  audioChannels: number
  createdAt: string
}

interface ClipAnalysisResult extends ClipMetadata {
  analysis: {
    sharpness: number
    exposure: number
    hasFaces: boolean
    faceCount: number
    movementLevel: 'static' | 'low' | 'medium' | 'high'
    energyLevel: number
    contentTags: string[]
    qualityRating: number
    audioQuality: 'good' | 'fair' | 'poor' | 'none'
    description: string
  }
}

const THUMBNAIL_DIR = path.join(process.cwd(), '.thumbnails')

export class ClipAnalysisService {
  private analysedClips: ClipAnalysisResult[] = []

  constructor() {
    fss.mkdirSync(THUMBNAIL_DIR, { recursive: true })
  }

  getAllAnalysed(): ClipAnalysisResult[] {
    return this.analysedClips
  }

  async analyzeClip(filePath: string, projectId: string): Promise<ClipAnalysisResult> {
    const id = crypto.randomUUID()
    const fileName = path.basename(filePath)

    const metadata = await this.getMetadata(filePath)
    const thumbnailPath = await this.generateThumbnail(filePath, id, metadata.duration)
    const analysis = this.analyzeQuality(filePath, metadata)

    const result: ClipAnalysisResult = {
      id,
      filePath,
      fileName,
      thumbnailPath,
      ...metadata,
      analysis,
    }

    const existing = this.analysedClips.findIndex(c => c.filePath === filePath)
    if (existing !== -1) {
      this.analysedClips[existing] = result
    } else {
      this.analysedClips.push(result)
    }

    return result
  }

  async analyzeDirectory(
    dirPath: string,
    projectId: string,
    onClipReady?: (clip: ClipAnalysisResult, done: number, total: number) => void,
  ): Promise<ClipAnalysisResult[]> {
    const videoExtensions = new Set(['.mp4', '.mov', '.mxf', '.avi', '.mkv', '.m4v', '.mts', '.r3d', '.braw'])

    const files = (await this.walkDir(dirPath)).filter(f => {
      const ext = path.extname(f).toLowerCase()
      return videoExtensions.has(ext)
    })

    const CONCURRENCY = 4
    const results: ClipAnalysisResult[] = []

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map(file => this.analyzeClip(file, projectId))
      )
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          onClipReady?.(result.value, results.length, files.length)
        }
      }
    }

    return results
  }

  private async getMetadata(filePath: string): Promise<Omit<ClipMetadata, 'id' | 'filePath' | 'fileName' | 'thumbnailPath'>> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        { timeout: 30000 }
      )

      const probe = JSON.parse(stdout)
      const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video')
      const audioStream = probe.streams?.find((s: any) => s.codec_type === 'audio')
      const format = probe.format || {}

      if (!videoStream) throw new Error('No video stream found')

      const fpsStr = videoStream.r_frame_rate || '24/1'
      const fpsParts = fpsStr.split('/')
      const fps = fpsParts.length === 2 ? Math.round(Number(fpsParts[0]) / Number(fpsParts[1])) : 24

      const colorTransfer = videoStream.color_transfer || ''
      const colorSpace = videoStream.color_space || ''
      const isLog = colorTransfer.includes('log') ||
                    colorTransfer.includes('slog') ||
                    colorSpace.includes('log') ||
                    (videoStream.bits_per_raw_sample && Number(videoStream.bits_per_raw_sample) >= 10)

      const camera = format.tags?.make || format.tags?.model ||
                     format.tags?.com_apple_quicktime_make || null

      return {
        duration: Number(format.duration || videoStream.duration || 0),
        width: videoStream.width || 1920,
        height: videoStream.height || 1080,
        fps,
        codec: videoStream.codec_name || 'unknown',
        isLog,
        camera,
        fileSize: Number(format.size || 0),
        bitrate: Number(format.bit_rate || 0),
        audioCodec: audioStream?.codec_name || null,
        audioChannels: audioStream?.channels || 0,
        createdAt: format.tags?.creation_time || new Date().toISOString(),
      }
    } catch (err: any) {
      throw new Error(`Failed to probe ${filePath}: ${err.message}`)
    }
  }

  private async generateThumbnail(filePath: string, clipId: string, duration: number): Promise<string> {
    const timestamp = Math.max(0, duration * 0.25)
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${clipId}.jpg`)

    try {
      await execAsync(
        `ffmpeg -y -ss ${timestamp} -i "${filePath}" -vframes 1 -q:v 3 -vf "scale=320:-1" "${thumbnailPath}"`,
        { timeout: 15000 }
      )
    } catch {
      try {
        await execAsync(
          `ffmpeg -y -i "${filePath}" -vframes 1 -q:v 3 -vf "scale=320:-1" "${thumbnailPath}"`,
          { timeout: 15000 }
        )
      } catch {
        return ''
      }
    }

    return thumbnailPath
  }

  private analyzeQuality(filePath: string, metadata: Omit<ClipMetadata, 'id' | 'filePath' | 'fileName' | 'thumbnailPath'>): ClipAnalysisResult['analysis'] {
    const pixelRate = metadata.width * metadata.height * metadata.fps
    const bitsPerPixel = metadata.bitrate / Math.max(1, pixelRate)
    const sharpness = Math.min(95, Math.max(30, bitsPerPixel * 500))

    const exposure = metadata.isLog ? -0.5 : 0

    let movementLevel: 'static' | 'low' | 'medium' | 'high' = 'medium'
    let energyLevel = 50

    if (metadata.duration > 0.5) {
      const frameCount = metadata.fps * metadata.duration
      if (frameCount > 10) {
        const bpp = metadata.bitrate / (metadata.width * metadata.height * metadata.fps)
        if (bpp < 0.05) { movementLevel = 'static'; energyLevel = 15 }
        else if (bpp < 0.1) { movementLevel = 'low'; energyLevel = 30 }
        else if (bpp < 0.2) { movementLevel = 'medium'; energyLevel = 55 }
        else { movementLevel = 'high'; energyLevel = 80 }
      }
    }

    let audioQuality: 'good' | 'fair' | 'poor' | 'none' = 'none'
    if (metadata.audioCodec) {
      if (metadata.audioChannels >= 2 && metadata.bitrate > 128000) audioQuality = 'good'
      else if (metadata.audioChannels >= 1) audioQuality = 'fair'
      else audioQuality = 'poor'
    }

    const resScore = Math.min(1, (metadata.width * metadata.height) / (1920 * 1080))
    const sharpScore = sharpness / 100
    const fpsScore = metadata.fps >= 24 ? 1 : 0.7
    const qualityRating = Math.round(Math.max(1, Math.min(5,
      (resScore * 1.5 + sharpScore * 2 + fpsScore * 1.5) / 5 * 5
    )))

    const contentTags: string[] = []
    if (metadata.width > 1920) contentTags.push('4K')
    else if (metadata.width >= 1920) contentTags.push('1080p')
    else contentTags.push('sub-HD')

    if (metadata.isLog) contentTags.push('LOG')
    if (metadata.fps >= 60) contentTags.push('slow-mo')
    if (metadata.fps >= 120) contentTags.push('high-fps')
    if (movementLevel === 'high') contentTags.push('dynamic')
    if (movementLevel === 'static') contentTags.push('tripod')
    if (metadata.duration < 3) contentTags.push('short')
    if (metadata.duration > 30) contentTags.push('long-take')

    return {
      sharpness: Math.round(sharpness),
      exposure: Math.round(exposure * 10) / 10,
      hasFaces: false,
      faceCount: 0,
      movementLevel,
      energyLevel,
      contentTags,
      qualityRating,
      audioQuality,
      description: `${metadata.width}x${metadata.height} ${metadata.codec} at ${metadata.fps}fps, ${Math.round(metadata.duration)}s`,
    }
  }

  private async walkDir(dir: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (entry.name === '__MACOSX') continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...await this.walkDir(fullPath))
        } else {
          files.push(fullPath)
        }
      }
    } catch { }
    return files
  }
}

let sharedInstance: ClipAnalysisService | null = null

export function getClipAnalysisService(): ClipAnalysisService {
  if (!sharedInstance) {
    sharedInstance = new ClipAnalysisService()
  }
  return sharedInstance
}
