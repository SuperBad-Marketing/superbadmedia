import { useState, useMemo } from 'react'
import {
  Monitor,
  Smartphone,
  Square,
  RectangleVertical,
  Check,
  Plus,
  X,
  Minus,
  Film,
  Image,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import type { AdVariation, AdVariationConfig } from '../../types'
import { useAppStore } from '../../stores/appStore'
import { startExport, getExportStatus } from '../../lib/api'

type AspectFormat = '16:9' | '9:16' | '1:1' | '4:5'
type StaticType = 'single' | 'carousel' | 'before-after' | 'quote-card'
type FilterTab = 'all' | 'video' | 'static' | 'approved' | 'rejected'

const FORMAT_OPTIONS: { id: AspectFormat; label: string; icon: typeof Monitor }[] = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
  { id: '4:5', label: '4:5', icon: RectangleVertical },
]

const LENGTH_OPTIONS = [6, 15, 30, 60]

const STATIC_TYPE_OPTIONS: { id: StaticType; label: string }[] = [
  { id: 'single', label: 'Single Image' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'before-after', label: 'Before/After' },
  { id: 'quote-card', label: 'Quote Card' },
]

const ASPECT_RATIOS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1:1': { w: 1, h: 1 },
  '4:5': { w: 4, h: 5 },
}

