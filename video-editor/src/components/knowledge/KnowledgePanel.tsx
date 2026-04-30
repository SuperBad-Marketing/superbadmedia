import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Youtube,
  Globe,
  FileText,
  PenLine,
  FolderSearch,
  Trash2,
  BookmarkPlus,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { getSkills, deleteSkill, learnFromUrl, createManualSkill } from '../../lib/api'
import type { SkillFile } from '../../types'

interface ResourceSuggestion {
  id: string
  title: string
  url: string
  sourceType: 'youtube' | 'article' | 'blog'
  description: string
  topic: string
  status: 'pending' | 'approved' | 'rejected' | 'processing'
}

const DEMO_SKILLS: SkillFile[] = [
  {
    id: 'demo-1',
    name: 'DaVinci Resolve Fusion Basics',
    category: 'resolve-core',
    source: 'youtube',
    sourceUrl: 'https://youtube.com/watch?v=example1',
    content: 'Fusion page fundamentals: node-based compositing, MediaIn/MediaOut nodes, merge operations, keyframing transforms, and basic motion graphics workflow inside Resolve.',
    createdAt: '2026-04-25T10:00:00Z',
    updatedAt: '2026-04-25T10:00:00Z',
    topicCount: 8,
  },
  {
    id: 'demo-2',
    name: 'Pacing for Social Reels',
    category: 'editorial-craft',
    source: 'article',
    sourceUrl: 'https://example.com/reel-pacing',
    content: 'Cut rhythm for short-form content: hook in first 0.5s, 2-3 second average shot length, energy ramps, beat-synced transitions, and retention curve patterns from top-performing reels.',
    createdAt: '2026-04-22T14:30:00Z',
    updatedAt: '2026-04-22T14:30:00Z',
    topicCount: 5,
  },
  {
    id: 'demo-3',
    name: 'Cinematic Colour Theory',
    category: 'editorial-craft',
    source: 'youtube',
    sourceUrl: 'https://youtube.com/watch?v=example2',
    content: 'Complementary and analogous palettes in film, using colour wheels for mood, teal-orange grading pipeline, skin tone isolation, and how to match shots across mixed lighting.',
    createdAt: '2026-04-20T09:15:00Z',
    updatedAt: '2026-04-20T09:15:00Z',
    topicCount: 6,
  },
  {
    id: 'demo-4',
    name: 'Shot Composition Notes',
    category: 'personal',
    source: 'manual',
    content: 'Rule of thirds is overused. Leading lines work better for movement shots. Negative space on the side the subject is moving toward. Always leave headroom unless going for claustrophobic feel.',
    createdAt: '2026-04-18T16:45:00Z',
    updatedAt: '2026-04-18T16:45:00Z',
    topicCount: 4,
  },
]

const RESOURCE_CATEGORIES = [
  'Resolve Scripting API',
  'Editorial Pacing',
  'Colour Grading',
  'Sound Design',
  'Transitions',
  'Motion Graphics',
]

const CATEGORY_MAP: Record<SkillFile['category'], string> = {
  'resolve-core': 'Resolve Core',
  'editorial-craft': 'Editorial Craft',
  'integration': 'Integration',
  'personal': 'Personal Notes',
  'project-learned': 'Project Learned',
}

const CATEGORY_ORDER: SkillFile['category'][] = [
  'resolve-core',
  'editorial-craft',
  'integration',
  'personal',
  'project-learned',
]

const SOURCE_CONFIG: Record<SkillFile['source'], { icon: typeof Youtube; colorClass: string }> = {
  youtube: { icon: Youtube, colorClass: 'bg-accent-dim text-accent' },
  article: { icon: Globe, colorClass: 'bg-green-dim text-green' },
  pdf: { icon: FileText, colorClass: 'bg-green-dim text-green' },
  manual: { icon: PenLine, colorClass: 'bg-amber-dim text-amber' },
  'project-analysis': { icon: FolderSearch, colorClass: 'bg-amber-dim text-amber' },
}

