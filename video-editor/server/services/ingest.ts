import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ClipAnalysisService } from './clipAnalysis.js'

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

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mxf', '.avi', '.mkv', '.m4v', '.mpg', '.mts', '.r3d', '.braw', '.ari']
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.aac', '.flac', '.aif', '.aiff']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.cr2', '.cr3', '.arw', '.nef', '.dng']

export class IngestService {
  private jobs: Map<string, IngestJob> = new Map()

  async startIngest(sourcePath: string, clientName: string, sourceType: 'card' | 'folder'): Promise<IngestJob> {
    const id = crypto.randomUUID()
    const projectId = crypto.randomUUID()
    const date = new Date().toISOString().split('T')[0]
    const safeName = clientName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')
    const destBase = path.join(path.dirname(sourcePath), `${safeName}_${date}`)

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
        fs.mkdirSync(path.join(destBase, dir), { recursive: true })
      }

      job.status = 'copying'
      const allFiles = this.walkDir(job.sourcePath)
      job.totalFiles = allFiles.length

      for (const filePath of allFiles) {
        const ext = path.extname(filePath).toLowerCase()
        let destDir = 'footage'

        if (AUDIO_EXTENSIONS.includes(ext)) destDir = 'audio'
        else if (IMAGE_EXTENSIONS.includes(ext)) destDir = 'graphics'
        else if (!VIDEO_EXTENSIONS.includes(ext)) continue

        const fileName = path.basename(filePath)
        const destPath = path.join(destBase, destDir, fileName)

        try {
          if (job.sourceType === 'card') {
            fs.copyFileSync(filePath, destPath)
          } else {
            if (!fs.existsSync(destPath)) {
              fs.symlinkSync(filePath, destPath)
            }
          }
        } catch (err: any) {
          job.errors.push(`Failed to process ${fileName}: ${err.message}`)
        }

        job.processedFiles++
        job.progress = Math.round((job.processedFiles / job.totalFiles) * 80)
      }

      job.status = 'analyzing'
      job.progress = 80
      job.clips = []

      const clipAnalysis = new ClipAnalysisService()
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
      await new Promise(r => setTimeout(r, 1000))

      job.status = 'complete'
      job.progress = 100
    } catch (err: any) {
      job.status = 'error'
      job.errors.push(err.message)
    }
  }

  private walkDir(dir: string): string[] {
    const files: string[] = []
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...this.walkDir(fullPath))
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