function AspectPreview({ formatId, selected }: { formatId: string; selected: boolean }) {
  const ratio = ASPECT_RATIOS[formatId]
  const maxSize = 36
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

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-150 ${
        enabled ? 'bg-accent' : 'bg-surface-active'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function generateVariations(config: AdVariationConfig): AdVariation[] {
  const variations: AdVariation[] = []
  let id = 0

  const formats = config.formats.length ? config.formats : (['16:9'] as AspectFormat[])
  const lengths = config.lengths.length ? config.lengths : [30]
  const hookCount = config.hookCount || 1
  const ctas = config.ctas.length ? config.ctas : ['']
  const pacings: ('normal' | 'fast' | 'slow')[] = ['normal']
  if (config.includeFasterPacing) pacings.push('fast')
  if (config.includeSlowerPacing) pacings.push('slow')

  for (const format of formats) {
    for (const length of lengths) {
      for (let hook = 1; hook <= hookCount; hook++) {
        for (const cta of ctas) {
          for (const pacing of pacings) {
            variations.push({
              id: String(++id),
              type: 'video',
              format,
              length,
              hookVariant: hook,
              cta: cta || undefined,
              pacing,
              status: 'ready',
            })
          }
        }
      }
    }
  }

  if (config.includeStatics) {
    const staticTypes = config.staticTypes.length ? config.staticTypes : (['single'] as StaticType[])
    for (const format of formats) {
      for (const staticType of staticTypes) {
        variations.push({
          id: String(++id),
          type: 'static',
          format,
          staticType,
          headline: config.headline,
          subheadline: config.subheadline,
          status: 'ready',
        })
      }
    }
  }

  return variations
}

const FORMAT_RESOLUTIONS: Record<AspectFormat, string> = {
  '16:9': '1920x1080',
  '9:16': '1080x1920',
  '1:1': '1080x1080',
  '4:5': '1080x1350',
}

export default function AdVariationsView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const [selectedFormats, setSelectedFormats] = useState<Set<AspectFormat>>(new Set(['16:9']))
  const [selectedLengths, setSelectedLengths] = useState<Set<number>>(new Set([30]))
  const [hookCount, setHookCount] = useState(1)
  const [ctas, setCtas] = useState<string[]>([])
  const [ctaInput, setCtaInput] = useState('')
  const [includeFasterPacing, setIncludeFasterPacing] = useState(false)
  const [includeSlowerPacing, setIncludeSlowerPacing] = useState(false)
  const [includeStatics, setIncludeStatics] = useState(false)
  const [selectedStaticTypes, setSelectedStaticTypes] = useState<Set<StaticType>>(new Set(['single']))
  const [headline, setHeadline] = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [variations, setVariations] = useState<AdVariation[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)

  function toggleFormat(id: AspectFormat) {
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

  function toggleLength(len: number) {
    setSelectedLengths((prev) => {
      const next = new Set(prev)
      if (next.has(len)) {
        next.delete(len)
      } else {
        next.add(len)
      }
      return next
    })
  }

  function toggleStaticType(type: StaticType) {
    setSelectedStaticTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  function addCta() {
    const trimmed = ctaInput.trim()
    if (trimmed && !ctas.includes(trimmed)) {
      setCtas((prev) => [...prev, trimmed])
      setCtaInput('')
    }
  }

  function removeCta(cta: string) {
    setCtas((prev) => prev.filter((c) => c !== cta))
  }

  function handleCtaKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCta()
    }
  }

  const totalVariationCount = useMemo(() => {
    const formatCount = Math.max(selectedFormats.size, 1)
    const lengthCount = Math.max(selectedLengths.size, 1)
    const hooks = hookCount || 1
    const ctaCount = Math.max(ctas.length, 1)
    let pacingCount = 1
    if (includeFasterPacing) pacingCount++
    if (includeSlowerPacing) pacingCount++

    let videoCount = formatCount * lengthCount * hooks * ctaCount * pacingCount
    let staticCount = 0

    if (includeStatics) {
      const staticTypeCount = Math.max(selectedStaticTypes.size, 1)
      staticCount = formatCount * staticTypeCount
    }

    return videoCount + staticCount
  }, [selectedFormats.size, selectedLengths.size, hookCount, ctas.length, includeFasterPacing, includeSlowerPacing, includeStatics, selectedStaticTypes.size])

  function handleGenerate() {
    const config: AdVariationConfig = {
      formats: Array.from(selectedFormats) as AspectFormat[],
      lengths: Array.from(selectedLengths),
      hookCount,
      ctas,
      includeFasterPacing,
      includeSlowerPacing,
      includeStatics,
      staticTypes: Array.from(selectedStaticTypes) as StaticType[],
      headline: headline || undefined,
      subheadline: subheadline || undefined,
    }
    setVariations(generateVariations(config))
    setActiveFilter('all')
  }

  function setVariationStatus(id: string, status: 'approved' | 'rejected') {
    setVariations((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status } : v))
    )
  }

  function approveAll() {
    setVariations((prev) => prev.map((v) => ({ ...v, status: 'approved' as const })))
  }

  function resetAll() {
    setVariations((prev) => prev.map((v) => ({ ...v, status: 'ready' as const })))
  }

  async function handleExportApproved() {
    const approved = variations.filter((v) => v.status === 'approved' && v.type === 'video')
    if (approved.length === 0 || storyboardClips.length === 0) return

    setExporting(true)
    setExportProgress({ done: 0, total: approved.length })

    const clipPaths = storyboardClips.map((sc) => sc.clip.filePath)
    let done = 0

    for (const variation of approved) {
      try {
        const res = await startExport({
          clipPaths,
          outputPath: `~/Desktop/ad-${variation.format.replace(':', 'x')}-${variation.length || 30}s-${variation.id}.mp4`,
          format: 'mp4',
          codec: 'h264',
          resolution: FORMAT_RESOLUTIONS[variation.format] || '1920x1080',
        })

        if (res.jobId) {
          let status = await getExportStatus(res.jobId)
          while (status.status === 'running') {
            await new Promise((r) => setTimeout(r, 1000))
            status = await getExportStatus(res.jobId)
          }
        }
      } catch {
        // continue to next variation
      }

      done++
      setExportProgress({ done, total: approved.length })
    }

    setExporting(false)
    setExportProgress(null)
  }

  const filteredVariations = useMemo(() => {
    switch (activeFilter) {
      case 'video':
        return variations.filter((v) => v.type === 'video')
      case 'static':
        return variations.filter((v) => v.type === 'static')
      case 'approved':
        return variations.filter((v) => v.status === 'approved')
      case 'rejected':
        return variations.filter((v) => v.status === 'rejected')
      default:
        return variations
    }
  }, [variations, activeFilter])

  const videoCount = variations.filter((v) => v.type === 'video').length
  const staticCount = variations.filter((v) => v.type === 'static').length
  const approvedCount = variations.filter((v) => v.status === 'approved').length
  const rejectedCount = variations.filter((v) => v.status === 'rejected').length
  const pendingCount = variations.filter((v) => v.status === 'ready').length

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: variations.length },
    { id: 'video', label: 'Video', count: videoCount },
    { id: 'static', label: 'Static', count: staticCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'rejected', label: 'Rejected', count: rejectedCount },
  ]

  const STATIC_TYPE_LABELS: Record<StaticType, string> = {
    single: 'Single',
    carousel: 'Carousel',
    'before-after': 'Before/After',
    'quote-card': 'Quote Card',
  }

  const PACING_LABELS: Record<string, string> = {
    fast: 'Fast',
    slow: 'Slow',
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-none">
        {/* Header */}
        <div className="space-y-1.5">
          <h2 className="font-display font-semibold text-sm text-text">Ad Variations</h2>
          <p className="text-[11px] text-text-dim">Generate video and static ad variations from your edit</p>
        </div>

        {/* Formats */}
        <div className="space-y-3">
          <h3 className="text-[11px] text-text-dim">Formats</h3>
          <div className="grid grid-cols-4 gap-2">
            {FORMAT_OPTIONS.map((format) => {
              const selected = selectedFormats.has(format.id)
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => toggleFormat(format.id)}
                  className={`relative rounded-xl p-3.5 text-center transition-all duration-150 ${
                    selected
                      ? 'bg-accent-dim'
                      : 'bg-surface hover:bg-surface-hover'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check size={9} className="text-white" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <AspectPreview formatId={format.id} selected={selected} />
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} className={selected ? 'text-accent' : 'text-text-dim'} />
                      <span className="text-xs font-medium text-text">{format.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Video Cuts */}
        <div className="space-y-5 pt-2">
          <h3 className="text-[11px] text-text-dim">Video Cuts</h3>

          {/* Lengths */}
          <div className="space-y-2.5">
            <span className="text-[11px] text-text-dim">Lengths</span>
            <div className="segmented-control">
              {LENGTH_OPTIONS.map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => toggleLength(len)}
                  data-active={selectedLengths.has(len)}
                >
                  {len}s
                </button>
              ))}
            </div>
          </div>

          {/* Hook variants */}
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-[11px] text-text-dim">Hook variants</span>
              <p className="text-[10px] text-text-dim mt-0.5">Different opening 3 seconds</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHookCount(Math.max(1, hookCount - 1))}
                className="w-7 h-7 rounded-lg bg-surface-active/50 flex items-center justify-center text-text-dim hover:bg-surface-hover hover:text-text-muted transition-colors duration-150"
              >
                <Minus size={13} />
              </button>
              <span className="text-sm font-mono font-medium text-text w-4 text-center tabular-nums">{hookCount}</span>
              <button
                type="button"
                onClick={() => setHookCount(Math.min(5, hookCount + 1))}
                className="w-7 h-7 rounded-lg bg-surface-active/50 flex items-center justify-center text-text-dim hover:bg-surface-hover hover:text-text-muted transition-colors duration-150"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-2.5">
            <span className="text-[11px] text-text-dim">CTAs</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={ctaInput}
                onChange={(e) => setCtaInput(e.target.value)}
                onKeyDown={handleCtaKeyDown}
                placeholder="e.g. Book now, Learn more"
                className="flex-1 bg-surface-active/50 rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
              />
              <button
                type="button"
                onClick={addCta}
                disabled={!ctaInput.trim()}
                className="px-3 py-2 rounded-lg text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={15} />
              </button>
            </div>
            {ctas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ctas.map((cta) => (
                  <span
                    key={cta}
                    className="inline-flex items-center gap-1.5 bg-surface rounded-lg px-3 py-1.5 text-xs font-medium text-text"
                  >
                    {cta}
                    <button
                      type="button"
                      onClick={() => removeCta(cta)}
                      className="text-text-dim hover:text-accent transition-colors duration-150"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pacing toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-text-dim">Include faster cut</span>
              <Toggle enabled={includeFasterPacing} onChange={setIncludeFasterPacing} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-text-dim">Include slower cut</span>
              <Toggle enabled={includeSlowerPacing} onChange={setIncludeSlowerPacing} />
            </div>
          </div>
        </div>

        {/* Static Ads */}
        <div className="space-y-5 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] text-text-dim">Static Ads</h3>
            <Toggle enabled={includeStatics} onChange={setIncludeStatics} />
          </div>

          {includeStatics && (
            <div className="space-y-4">
              <div className="segmented-control">
                {STATIC_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleStaticType(opt.id)}
                    data-active={selectedStaticTypes.has(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Headline text (optional — Claude will generate)"
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
                />
                <input
                  type="text"
                  value={subheadline}
                  onChange={(e) => setSubheadline(e.target.value)}
                  placeholder="Subheadline text (optional)"
                  className="w-full bg-surface-active/50 rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
                />
              </div>
            </div>
          )}
        </div>

        {/* Variations grid */}
        {variations.length > 0 && (
          <div className="space-y-4 pt-2">
            <p className="text-[11px] text-text-dim">
              {videoCount} video variation{videoCount !== 1 ? 's' : ''}, {staticCount} static variation{staticCount !== 1 ? 's' : ''}
            </p>

            <div className="segmented-control">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  data-active={activeFilter === tab.id}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 opacity-50">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {filteredVariations.map((variation) => {
                const isApproved = variation.status === 'approved'
                const isRejected = variation.status === 'rejected'

                return (
                  <div
                    key={variation.id}
                    className={`rounded-lg overflow-hidden transition-all duration-150 ${
                      isApproved
                        ? 'bg-green-dim'
                        : isRejected
                          ? 'bg-surface opacity-40'
                          : 'bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-center bg-bg p-4">
                      {variation.type === 'video' ? (
                        <Film size={22} className="text-text-dim opacity-30" />
                      ) : (
                        <Image size={22} className="text-text-dim opacity-30" />
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-active text-[10px] font-mono font-medium text-text-dim tabular-nums">
                          {variation.format}
                        </span>
                        {variation.type === 'video' && variation.length && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-active text-[10px] font-mono font-medium text-text-dim tabular-nums">
                            {variation.length}s
                          </span>
                        )}
                        {variation.type === 'static' && variation.staticType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-active text-[10px] font-medium text-text-dim">
                            {STATIC_TYPE_LABELS[variation.staticType]}
                          </span>
                        )}
                        {variation.hookVariant && variation.hookVariant > 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-accent-dim text-[10px] font-medium text-accent">
                            Hook {variation.hookVariant}
                          </span>
                        )}
                        {variation.pacing && variation.pacing !== 'normal' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-dim text-[10px] font-medium text-amber">
                            {PACING_LABELS[variation.pacing]}
                          </span>
                        )}
                      </div>

                      {variation.cta && (
                        <p className="text-[11px] text-text-dim truncate">{variation.cta}</p>
                      )}

                      <div className="flex items-center gap-0.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setVariationStatus(variation.id, 'approved')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 ${
                            isApproved
                              ? 'text-green'
                              : 'text-text-dim hover:text-green hover:bg-surface-hover'
                          }`}
                        >
                          <CheckCircle2 size={13} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariationStatus(variation.id, 'rejected')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 ${
                            isRejected
                              ? 'text-accent'
                              : 'text-text-dim hover:text-accent hover:bg-surface-hover'
                          }`}
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {variations.length > 0 ? (
        <div className="shrink-0 px-8 py-4 flex items-center justify-between">
          <p className="text-[11px] text-text-dim">
            {approvedCount} approved, {rejectedCount} rejected, {pendingCount} pending
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={approveAll}
              className="text-[11px] text-text-dim hover:text-text-muted rounded-lg hover:bg-surface-hover px-2.5 py-1.5 transition-colors duration-150"
            >
              Approve All
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 text-[11px] text-text-dim hover:text-text-muted rounded-lg hover:bg-surface-hover px-2.5 py-1.5 transition-colors duration-150"
            >
              <RotateCcw size={11} />
              Reset
            </button>
            <button
              type="button"
              onClick={handleExportApproved}
              disabled={approvedCount === 0 || exporting || storyboardClips.length === 0}
              className="flex items-center gap-2 bg-accent rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting && <Loader2 size={13} className="animate-spin" />}
              {exporting && exportProgress
                ? `Exporting ${exportProgress.done}/${exportProgress.total}...`
                : 'Export Approved'}
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-8 py-5">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedFormats.size === 0}
            className="w-full bg-accent rounded-lg py-3 px-8 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            Generate {totalVariationCount} variation{totalVariationCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )
}
