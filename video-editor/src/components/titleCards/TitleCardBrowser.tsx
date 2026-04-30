import { useState, useEffect } from 'react'
import { Search, Loader2, Type } from 'lucide-react'
import type { TitleCardPreset } from '../../types'
import { getTitleCardPresets } from '../../lib/api'

const TYPE_FILTERS = ['Title', 'Lower-Third', 'End-Card', 'Chapter', 'Quote'] as const

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    'lower-third': 'L3',
    'end-card': 'End',
    chapter: 'Ch.',
    quote: 'Quote',
  }
  return labels[type] || type
}

export default function TitleCardBrowser() {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [presets, setPresets] = useState<TitleCardPreset[]>([])
  const [loading, setLoading] = useState(true)

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
      <div className="px-6 py-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title cards..."
            className="w-full bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim pl-9 pr-3 py-2.5 focus:outline-none focus:border-border-active transition-colors duration-150"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 ${
                activeType === type.toLowerCase()
                  ? 'bg-pink-dim border border-pink/30 text-pink font-medium'
                  : 'bg-surface border border-border text-text-dim hover:text-text-muted hover:border-border-active'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-text-dim animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Type size={24} className="text-text-dim opacity-40" />
            <span className="text-sm text-text-dim">No title cards match your search</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 px-4">
            {filtered.map((preset) => (
              <button
                key={preset.id}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-left border border-transparent hover:bg-surface-hover transition-colors duration-150"
              >
                <div className="size-9 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                  <Type size={14} className="text-text-muted" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{preset.name}</div>
                  <div className="text-xs text-text-dim truncate">{preset.description}</div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-text-dim font-mono uppercase">{typeLabel(preset.type)}</span>
                  {preset.hasAnimation && (
                    <span className="text-[10px] text-pink font-mono">animated</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bg border-t border-border px-4 py-3">
        <p className="text-[11px] text-text-dim leading-relaxed">
          Tell the chat <span className="text-text-muted">"add a cinematic title saying 'Chapter 1'"</span> or <span className="text-text-muted">"lower third at 12 seconds"</span>
        </p>
      </div>
    </div>
  )
}
