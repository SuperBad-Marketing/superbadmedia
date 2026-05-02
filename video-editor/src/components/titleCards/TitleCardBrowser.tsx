import { useState, useEffect } from 'react'
import { Search, Type, Check, Plus } from 'lucide-react'
import { PanelLoader } from '../shared/LoadingPulse'
import type { TitleCardPreset } from '../../types'
import { getTitleCardPresets } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

const TYPE_FILTERS = ['Title', 'Lower-Third', 'End-Card', 'Chapter', 'Quote', 'Location', 'Stat'] as const

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    'lower-third': 'L3',
    'end-card': 'End',
    chapter: 'Ch.',
    quote: 'Quote',
    location: 'Loc.',
    stat: 'Stat',
    reveal: 'Reveal',
  }
  return labels[type] || type
}

export default function TitleCardBrowser() {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [presets, setPresets] = useState<TitleCardPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [titleText, setTitleText] = useState('')
  const [subtitleText, setSubtitleText] = useState('')
  const [insertedId, setInsertedId] = useState<string | null>(null)
  const addChatMessage = useAppStore((s) => s.addChatMessage)

  useEffect(() => {
    getTitleCardPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = presets.filter((p) => {
    if (activeType && p.type !== activeType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.type.includes(q)
      )
    }
    return true
  })

  function toggleType(type: string) {
    const lower = type.toLowerCase()
    setActiveType((prev) => (prev === lower ? null : lower))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title cards..."
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
        </div>

        <div className="segmented-control">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              data-active={activeType === type.toLowerCase()}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <PanelLoader message="Loading title cards." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Type size={18} className="text-text-dim opacity-40" />
            <span className="text-[11px] text-text-dim">No title cards match your search</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-3">
            {filtered.map((preset) => {
              const isSelected = selectedPreset === preset.id
              const justInserted = insertedId === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(isSelected ? null : preset.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-left transition-colors duration-150 ${
                    isSelected
                      ? 'bg-accent-dim'
                      : justInserted
                        ? 'bg-green-dim'
                        : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    isSelected ? 'bg-accent/20' : 'bg-surface-active/80'
                  }`}>
                    {justInserted ? <Check size={13} className="text-green" /> : <Type size={13} className="text-text-muted" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-text truncate">{preset.name}</div>
                    <div className="text-[10px] text-text-dim truncate mt-0.5">{preset.description}</div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="font-mono text-[10px] text-text-dim uppercase">{typeLabel(preset.type)}</span>
                    {preset.hasAnimation && (
                      <span className="text-[10px] text-pink font-mono">animated</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedPreset ? (
        <div className="bg-surface-active/40 px-5 py-4 space-y-3">
          <input
            type="text"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="Title text..."
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
          <input
            type="text"
            value={subtitleText}
            onChange={(e) => setSubtitleText(e.target.value)}
            placeholder="Subtitle (optional)"
            className="w-full bg-surface-active/50 rounded-lg text-xs text-text placeholder:text-text-dim px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
          />
          <button
            onClick={() => {
              if (!titleText.trim()) return
              const preset = presets.find((p) => p.id === selectedPreset)
              addChatMessage({
                id: crypto.randomUUID(),
                role: 'user',
                content: `Add a ${preset?.name || 'title card'} saying "${titleText}"${subtitleText ? ` with subtitle "${subtitleText}"` : ''}`,
                timestamp: new Date().toISOString(),
              })
              setInsertedId(selectedPreset)
              setTimeout(() => setInsertedId(null), 2000)
              setTitleText('')
              setSubtitleText('')
              setSelectedPreset(null)
            }}
            disabled={!titleText.trim()}
            className="w-full flex items-center justify-center gap-1.5 bg-accent rounded-lg px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40"
          >
            <Plus size={12} />
            Insert Title Card
          </button>
        </div>
      ) : (
        <div className="bg-surface-active/30 px-5 py-3">
          <p className="text-[10px] text-text-dim leading-relaxed">
            Select a preset above, then enter your text to insert
          </p>
        </div>
      )}
    </div>
  )
}
