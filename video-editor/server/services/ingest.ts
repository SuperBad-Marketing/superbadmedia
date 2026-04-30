import fs from 'fs/promises'
import fss from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import { getClipAnalysisService } from './clipAnalysis.js'

interface IngestJob {
  id: string
  projectId: string
  sourcePath: string
  sourceType: 'card' | 'folder'
  status: 'pending' | 'copying' | 'analyzing' | 'creating-project' | 'complete' | 'error'
  progress: number
  totalFiles: number
  processedFiles: number
  errors: string[]
  destinationPath?: string
  clips?: any[]
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mxf', '.avi', '.mkv', '.m4v', '.mpg', '.mts', '.r3d', '.braw', '.ari'])
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aac', '.flac', '.aif', '.aiff'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.cr2', '.cr3', '.arw', '.nef', '.dng'])
const MEDIA_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS])

const PROJECTS_DIR = path.join(os.homedir(), 'SuperEdits', 'projects')

export class IngestService {
  private jobs: Map<string, IngestJob> = new Map()

  async startIngest(sourcePath: string, clientName: string, sourceType: 'card' | 'folder'): Promise<IngestJob> {
    const id = crypto.randomUUID()
    const projectId = crypto.randomUUID()
    const date = new Date().toISOString().split('T')[0]
    const safeName = clientName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')
    const destBase = path.join(PROJECTS_DIR, `${safeName}_${date}_${id.slice(0, 8)}`)

    const job: IngestJob = {
      id,
      projectId,
      sourcePath,
      sourceType,
      status: 'pending',
      progress: 0,
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      destinationPath: destBase,
    }

    this.jobs.set(id, job)
    this.runIngest(job, destBase)
    return job
  }

  getJob(id: string): IngestJob | undefined {
    return this.jobs.get(id)
  }

  private async runIngest(job: IngestJob, destBase: string) {
    try {
      const subDirs = ['footage', 'audio', 'graphics', 'exports', 'project']
      for (const dir of subDirs) {
        await fs.mkdir(path.join(destBase, dir), { recursive: true })
      }

      job.status = 'copying'

      const allFiles = await this.walkDir(job.sourcePath)
      const mediaFiles = allFiles.filter(f => MEDIA_EXTENSIONS.has(path.extname(f).toLowerCase()))
      job.totalFiles = mediaFiles.length

      if (mediaFiles.length === 0) {
        job.status = 'error'
        job.errors.push('No media files found in the selected folder.')
        return
      }

      for (let i = 0; i < mediaFiles.length; i++) {
        const filePath = mediaFiles[i]
        const ext = path.extname(filePath).toLowerCase()
        let destDir = 'footage'

        if (AUDIO_EXTENSIONS.has(ext)) destDir = 'audio'
        else if (IMAGE_EXTENSIONS.has(ext)) destDir = 'graphics'

        const fileName = path.basename(filePath)
        const destPath = path.join(destBase, destDir, fileName)

        try {
          if (job.sourceType === 'card') {
            await fs.copyFile(filePath, destPath)
          } else {
            try {
              await fs.access(destPath)
            } catch {
              await fs.symlink(filePath, destPath)
            }
          }
        } catch (err: any) {
          job.errors.push(`Failed to process ${fileName}: ${err.message}`)
        }

        job.processedFiles = i + 1
        job.progress = Math.round((job.processedFiles / job.totalFiles) * 80)

        // Yield event loop every 10 files so polls can respond
        if (i % 10 === 0) {
          await new Promise(r => setImmediate(r))
        }
      }

      job.status = 'analyzing'
      job.progress = 80
      job.clips = []
      job.processedFiles = 0

      const clipAnalysis = getClipAnalysisService()
      await clipAnalysis.analyzeDirectory(
        path.join(destBase, 'footage'),
        job.projectId,
        (clip, done, total) => {
          job.clips!.push(clip)
          job.processedFiles = done
          job.totalFiles = total
          job.progress = 80 + Math.round((done / total) * 18)
        },
      )
      job.progress = 98

      job.status = 'creating-project'
      await new Promise(r => setTimeout(r, 500))

      job.status = 'complete'
      job.progress = 100
    } catch (err: any) {
      job.status = 'error'
      job.errors.push(err.message)
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
    } catch {
      // Skip unreadable directories
    }
    return files
  }
}
