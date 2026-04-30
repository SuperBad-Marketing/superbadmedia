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

const SOURCE_CONFIG: Record<SkillFile['source'], { icon: typeof Youtube; label: string }> = {
  youtube: { icon: Youtube, label: 'YouTube' },
  article: { icon: Globe, label: 'Article' },
  pdf: { icon: FileText, label: 'PDF' },
  manual: { icon: PenLine, label: 'Notes' },
  'project-analysis': { icon: FolderSearch, label: 'Project' },
}

const SOURCE_TYPE_BADGE: Record<ResourceSuggestion['sourceType'], { label: string; colorClass: string }> = {
  youtube: { label: 'YouTube', colorClass: 'bg-surface-active text-text-muted' },
  article: { label: 'Article', colorClass: 'bg-surface-active text-text-muted' },
  blog: { label: 'Blog', colorClass: 'bg-surface-active text-text-muted' },
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
      className="group w-full text-left transition-colors duration-150 hover:bg-surface-hover/50"
    >
      <div className="flex items-start gap-2.5 pl-5 pr-3.5 py-2.5">
        {/* Left accent line */}
        <div className="w-px self-stretch bg-border shrink-0 group-hover:bg-border-active transition-colors duration-150" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-medium text-text truncate">{skill.name}</span>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-medium shrink-0 bg-surface-active text-text-dim">
              <SourceIcon size={8} />
              {sourceConfig.label}
            </span>
            {skill.sourceUrl && (
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-text-dim hover:text-text-muted transition-colors duration-150 shrink-0"
                aria-label="Open source"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-text-dim tabular-nums">{skill.topicCount} topics</span>
            <span className="text-[10px] text-text-dim">{relativeTime(skill.createdAt)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete skill"
          className="text-text-dim opacity-0 group-hover:opacity-100 hover:text-accent transition-all duration-150 p-1 shrink-0 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>

      {expanded && (
        <div className="ml-[21px] pl-5 pr-3.5 pb-2.5 border-l border-border">
          <p className="text-[10px] text-text-muted leading-relaxed">{truncatedContent}</p>
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
    <div className="rounded-lg p-3 bg-surface/80 border border-border transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={suggestion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-text hover:text-text-muted transition-colors duration-150 truncate"
            >
              {suggestion.title}
            </a>
            <span className={`rounded px-1.5 py-px text-[9px] font-medium shrink-0 ${badge.colorClass}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-[10px] text-text-dim leading-relaxed">{suggestion.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        {suggestion.status === 'processing' ? (
          <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
            <Loader2 size={10} className="animate-spin" />
            Learning...
          </div>
        ) : suggestion.status === 'approved' ? (
          <span className="text-[10px] text-green font-medium">Added to knowledge base</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onApprove(suggestion)}
              className="flex items-center gap-1 bg-surface-active text-text rounded px-3 py-1.5 text-[10px] font-medium hover:bg-surface-hover transition-colors duration-150"
            >
              <BookmarkPlus size={10} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => onReject(suggestion.id)}
              className="flex items-center gap-1 text-text-dim rounded px-3 py-1.5 text-[10px] font-medium hover:bg-surface-hover hover:text-text-muted transition-colors duration-150"
            >
              <X size={10} />
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
    <div className="pt-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-1">
        {RESOURCE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleSearch(cat)}
            disabled={searchingTopic === cat}
            className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-medium text-text-dim hover:bg-surface-active hover:text-text-muted transition-colors duration-150 disabled:opacity-50"
          >
            <span className="truncate">{cat}</span>
            {searchingTopic === cat ? (
              <Loader2 size={10} className="animate-spin shrink-0 ml-1" />
            ) : (
              <Search size={10} className="shrink-0 ml-1 opacity-30" />
            )}
          </button>
        ))}
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="space-y-1.5">
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
        placeholder="Paste a link or type notes..."
        className="w-full bg-surface-active/40 rounded-md px-3 py-2 text-[11px] text-text placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-border-active transition-all duration-150"
        disabled={loading}
      />
      <div className="flex items-center justify-between">
        <div className="segmented-control">
          {sourceOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSource(opt.id)}
              data-active={source === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="rounded-md px-3.5 py-1.5 text-[11px] font-semibold text-text bg-surface-active hover:bg-surface-hover transition-colors duration-150 disabled:opacity-30 disabled:hover:bg-surface-active"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Learn'}
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

  const nonEmptyCategories = CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0)
  const emptyCategories = CATEGORY_ORDER.filter((cat) => grouped[cat].length === 0)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header area — title, QuickAdd, and Find Resources integrated */}
      <div className="px-4 pt-4 pb-3 shrink-0 space-y-3 border-b border-border">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display font-semibold text-sm text-text">Knowledge</h2>
            <span className="text-[10px] text-text-dim tabular-nums">{skills.length}</span>
          </div>
          <button
            type="button"
            onClick={() => setResourceFinderOpen(!resourceFinderOpen)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium text-text-dim bg-surface-active/50 hover:bg-surface-active hover:text-text-muted transition-colors duration-150"
          >
            <Search size={11} />
            Find
          </button>
        </div>

        <QuickAdd />

        {resourceFinderOpen && <ResourceFinder />}
      </div>

      {/* Skill list — grouped by category */}
      <div className="flex-1 overflow-y-auto py-2">
        {nonEmptyCategories.map((cat, idx) => {
          const catSkills = grouped[cat]
          const isExpanded = expandedCategories.has(cat)

          return (
            <div key={cat}>
              {idx > 0 && <div className="mx-4 my-1 border-t border-border" />}

              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-1.5 w-full px-4 py-2 hover:bg-surface-hover/30 transition-colors duration-150"
              >
                {isExpanded ? (
                  <ChevronDown size={10} className="text-text-dim shrink-0" />
                ) : (
                  <ChevronRight size={10} className="text-text-dim shrink-0" />
                )}
                <span className="text-[10px] font-medium text-text-dim uppercase tracking-wider">
                  {CATEGORY_MAP[cat]}
                </span>
                <span className="text-[10px] text-text-dim tabular-nums ml-auto">{catSkills.length}</span>
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {catSkills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {emptyCategories.length > 0 && nonEmptyCategories.length > 0 && (
          <div className="mx-4 my-1 border-t border-border" />
        )}

        {emptyCategories.map((cat) => {
          const isExpanded = expandedCategories.has(cat)

          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-1.5 w-full px-4 py-2 hover:bg-surface-hover/30 transition-colors duration-150"
              >
                {isExpanded ? (
                  <ChevronDown size={10} className="text-text-dim shrink-0" />
                ) : (
                  <ChevronRight size={10} className="text-text-dim shrink-0" />
                )}
                <span className="text-[10px] font-medium text-text-dim/60 uppercase tracking-wider">
                  {CATEGORY_MAP[cat]}
                </span>
                <span className="text-[10px] text-text-dim/40 tabular-nums ml-auto">0</span>
              </button>

              {isExpanded && (
                <p className="text-text-dim/40 text-[10px] pl-9 pr-4 py-1">No skills yet</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