const SOURCE_TYPE_BADGE: Record<ResourceSuggestion['sourceType'], { label: string; colorClass: string }> = {
  youtube: { label: 'YouTube', colorClass: 'bg-accent-dim text-accent' },
  article: { label: 'Article', colorClass: 'bg-green-dim text-green' },
  blog: { label: 'Blog', colorClass: 'bg-amber-dim text-amber' },
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function SkillCard({ skill, onDelete }: { skill: SkillFile; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sourceConfig = SOURCE_CONFIG[skill.source]
  const SourceIcon = sourceConfig.icon
  const truncatedContent = skill.content.length > 200
    ? skill.content.slice(0, 200) + '...'
    : skill.content

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    try {
      await onDelete(skill.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="w-full bg-surface border border-border rounded-lg p-3 mb-2 text-left transition-colors hover:border-border-active"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-text truncate">{skill.name}</span>
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium shrink-0 ${sourceConfig.colorClass}`}>
              <SourceIcon size={10} />
              {skill.source}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-text-dim">{skill.topicCount} topics</span>
            <span className="text-xs text-text-dim">{relativeTime(skill.createdAt)}</span>
          </div>
          {skill.sourceUrl && (
            <a
              href={skill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent mt-1 truncate max-w-full transition-colors"
            >
              <ExternalLink size={10} />
              <span className="truncate">{skill.sourceUrl}</span>
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete skill"
          className="text-text-dim hover:text-accent transition-colors duration-150 p-1 shrink-0 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-text-muted leading-relaxed">{truncatedContent}</p>
        </div>
      )}
    </button>
  )
}

function ResourceCard({
  suggestion,
  onApprove,
  onReject,
}: {
  suggestion: ResourceSuggestion
  onApprove: (s: ResourceSuggestion) => void
  onReject: (id: string) => void
}) {
  const badge = SOURCE_TYPE_BADGE[suggestion.sourceType]

  if (suggestion.status === 'rejected') return null

  return (
    <div className="bg-bg border border-border rounded-lg p-3 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={suggestion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-text hover:text-accent transition-colors truncate"
            >
              {suggestion.title}
            </a>
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium shrink-0 ${badge.colorClass}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">{suggestion.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {suggestion.status === 'processing' ? (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Learning...
          </div>
        ) : suggestion.status === 'approved' ? (
          <span className="text-xs text-green font-medium">Added to knowledge base</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onApprove(suggestion)}
              className="flex items-center gap-1 bg-green-dim text-green rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
            >
              <BookmarkPlus size={12} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(suggestion.id)}
              className="flex items-center gap-1 bg-surface text-text-dim rounded-md px-2.5 py-1 text-xs font-medium hover:text-accent transition-colors"
            >
              <X size={12} />
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ResourceFinder() {
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([])
  const [searchingTopic, setSearchingTopic] = useState<string | null>(null)
  const addSkill = useAppStore((s) => s.addSkill)

  async function handleSearch(topic: string) {
    setSearchingTopic(topic)
    try {
      const res = await fetch('/api/skills/find-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      if (!res.ok) throw new Error('Search failed')
      const results: ResourceSuggestion[] = await res.json()
      setSuggestions((prev) => [
        ...prev.filter((s) => s.topic !== topic),
        ...results.map((r) => ({ ...r, topic, status: 'pending' as const })),
      ])
    } catch {
      setSuggestions((prev) => prev)
    } finally {
      setSearchingTopic(null)
    }
  }

  async function handleApprove(suggestion: ResourceSuggestion) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'processing' as const } : s))
    )
    try {
      const skill = await learnFromUrl(suggestion.url)
      addSkill(skill)
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'approved' as const } : s))
      )
    } catch {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'pending' as const } : s))
      )
    }
  }

  function handleReject(id: string) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'rejected' as const } : s))
    )
  }

  const visibleSuggestions = suggestions.filter((s) => s.status !== 'rejected')

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {RESOURCE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleSearch(cat)}
            disabled={searchingTopic === cat}
            className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-2 text-xs font-medium text-text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            <span className="truncate">{cat}</span>
            {searchingTopic === cat ? (
              <Loader2 size={12} className="animate-spin shrink-0 ml-1" />
            ) : (
              <Search size={12} className="shrink-0 ml-1 opacity-40" />
            )}
          </button>
        ))}
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="space-y-2">
          {visibleSuggestions.map((s) => (
            <ResourceCard
              key={s.id}
              suggestion={s}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type QuickAddSource = 'youtube' | 'article' | 'notes'

function QuickAdd() {
  const [input, setInput] = useState('')
  const [source, setSource] = useState<QuickAddSource>('youtube')
  const [loading, setLoading] = useState(false)
  const addSkill = useAppStore((s) => s.addSkill)

  const sourceOptions: { id: QuickAddSource; label: string }[] = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'article', label: 'Article' },
    { id: 'notes', label: 'Notes' },
  ]

  async function handleSubmit() {
    if (!input.trim()) return
    setLoading(true)

    try {
      if (source === 'notes') {
        const skill = await createManualSkill(input.trim().slice(0, 50), input.trim())
        addSkill(skill)
      } else {
        const skill = await learnFromUrl(input.trim())
        addSkill(skill)
      }
      setInput('')
    } catch {
      // Error state handled silently for now
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Paste a YouTube link, URL, or type notes..."
        className="w-full bg-bg border border-border rounded-lg p-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-active transition-colors"
        disabled={loading}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {sourceOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSource(opt.id)}
              className={`rounded-lg px-2.5 py-0.5 text-[10px] font-medium transition-colors duration-150 ${
                source === opt.id
                  ? 'bg-accent-dim text-accent border border-accent'
                  : 'bg-surface border border-border text-text-dim hover:text-text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="bg-accent rounded-lg px-3 py-1.5 text-sm font-display font-semibold text-white hover:bg-accent-hover transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Learn'}
        </button>
      </div>
    </div>
  )
}

export default function KnowledgePanel() {
  const { skills, setSkills, removeSkill } = useAppStore()
  const [resourceFinderOpen, setResourceFinderOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER)
  )

  useEffect(() => {
    let cancelled = false
    getSkills()
      .then((fetched) => {
        if (!cancelled) setSkills(fetched)
      })
      .catch(() => {
        if (!cancelled) setSkills(DEMO_SKILLS)
      })
    return () => {
      cancelled = true
    }
  }, [setSkills])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSkill(id)
      } catch {
        // API not available yet, remove locally
      }
      removeSkill(id)
    },
    [removeSkill]
  )

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, SkillFile[]>>((acc, cat) => {
    acc[cat] = skills.filter((s) => s.category === cat)
    return acc
  }, {})

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-5 space-y-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-text">Knowledge Base</h2>
            <p className="text-sm text-text-muted">{skills.length} skills learned</p>
          </div>
          <button
            type="button"
            onClick={() => setResourceFinderOpen(!resourceFinderOpen)}
            className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:border-accent hover:text-accent transition-colors"
          >
            <Search size={14} />
            Find Resources
          </button>
        </div>

        {resourceFinderOpen && <ResourceFinder />}

        <QuickAdd />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {CATEGORY_ORDER.map((cat) => {
          const catSkills = grouped[cat]
          const isExpanded = expandedCategories.has(cat)

          return (
            <div key={cat} className="mb-4">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-1.5 w-full pb-1.5 mb-2 border-b border-border"
              >
                {isExpanded ? (
                  <ChevronDown size={12} className="text-text-dim" />
                ) : (
                  <ChevronRight size={12} className="text-text-dim" />
                )}
                <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                  {CATEGORY_MAP[cat]}
                </span>
                <span className="text-xs text-text-dim font-mono ml-auto">{catSkills.length}</span>
              </button>

              {isExpanded && (
                <>
                  {catSkills.length === 0 ? (
                    <p className="text-text-dim text-xs italic pl-5 py-1">No skills yet</p>
                  ) : (
                    catSkills.map((skill) => (
                      <SkillCard key={skill.id} skill={skill} onDelete={handleDelete} />
                    ))
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
