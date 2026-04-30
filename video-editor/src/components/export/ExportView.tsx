import { useState } from 'react'
import {
  Monitor,
  Smartphone,
  Square,
  RectangleVertical,
  Check,
  ChevronDown,
  FolderOpen,
  Cloud,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve, startExport, getExportStatus } from '../../lib/api'
import ProgressRing from '../shared/ProgressRing'

interface FormatOption {
  id: string
  label: string
  subtitle: string
  resolution: string
  width: number
  height: number
  icon: typeof Monitor
}

type Quality = 'h265' | 'h264' | 'prores'
type ExportStatus = 'waiting' | 'rendering' | 'uploading' | 'complete' | 'error'

interface ExportJob {
  formatId: string
  label: string
  resolution: string
  status: ExportStatus
  progress: number
  errorMessage?: string
}

const FORMATS: FormatOption[] = [
  {
    id: '16:9',
    label: '16:9 Landscape',
    subtitle: 'YouTube, Standard',
    resolution: '1920 x 1080',
    width: 1920,
    height: 1080,
    icon: Monitor,
  },
  {
    id: '9:16',
    label: '9:16 Vertical',
    subtitle: 'Reels, TikTok, Stories',
    resolution: '1080 x 1920',
    width: 1080,
    height: 1920,
    icon: Smartphone,
  },
  {
    id: '1:1',
    label: '1:1 Square',
    subtitle: 'Instagram Feed',
    resolution: '1080 x 1080',
    width: 1080,
    height: 1080,
    icon: Square,
  },
  {
    id: '4:5',
    label: '4:5 Portrait',
    subtitle: 'Instagram, Facebook',
    resolution: '1080 x 1350',
    width: 1080,
    height: 1350,
    icon: RectangleVertical,
  },
]

const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'h265', label: 'High (H.265)' },
  { value: 'h264', label: 'Standard (H.264)' },
  { value: 'prores', label: 'ProRes (Master)' },
]

const ASPECT_RATIOS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1:1': { w: 1, h: 1 },
  '4:5': { w: 4, h: 5 },
}

function AspectPreview({ formatId, selected }: { formatId: string; selected: boolean }) {
  const ratio = ASPECT_RATIOS[formatId]
  const maxSize = 48
  const scale = maxSize / Math.max(ratio.w, ratio.h)
  const w = Math.round(ratio.w * scale)
  const h = Math.round(ratio.h * scale)

  return (
    <div className="flex items-center justify-center" style={{ width: maxSize, height: maxSize }}>
      <div
        className={`rounded-sm transition-colors duration-150 ${
          selected ? 'bg-accent/20' : 'bg-surface-active'
        }`}
        style={{ width: w, height: h }}
      />
    </div>
  )
}

function StatusIcon({ status, progress }: { status: ExportStatus; progress: number }) {
  switch (status) {
    case 'waiting':
      return <Clock size={13} className="text-text-dim" />
    case 'rendering':
      return <ProgressRing progress={progress} size={20} strokeWidth={2} showPercent={false} />
    case 'uploading':
      return <ProgressRing progress={progress} size={20} strokeWidth={2} showPercent={false} color="var(--color-amber)" />
    case 'complete':
      return <CheckCircle2 size={13} className="text-green" />
    case 'error':
      return <AlertCircle size={13} className="text-accent" />
  }
}

function statusLabel(status: ExportStatus): string {
  switch (status) {
    case 'waiting':
      return 'Waiting'
    case 'rendering':
      return 'Rendering'
    case 'uploading':
      return 'Uploading'
    case 'complete':
      return 'Complete'
    case 'error':
      return 'Failed'
  }
}

