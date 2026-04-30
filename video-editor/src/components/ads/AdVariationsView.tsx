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
} from 'lucide-react'
import type { AdVariation, AdVariationConfig } from '../../types'

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
        className={`rounded-sm border-2 transition-colors ${
          selected ? 'border-accent bg-accent/10' : 'border-border bg-surface-active'
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
      className={`relative w-10 h-5 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-surface-active'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
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

export default function AdVariationsView() {
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
      <div className="flex-1 overflow-y-auto p-10 space-y-12 scrollbar-none">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-text">Ad Variations</h2>
          <p className="text-text-muted text-base">Generate video and static ad variations from your edit</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-mono text-text-dim uppercase tracking-widest">Formats</h3>
          <div className="grid grid-cols-4 gap-3">
            {FORMAT_OPTIONS.map((format) => {
              const selected = selectedFormats.has(format.id)
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => toggleFormat(format.id)}
                  className={`relative bg-surface border rounded-xl p-3 text-center transition-all duration-150 ${
                    selected
                      ? 'border-accent bg-accent-dim'
                      : 'border-border hover:border-border-active'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <AspectPreview formatId={format.id} selected={selected} />
                    <div className="flex items-center gap-1.5">
                      <Icon size={12} className={selected ? 'text-accent' : 'text-text-dim'} />
                      <span className="text-xs font-medium text-text">{format.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-8">
          <h3 className="text-[10px] font-mono text-text-dim uppercase tracking-widest">Video Cuts</h3>

          <div className="space-y-2">
            <span className="text-sm text-text-muted">Lengths</span>
            <div className="flex gap-2">
              {LENGTH_OPTIONS.map((len) => {
                const selected = selectedLengths.has(len)
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => toggleLength(len)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      selected
                        ? 'bg-accent text-white'
                        : 'bg-surface border border-border text-text-muted hover:border-border-active hover:text-text'
                    }`}
                  >
                    {len}s
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-muted">Hook variants</span>
                <p className="text-xs text-text-dim mt-0.5">Different opening 3 seconds</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHookCount(Math.max(1, hookCount - 1))}
                  className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:border-border-active hover:text-text transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-mono font-medium text-text w-4 text-center">{hookCount}</span>
                <button
                  type="button"
                  onClick={() => setHookCount(Math.min(5, hookCount + 1))}
                  className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:border-border-active hover:text-text transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-text-muted">CTAs</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={ctaInput}
                onChange={(e) => setCtaInput(e.target.value)}
                onKeyDown={handleCtaKeyDown}
                placeholder="e.g. Book now, Learn more"
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
              />
              <button
                type="button"
                onClick={addCta}
                disabled={!ctaInput.trim()}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-text-muted hover:border-border-active hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            </div>
            {ctas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {ctas.map((cta) => (
                  <span
                    key={cta}
                    className="inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1 text-xs font-medium text-text"
                  >
                    {cta}
                    <button
                      type="button"
                      onClick={() => removeCta(cta)}
                      className="text-text-dim hover:text-accent transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Include faster cut</span>
              <Toggle enabled={includeFasterPacing} onChange={setIncludeFasterPacing} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Include slower cut</span>
              <Toggle enabled={includeSlowerPacing} onChange={setIncludeSlowerPacing} />
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-mono text-text-dim uppercase tracking-widest">Static Ads</h3>
            <Toggle enabled={includeStatics} onChange={setIncludeStatics} />
          </div>

          {includeStatics && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STATIC_TYPE_OPTIONS.map((opt) => {
                  const selected = selectedStaticTypes.has(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleStaticType(opt.id)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        selected
                          ? 'bg-accent text-white'
                          : 'bg-surface border border-border text-text-muted hover:border-border-active hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Headline text (optional — Claude will generate)"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
                />
                <input
                  type="text"
                  value={subheadline}
                  onChange={(e) => setSubheadline(e.target.value)}
                  placeholder="Subheadline text (optional)"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {variations.length > 0 && (
          <div className="space-y-4 border-t border-border pt-8">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                {videoCount} video variation{videoCount !== 1 ? 's' : ''}, {staticCount} static variation{staticCount !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex gap-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-surface-active text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1.5 text-text-dim">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {filteredVariations.map((variation) => {
                const isApproved = variation.status === 'approved'
                const isRejected = variation.status === 'rejected'

                return (
                  <div
                    key={variation.id}
                    className={`bg-surface border rounded-lg overflow-hidden transition-all duration-150 ${
                      isApproved
                        ? 'border-green bg-green-dim'
                        : isRejected
                          ? 'border-border opacity-40'
                          : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-center bg-bg p-4">
                      {variation.type === 'video' ? (
                        <Film size={24} className="text-text-dim" />
                      ) : (
                        <Image size={24} className="text-text-dim" />
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-active text-[10px] font-mono font-medium text-text-muted">
                          {variation.format}
                        </span>
                        {variation.type === 'video' && variation.length && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-active text-[10px] font-mono font-medium text-text-muted">
                            {variation.length}s
                          </span>
                        )}
                        {variation.type === 'static' && variation.staticType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-active text-[10px] font-medium text-text-muted">
                            {STATIC_TYPE_LABELS[variation.staticType]}
                          </span>
                        )}
                        {variation.hookVariant && variation.hookVariant > 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-dim text-[10px] font-medium text-accent">
                            Hook {variation.hookVariant}
                          </span>
                        )}
                        {variation.pacing && variation.pacing !== 'normal' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-dim text-[10px] font-medium text-amber">
                            {PACING_LABELS[variation.pacing]}
                          </span>
                        )}
                      </div>

                      {variation.cta && (
                        <p className="text-xs text-text-muted truncate">{variation.cta}</p>
                      )}

                      <div className="flex items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setVariationStatus(variation.id, 'approved')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isApproved
                              ? 'text-green'
                              : 'text-text-dim hover:text-green'
                          }`}
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setVariationStatus(variation.id, 'rejected')}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isRejected
                              ? 'text-accent'
                              : 'text-text-dim hover:text-accent'
                          }`}
                        >
                          <XCircle size={14} />
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

      {variations.length > 0 ? (
        <div className="shrink-0 px-10 py-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {approvedCount} approved, {rejectedCount} rejected, {pendingCount} pending
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={approveAll}
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Approve All
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              type="button"
              disabled={approvedCount === 0}
              className="bg-accent rounded-lg px-6 py-2 font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export Approved
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-10 py-6 border-t border-border">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedFormats.size === 0}
            className="w-full bg-accent rounded-xl py-3 px-8 text-lg font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Generate {totalVariationCount} variation{totalVariationCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )
}
