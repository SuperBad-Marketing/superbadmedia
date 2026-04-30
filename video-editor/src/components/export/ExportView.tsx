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
  Loader2,
  CheckCircle2,
  Clock,
  Upload,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve } from '../../lib/api'

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
type ExportStatus = 'waiting' | 'rendering' | 'uploading' | 'complete'

interface ExportJob {
  formatId: string
  label: string
  resolution: string
  status: ExportStatus
  progress: number
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
        className={`rounded-sm border-2 transition-colors ${
          selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-active'
        }`}
        style={{ width: w, height: h }}
      />
    </div>
  )
}

function StatusIcon({ status }: { status: ExportStatus }) {
  switch (status) {
    case 'waiting':
      return <Clock size={14} className="text-text-dim" />
    case 'rendering':
      return <Loader2 size={14} className="text-accent animate-spin" />
    case 'uploading':
      return <Upload size={14} className="text-amber animate-pulse" />
    case 'complete':
      return <CheckCircle2 size={14} className="text-green" />
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

    if (resolveConnected) {
      for (const format of selectedFormatList) {
        sendToResolve('render', {
          output_path: destination.replace('~', '/Users'),
          width: format.width,
          height: format.height,
        })
      }
    }

    const jobs: ExportJob[] = selectedFormatList.map((f, i) => ({
      formatId: f.id,
      label: f.label,
      resolution: f.resolution,
      status: i === 0 ? 'rendering' : 'waiting',
      progress: 0,
    }))

    setExportJobs(jobs)
    setIsExporting(true)

    let currentJobIndex = 0
    const interval = setInterval(() => {
      setExportJobs((prev) => {
        const next = [...prev]
        const current = next[currentJobIndex]
        if (!current) {
          clearInterval(interval)
          setIsExporting(false)
          return prev
        }

        if (current.status === 'waiting') {
          current.status = 'rendering'
          current.progress = 0
        } else if (current.status === 'rendering') {
          current.progress = Math.min(current.progress + Math.random() * 15 + 5, 100)
          if (current.progress >= 100) {
            current.progress = 100
            if (uploadToCloud) {
              current.status = 'uploading'
              current.progress = 0
            } else {
              current.status = 'complete'
              currentJobIndex++
            }
          }
        } else if (current.status === 'uploading') {
          current.progress = Math.min(current.progress + Math.random() * 25 + 10, 100)
          if (current.progress >= 100) {
            current.progress = 100
            current.status = 'complete'
            currentJobIndex++
          }
        }

        if (currentJobIndex >= next.length) {
          clearInterval(interval)
          setIsExporting(false)
        }

        return next
      })
    }, 400)
  }

  if (!hasTimeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="size-20 rounded-2xl bg-surface-active flex items-center justify-center">
          <Monitor size={32} className="text-text-dim" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text">Export</h2>
        <p className="text-text-muted text-base text-center text-pretty max-w-sm">
          Build your timeline first, then come back here to export
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-10 space-y-12 scrollbar-none">
        {/* Format selection */}
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-text">Export</h2>

          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map((format) => {
              const selected = selectedFormats.has(format.id)
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => toggleFormat(format.id)}
                  className={`relative bg-surface border rounded-xl p-5 text-left transition-all duration-150 ${
                    selected
                      ? 'border-accent bg-accent-dim'
                      : 'border-border hover:border-border-active'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <AspectPreview formatId={format.id} selected={selected} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={selected ? 'text-accent' : 'text-text-dim'} />
                        <span className="text-sm font-medium text-text">{format.label}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">{format.subtitle}</p>
                      <p className="font-mono text-xs text-text-dim mt-1.5">{format.resolution}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-5 border-t border-border pt-8">
          <h3 className="text-[10px] font-mono text-text-dim uppercase tracking-widest">Settings</h3>

          {/* Quality */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Quality</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setQualityOpen(!qualityOpen)}
                className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text hover:border-border-active transition-colors"
              >
                {QUALITY_OPTIONS.find((q) => q.value === quality)?.label}
                <ChevronDown size={14} className="text-text-dim" />
              </button>
              {qualityOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 min-w-[180px]">
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setQuality(opt.value)
                        setQualityOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Destination</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-text-dim max-w-[200px] truncate">
                {destination}
              </span>
              <button
                type="button"
                onClick={() => {
                  /* file picker would go here */
                }}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <FolderOpen size={12} />
                Change
              </button>
            </div>
          </div>

          {/* Upload to Cloudinary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud size={14} className="text-text-dim" />
              <span className="text-sm text-text-muted">Upload to Cloudinary</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadToCloud(!uploadToCloud)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                uploadToCloud ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  uploadToCloud ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Notify client */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-text-dim" />
              <span className="text-sm text-text-muted">Notify client</span>
            </div>
            <button
              type="button"
              onClick={() => setNotifyClient(!notifyClient)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                notifyClient ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  notifyClient ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Export queue (visible when exporting) */}
        {exportJobs.length > 0 && (
          <div className="space-y-3 border-t border-border pt-6">
            <h3 className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
              Export Queue
            </h3>

            <div className="space-y-2">
              {exportJobs.map((job) => (
                <div
                  key={job.formatId}
                  className="bg-surface border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-text">{job.label}</span>
                      <span className="font-mono text-xs text-text-dim ml-2">{job.resolution}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={job.status} />
                      <span
                        className={`text-xs font-medium ${
                          job.status === 'complete'
                            ? 'text-green'
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
                    <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          job.status === 'uploading' ? 'bg-amber' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.round(job.progress)}%` }}
                      />
                    </div>
                  )}

                  {job.status === 'complete' && (
                    <div className="w-full h-1.5 bg-green-dim rounded-full overflow-hidden">
                      <div className="h-full bg-green rounded-full w-full" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky export button */}
      <div className="shrink-0 p-6 border-t border-border">
        <button
          type="button"
          onClick={handleExport}
          disabled={selectedCount === 0 || isExporting}
          className="w-full bg-accent rounded-xl py-3 px-8 font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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