export default function ExportView() {
  const currentProject = useAppStore((s) => s.currentProject)
  const storyboardClips = useAppStore((s) => s.storyboardClips)

  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set(['16:9']))
  const [quality, setQuality] = useState<Quality>('h265')
  const [qualityOpen, setQualityOpen] = useState(false)
  const [destination, setDestination] = useState('~/Desktop/Exports')
  const [uploadToCloud, setUploadToCloud] = useState(false)
  const [notifyClient, setNotifyClient] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])

  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const hasTimeline = currentProject && storyboardClips.length > 0
  const selectedCount = selectedFormats.size

  function toggleFormat(id: string) {
    setSelectedFormats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleExport() {
    if (selectedCount === 0) return

    const selectedFormatList = FORMATS.filter((f) => selectedFormats.has(f.id))
    const clipPaths = storyboardClips.map((sc) => sc.clip.filePath)

    if (clipPaths.length === 0) return

    if (resolveConnected) {
      for (const format of selectedFormatList) {
        sendToResolve('render', {
          output_path: destination.replace('~', '/Users'),
          width: format.width,
          height: format.height,
        })
      }
    }

    const jobs: ExportJob[] = selectedFormatList.map((f) => ({
      formatId: f.id,
      label: f.label,
      resolution: f.resolution,
      status: 'waiting' as ExportStatus,
      progress: 0,
    }))

    setExportJobs(jobs)
    setIsExporting(true)

    const destPath = destination.replace('~', '/Users')
    const selectedTrack = useAppStore.getState().selectedTrack

    for (let i = 0; i < selectedFormatList.length; i++) {
      const format = selectedFormatList[i]
      const outputPath = `${destPath}/${currentProject?.name || 'export'}_${format.id.replace(':', 'x')}.mp4`

      setExportJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, status: 'rendering' as ExportStatus } : j))

      try {
        const job = await startExport({
          clipPaths,
          outputPath,
          format: format.id,
          codec: quality,
          resolution: '1080p',
          musicTrack: selectedTrack?.filePath ? { path: selectedTrack.filePath, volume: 0.3 } : undefined,
        })

        const pollProgress = async (jobId: string) => {
          let done = false
          let iterations = 0
          const maxIterations = 300
          while (!done) {
            await new Promise((r) => setTimeout(r, 1000))
            iterations++
            if (iterations > maxIterations) {
              setExportJobs((prev) => prev.map((j, idx) => idx === i ? {
                ...j,
                status: 'error' as ExportStatus,
                errorMessage: 'Export timed out after 5 minutes',
              } : j))
              break
            }
            try {
              const status = await getExportStatus(jobId)
              if (status.status === 'error') {
                setExportJobs((prev) => prev.map((j, idx) => idx === i ? {
                  ...j,
                  status: 'error' as ExportStatus,
                  errorMessage: status.error || 'Export failed',
                } : j))
                done = true
              } else {
                setExportJobs((prev) => prev.map((j, idx) => idx === i ? {
                  ...j,
                  progress: status.progress || 0,
                  status: status.status === 'complete' ? 'complete' as ExportStatus
                    : 'rendering' as ExportStatus,
                } : j))
                if (status.status === 'complete') {
                  done = true
                }
              }
            } catch {
              setExportJobs((prev) => prev.map((j, idx) => idx === i ? {
                ...j,
                status: 'error' as ExportStatus,
                errorMessage: 'Lost connection to export process',
              } : j))
              done = true
            }
          }
        }

        await pollProgress(job.id)
      } catch {
        setExportJobs((prev) => prev.map((j, idx) => idx === i ? { ...j, status: 'error' as ExportStatus, errorMessage: 'Failed to start export' } : j))
      }
    }

    setIsExporting(false)
  }

  if (!hasTimeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <Monitor size={28} className="text-text-dim" />
        <p className="text-[11px] text-text-dim">Build your timeline first, then export</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-none">
        {/* Format selection */}
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-sm text-text">Export</h2>

          <div className="grid grid-cols-2 gap-2.5">
            {FORMATS.map((format) => {
              const selected = selectedFormats.has(format.id)
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => toggleFormat(format.id)}
                  className={`relative rounded-xl p-5 text-left transition-all duration-150 ${
                    selected
                      ? 'bg-accent-dim'
                      : 'bg-surface hover:bg-surface-hover'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={11} className="text-white" />
                    </div>
                  )}

                  <div className="flex items-start gap-3.5">
                    <AspectPreview formatId={format.id} selected={selected} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon size={13} className={selected ? 'text-accent' : 'text-text-dim'} />
                        <span className="text-sm font-medium text-text">{format.label}</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-0.5">{format.subtitle}</p>
                      <p className="font-mono text-[10px] text-text-dim tabular-nums mt-1.5">{format.resolution}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 pt-2">
          <h3 className="text-[11px] text-text-dim">Settings</h3>

          {/* Quality */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-text-dim">Quality</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setQualityOpen(!qualityOpen)}
                className="flex items-center gap-2 bg-surface-active/50 rounded-lg px-3 py-1.5 text-sm text-text hover:bg-surface-hover transition-colors duration-150"
              >
                {QUALITY_OPTIONS.find((q) => q.value === quality)?.label}
                <ChevronDown size={13} className="text-text-dim" />
              </button>
              {qualityOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-surface-raised rounded-xl shadow-xl shadow-black/30 z-10 min-w-[180px] py-1">
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setQuality(opt.value)
                        setQualityOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
                        quality === opt.value
                          ? 'text-accent bg-accent-dim'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-text-dim">Destination</span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] text-text-dim tabular-nums max-w-[200px] truncate">
                {destination}
              </span>
              <button
                type="button"
                onClick={() => {
                  /* file picker would go here */
                }}
                className="flex items-center gap-1.5 text-[11px] text-text-dim hover:text-text-muted rounded-lg hover:bg-surface-hover px-2 py-1 transition-colors duration-150"
              >
                <FolderOpen size={11} />
                Change
              </button>
            </div>
          </div>

          {/* Upload to Cloudinary */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Cloud size={13} className="text-text-dim" />
              <span className="text-[11px] text-text-dim">Upload to Cloudinary</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadToCloud(!uploadToCloud)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-150 ${
                uploadToCloud ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  uploadToCloud ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Notify client */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-text-dim" />
              <span className="text-[11px] text-text-dim">Notify client</span>
            </div>
            <button
              type="button"
              onClick={() => setNotifyClient(!notifyClient)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-150 ${
                notifyClient ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  notifyClient ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Export queue */}
        {exportJobs.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-[11px] text-text-dim">Export Queue</h3>

            <div className="space-y-1.5">
              {exportJobs.map((job) => (
                <div
                  key={job.formatId}
                  className="bg-surface rounded-lg p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-text">{job.label}</span>
                      <span className="font-mono text-[10px] text-text-dim tabular-nums">{job.resolution}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={job.status} progress={job.progress} />
                      <span
                        className={`text-[11px] font-medium ${
                          job.status === 'complete'
                            ? 'text-green'
                            : job.status === 'error'
                              ? 'text-accent'
                              : job.status === 'rendering'
                                ? 'text-accent'
                                : job.status === 'uploading'
                                  ? 'text-amber'
                                  : 'text-text-dim'
                        }`}
                      >
                        {statusLabel(job.status)}
                      </span>
                    </div>
                  </div>

                  {(job.status === 'rendering' || job.status === 'uploading') && (
                    <div className="w-full h-0.5 bg-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          job.status === 'uploading' ? 'bg-amber' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.round(job.progress)}%` }}
                      />
                    </div>
                  )}

                  {job.status === 'complete' && (
                    <div className="w-full h-0.5 bg-green-dim rounded-full overflow-hidden">
                      <div className="h-full bg-green rounded-full w-full" />
                    </div>
                  )}

                  {job.status === 'error' && job.errorMessage && (
                    <p className="text-[10px] text-accent">{job.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky export button */}
      <div className="shrink-0 px-8 py-5 flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={selectedCount === 0 || isExporting}
          className="bg-accent rounded-lg py-3 px-6 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting
            ? 'Exporting...'
            : selectedCount === 0
              ? 'Select a format'
              : `Export ${selectedCount === 1 ? '1 Format' : `All ${selectedCount} Formats`}`}
        </button>
      </div>
    </div>
  )
}
