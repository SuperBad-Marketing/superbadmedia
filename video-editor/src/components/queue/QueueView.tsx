import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Play, Square, Trash2, Plus, ArrowLeft, Check, AlertCircle,
  Clock, ChevronDown, ChevronUp, Loader, FolderOpen, Upload,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import {
  getQueue, submitQueueJob, startQueue, stopQueue, removeQueueJob,
  selectFolder, listClients, createClient,
} from '../../lib/api'
import type { QueueJob, StructuredBrief, ClientProfile } from '../../lib/api'

const BRIEF_TYPES = [
  { id: 'shoot', label: 'Shoot' },
  { id: 'edit', label: 'Edit' },
  { id: 'shoot-edit', label: 'Shoot + Edit' },
] as const

const BUDGET_RANGES = [
  'Under $1,000',
  '$1,000 – $3,000',
  '$3,000 – $5,000',
  '$5,000 – $10,000',
  '$10,000+',
]

function parseBriefMarkdown(md: string): Partial<StructuredBrief> {
  const brief: Partial<StructuredBrief> = {}
  const lines = md.split('\n')

  const fieldMap: Record<string, keyof StructuredBrief> = {
    'business name': 'businessName',
    'business': 'businessName',
    'your name': 'contactName',
    'name': 'contactName',
    'contact': 'contactName',
    'email': 'email',
    'project title': 'projectTitle',
    'project': 'projectTitle',
    'brief type': 'briefType',
    'type': 'briefType',
    'what do you need': 'description',
    'description': 'description',
    'key messages': 'keyMessages',
    'target audience': 'targetAudience',
    'audience': 'targetAudience',
    'deliverables': 'deliverables',
    'deliverables breakdown': 'deliverables',
    'style references': 'styleReferences',
    'style': 'styleReferences',
    'references': 'styleReferences',
    'budget range': 'budgetRange',
    'budget': 'budgetRange',
    'delivery date': 'deliveryDate',
    'delivery': 'deliveryDate',
    'deadline': 'deliveryDate',
    'additional notes': 'notes',
    'notes': 'notes',
  }

  for (const line of lines) {
    // Match "**Label:** value" or "- **Label:** value" or "Label: value" or "## Label\nvalue"
    const boldMatch = line.match(/^\s*[-*]*\s*\*{0,2}([^*:]+?)\*{0,2}\s*:\s*(.+)/)
    const headerMatch = line.match(/^#{1,3}\s+(.+)/)

    if (boldMatch) {
      const label = boldMatch[1].trim().toLowerCase()
      const value = boldMatch[2].trim()
      for (const [pattern, field] of Object.entries(fieldMap)) {
        if (label.includes(pattern)) {
          (brief as any)[field] = value
          break
        }
      }
    } else if (headerMatch) {
      // Headers might be section labels — check next line for value
    }
  }

  // Normalize briefType
  if (brief.briefType) {
    const bt = (brief.briefType as string).toLowerCase()
    if (bt.includes('shoot') && bt.includes('edit')) brief.briefType = 'shoot-edit'
    else if (bt.includes('edit')) brief.briefType = 'edit'
    else if (bt.includes('shoot')) brief.briefType = 'shoot'
  }

  return brief
}

function StatusBadge({ status }: { status: QueueJob['status'] }) {
  const config: Record<QueueJob['status'], { label: string; cls: string }> = {
    pending: { label: 'Queued', cls: 'text-text-dim bg-surface-active/50' },
    importing: { label: 'Importing', cls: 'text-accent bg-accent/10' },
    'analyzing-vision': { label: 'Analyzing', cls: 'text-accent bg-accent/10' },
    translating: { label: 'Translating', cls: 'text-accent bg-accent/10' },
    assembling: { label: 'Assembling', cls: 'text-accent bg-accent/10' },
    'pushing-resolve': { label: 'Resolve', cls: 'text-accent bg-accent/10' },
    saving: { label: 'Saving', cls: 'text-accent bg-accent/10' },
    complete: { label: 'Complete', cls: 'text-green bg-green/10' },
    error: { label: 'Error', cls: 'text-red-400 bg-red-400/10' },
  }

  const c = config[status]
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

function JobCard({ job, onRemove }: { job: QueueJob; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const activeStatuses: QueueJob['status'][] = ['importing', 'analyzing-vision', 'translating', 'assembling', 'pushing-resolve', 'saving']
  const isActive = activeStatuses.includes(job.status)
  const canRemove = job.status === 'pending' || job.status === 'complete' || job.status === 'error'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border transition-colors duration-200 ${
        isActive ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-text truncate">
              {job.structuredBrief.projectTitle || job.projectName}
            </p>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-text-dim truncate">
              {job.structuredBrief.businessName}
            </p>
            <span className="text-[10px] text-text-dim/40">|</span>
            <p className="text-[10px] text-text-dim truncate font-mono">
              {job.sourcePath.split('/').slice(-2).join('/')}
            </p>
          </div>

          {isActive && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-surface-active overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] text-text-dim font-mono tabular-nums shrink-0">
                {job.statusText}
              </span>
            </div>
          )}

          {job.status === 'complete' && job.result && (
            <p className="text-[10px] text-green mt-1">
              {job.result.clipCount} clips, {Math.round(job.result.totalDuration)}s
            </p>
          )}

          {job.status === 'error' && (
            <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={10} />
              {job.error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {canRemove && (
            <button
              onClick={() => onRemove(job.id)}
              className="size-7 rounded-lg flex items-center justify-center text-text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-3">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-text-dim">Contact</span>
                  <p className="text-text-muted">{job.structuredBrief.contactName}</p>
                </div>
                <div>
                  <span className="text-text-dim">Type</span>
                  <p className="text-text-muted capitalize">{job.structuredBrief.briefType.replace('-', ' + ')}</p>
                </div>
                {job.structuredBrief.deliveryDate && (
                  <div>
                    <span className="text-text-dim">Delivery</span>
                    <p className="text-text-muted">{job.structuredBrief.deliveryDate}</p>
                  </div>
                )}
                {job.structuredBrief.budgetRange && (
                  <div>
                    <span className="text-text-dim">Budget</span>
                    <p className="text-text-muted">{job.structuredBrief.budgetRange}</p>
                  </div>
                )}
              </div>
              <div>
                <span className="text-[10px] text-text-dim">Description</span>
                <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                  {job.structuredBrief.description}
                </p>
              </div>
              {job.editBrief && (
                <div className="rounded-lg bg-surface-active/50 p-2 space-y-1">
                  <span className="text-[10px] text-text-dim font-medium">Translated edit brief</span>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div><span className="text-text-dim">Duration:</span> <span className="text-text-muted">{job.editBrief.duration}s</span></div>
                    <div><span className="text-text-dim">Platform:</span> <span className="text-text-muted">{job.editBrief.platform}</span></div>
                    <div><span className="text-text-dim">Pacing:</span> <span className="text-text-muted">{job.editBrief.pacing}</span></div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function BriefForm({
  clients,
  onSubmit,
  onCancel,
  onClientCreated,
}: {
  clients: ClientProfile[]
  onSubmit: (sourcePath: string, brief: StructuredBrief, clientId?: string) => void
  onCancel: () => void
  onClientCreated: () => void
}) {
  const [sourcePath, setSourcePath] = useState('')
  const [clientId, setClientId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [brief, setBrief] = useState<StructuredBrief>({
    businessName: '',
    contactName: '',
    email: '',
    briefType: 'edit',
    description: '',
  })

  const update = (field: keyof StructuredBrief, value: string) => {
    setBrief(prev => ({ ...prev, [field]: value }))
  }

  const handleSelectFolder = async () => {
    const folder = await selectFolder()
    if (folder) setSourcePath(folder)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const parsed = parseBriefMarkdown(text)
      setBrief(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([_, v]) => v !== undefined && v !== ''),
        ),
      }))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const canSubmit = brief.businessName && brief.contactName && brief.email && brief.description && sourcePath

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-xs transition-colors duration-150"
        >
          <ArrowLeft size={14} />
          Back to queue
        </button>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.markdown"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-border-active hover:bg-surface-hover text-text-dim hover:text-text-muted text-[11px] font-medium transition-all duration-150"
          >
            <Upload size={12} />
            Upload .md brief
          </button>
        </div>
      </div>

      {/* Footage folder picker */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-text-dim font-medium">Footage folder *</label>
        <button
          onClick={handleSelectFolder}
          className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-left transition-all duration-150 border ${
            sourcePath
              ? 'bg-surface-active/50 border-border text-text font-mono'
              : 'bg-surface-active/30 border-border border-dashed text-text-dim hover:border-border-active hover:bg-surface-active/50'
          }`}
        >
          <FolderOpen size={14} className="shrink-0" />
          {sourcePath
            ? sourcePath.split('/').slice(-2).join('/')
            : 'Select footage folder...'}
        </button>
        {sourcePath && (
          <p className="text-[9px] text-text-dim font-mono truncate px-1">{sourcePath}</p>
        )}
      </div>

      {/* Client selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-text-dim font-medium">Client</label>
        <select
          value={clientId}
          onChange={e => {
            const id = e.target.value
            setClientId(id)
            if (id === '__new__') {
              setClientId('')
            } else if (id) {
              const client = clients.find(c => c.id === id)
              if (client) {
                setBrief(prev => ({
                  ...prev,
                  businessName: prev.businessName || client.name,
                  contactName: prev.contactName || client.contactName,
                  email: prev.email || client.email,
                }))
              }
            }
          }}
          className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150 appearance-none"
        >
          <option value="">New client (or select existing)</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Client details */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Business name *" value={brief.businessName} onChange={v => update('businessName', v)} placeholder="Acme Co" />
        <Field label="Your name *" value={brief.contactName} onChange={v => update('contactName', v)} placeholder="Jane Smith" />
        <Field label="Email *" value={brief.email} onChange={v => update('email', v)} placeholder="jane@acme.co" />
      </div>

      {/* Project details */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project title" value={brief.projectTitle || ''} onChange={v => update('projectTitle', v)} placeholder="Brand launch video" />
        <div className="space-y-1.5">
          <label className="text-[10px] text-text-dim font-medium">Brief type *</label>
          <div className="flex gap-1">
            {BRIEF_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => update('briefType', t.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  brief.briefType === t.id
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-surface-active/50 text-text-dim hover:text-text-muted border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-text-dim font-medium">What do you need? *</label>
        <textarea
          value={brief.description}
          onChange={e => update('description', e.target.value)}
          placeholder="Describe the video you want — style, feel, key moments, anything that matters."
          rows={3}
          className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150 resize-none"
        />
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key messages" value={brief.keyMessages || ''} onChange={v => update('keyMessages', v)} placeholder="Brand values, tagline, etc." />
        <Field label="Target audience" value={brief.targetAudience || ''} onChange={v => update('targetAudience', v)} placeholder="Young professionals, 25-35" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Deliverables" value={brief.deliverables || ''} onChange={v => update('deliverables', v)} placeholder="IG Reel, YouTube Short, etc." />
        <Field label="Style references" value={brief.styleReferences || ''} onChange={v => update('styleReferences', v)} placeholder="Links, descriptions..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] text-text-dim font-medium">Budget range</label>
          <select
            value={brief.budgetRange || ''}
            onChange={e => update('budgetRange', e.target.value)}
            className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150 appearance-none"
          >
            <option value="">Select...</option>
            {BUDGET_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <Field label="Delivery date" value={brief.deliveryDate || ''} onChange={v => update('deliveryDate', v)} placeholder="2026-05-15" />
      </div>

      <Field label="Additional notes" value={brief.notes || ''} onChange={v => update('notes', v)} placeholder="Anything else..." />

      <button
        onClick={async () => {
          let resolvedClientId = clientId || undefined
          if (!resolvedClientId && brief.businessName) {
            const newClient = await createClient({
              name: brief.businessName,
              contactName: brief.contactName,
              email: brief.email,
            })
            resolvedClientId = newClient.profile.id
            onClientCreated()
          }
          onSubmit(sourcePath, brief, resolvedClientId)
        }}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-150 disabled:opacity-30"
      >
        <Plus size={14} />
        Add to queue
      </button>
    </motion.div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-text-dim font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150"
      />
    </div>
  )
}

export default function QueueView() {
  const setWorkflowPhase = useAppStore(s => s.setWorkflowPhase)

  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [processing, setProcessing] = useState(false)
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getQueue()
      setJobs(data.jobs)
      setProcessing(data.processing)
    } catch { /* server not up yet */ }
  }, [])

  const refreshClients = useCallback(async () => {
    try { setClients(await listClients()) } catch {}
  }, [])

  useEffect(() => {
    Promise.all([
      getQueue().then(data => { setJobs(data.jobs); setProcessing(data.processing) }).catch(() => {}),
      listClients().then(setClients).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!processing) return
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [processing, refresh])

  const handleSubmit = async (sourcePath: string, brief: StructuredBrief, clientId?: string) => {
    await submitQueueJob(sourcePath, brief, clientId)
    await refresh()
    setShowForm(false)
  }

  const handleRemove = async (id: string) => {
    await removeQueueJob(id)
    await refresh()
  }

  const handleStart = async () => {
    await startQueue()
    setProcessing(true)
  }

  const handleStop = async () => {
    await stopQueue()
    setProcessing(false)
  }

  const pendingCount = jobs.filter(j => j.status === 'pending').length
  const completeCount = jobs.filter(j => j.status === 'complete').length
  const activeJob = jobs.find(j =>
    j.status === 'importing' || j.status === 'analyzing-vision' ||
    j.status === 'translating' || j.status === 'assembling' ||
    j.status === 'pushing-resolve' || j.status === 'saving'
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader size={20} className="text-text-dim animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center px-8 py-10 select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setWorkflowPhase('home')}
              className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-[11px] transition-colors duration-150 mb-2"
            >
              <ArrowLeft size={12} />
              Home
            </button>
            <h1 className="font-display font-bold text-xl tracking-tight text-text">
              Overnight queue
            </h1>
            <p className="text-[11px] text-text-dim mt-1">
              Add briefs with their footage, hit start, walk away.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {jobs.length > 0 && pendingCount > 0 && !processing && (
              <button
                onClick={handleStart}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green/90 hover:bg-green text-bg text-xs font-semibold transition-colors duration-150"
              >
                <Play size={13} />
                Start ({pendingCount})
              </button>
            )}
            {processing && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold transition-colors duration-150"
              >
                <Square size={11} />
                Stop
              </button>
            )}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-text-muted text-xs font-medium transition-all duration-150"
              >
                <Plus size={14} />
                Add brief
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        {processing && activeJob && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-accent/5 border border-accent/20 px-4 py-3 flex items-center gap-3"
          >
            <Loader size={14} className="text-accent animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text font-medium truncate">
                {activeJob.structuredBrief.projectTitle || activeJob.projectName}
              </p>
              <p className="text-[10px] text-text-dim">{activeJob.statusText}</p>
            </div>
            <span className="text-xs font-mono text-accent tabular-nums">{activeJob.progress}%</span>
          </motion.div>
        )}

        {/* Form or list */}
        <AnimatePresence mode="wait">
          {showForm ? (
            <BriefForm
              key="form"
              clients={clients}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
              onClientCreated={refreshClients}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {jobs.length === 0 && (
                <div className="text-center py-16">
                  <Clock size={28} className="text-text-dim/30 mx-auto mb-3" />
                  <p className="text-text-muted text-sm">No jobs queued.</p>
                  <p className="text-text-dim text-xs mt-1">
                    Each job gets a brief and a footage folder. The queue handles the rest.
                  </p>
                </div>
              )}

              <AnimatePresence>
                {jobs.map(job => (
                  <JobCard key={job.id} job={job} onRemove={handleRemove} />
                ))}
              </AnimatePresence>

              {completeCount > 0 && (
                <div className="pt-4 text-center">
                  <p className="text-[10px] text-text-dim">
                    <Check size={10} className="inline text-green mr-1" />
                    {completeCount} job{completeCount !== 1 ? 's' : ''} complete
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
