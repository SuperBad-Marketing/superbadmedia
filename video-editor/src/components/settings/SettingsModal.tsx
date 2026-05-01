import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Key, Save, Check, AlertCircle, Cloud, Volume2, HardDrive, FolderOpen, Loader2, Trash2, Users, Plus, ExternalLink, Link2 } from 'lucide-react'
import { getSettings, saveSettings, selectFolder, listClients, createClient, getClient, deleteClient, listCloudinaryFolders, checkCloudinaryStatus } from '../../lib/api'
import type { ClientProfile, ClientData } from '../../lib/api'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

interface SettingField {
  key: string
  label: string
  placeholder: string
  type: 'password' | 'text'
}

interface SettingsSection {
  id: string
  title: string
  icon: typeof Key
  description: string
  fields: SettingField[]
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'anthropic',
    title: 'Anthropic',
    icon: Key,
    description: 'Powers chat, clip analysis, and grading commands.',
    fields: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', placeholder: 'sk-ant-...', type: 'password' },
    ],
  },
  {
    id: 'cloudinary',
    title: 'Cloudinary',
    icon: Cloud,
    description: 'Upload finished exports directly to client galleries.',
    fields: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud Name', placeholder: 'your-cloud-name', type: 'text' },
      { key: 'CLOUDINARY_API_KEY', label: 'API Key', placeholder: '123456789012345', type: 'text' },
      { key: 'CLOUDINARY_API_SECRET', label: 'API Secret', placeholder: 'your-api-secret', type: 'password' },
    ],
  },
  {
    id: 'dolby',
    title: 'Dolby.io',
    icon: Volume2,
    description: 'AI audio cleanup during import. Without this, basic ffmpeg cleanup is used.',
    fields: [
      { key: 'DOLBY_API_KEY', label: 'API Key', placeholder: 'your-dolby-api-key', type: 'password' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    icon: Users,
    description: '',
    fields: [],
  },
  {
    id: 'library',
    title: 'Media Library',
    icon: HardDrive,
    description: '',
    fields: [],
  },
]

const API_BASE = 'http://localhost:5201/api'

interface LibraryStats {
  totalClips: number
  analyzed: number
  visionAnalyzed: number
  watchedFolder: string | null
  isScanning: boolean
  queueLength: number
  lastScanAt: string | null
}

function MediaLibrarySection() {
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/library/stats`)
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 3000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const handleSetFolder = async () => {
    const folder = await selectFolder()
    if (!folder) return

    try {
      const res = await fetch(`${API_BASE}/library/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folder }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to set folder')
      } else {
        setError('')
        fetchStats()
      }
    } catch {
      setError('Failed to set watched folder')
    }
  }

  const handleRemoveFolder = async () => {
    try {
      await fetch(`${API_BASE}/library/watch`, { method: 'DELETE' })
      fetchStats()
    } catch {}
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      await fetch(`${API_BASE}/library/scan`, { method: 'POST' })
      fetchStats()
    } catch {}
    setScanning(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-text-dim leading-relaxed">
        Point this at a folder on your SSD. Clips inside will be automatically analyzed
        in the background so they're ready the moment you start a project.
      </p>

      {stats?.watchedFolder ? (
        <div className="space-y-3">
          <div className="bg-surface-active/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-dim font-medium">Watched folder</span>
              <button
                onClick={handleRemoveFolder}
                className="text-text-dim hover:text-accent transition-colors duration-150"
                aria-label="Remove watched folder"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <p className="text-[11px] text-text font-mono truncate" title={stats.watchedFolder}>
              {stats.watchedFolder}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-active/30 rounded-lg p-2.5 text-center">
              <div className="text-sm font-bold text-text tabular-nums">{stats.totalClips}</div>
              <div className="text-[9px] text-text-dim">Clips</div>
            </div>
            <div className="bg-surface-active/30 rounded-lg p-2.5 text-center">
              <div className="text-sm font-bold text-text tabular-nums">{stats.analyzed}</div>
              <div className="text-[9px] text-text-dim">Metadata</div>
            </div>
            <div className="bg-surface-active/30 rounded-lg p-2.5 text-center">
              <div className="text-sm font-bold text-green tabular-nums">{stats.visionAnalyzed}</div>
              <div className="text-[9px] text-text-dim">Vision</div>
            </div>
          </div>

          {stats.isScanning && (
            <div className="flex items-center gap-2 text-[10px] text-orange">
              <Loader2 size={11} className="animate-spin" />
              Scanning & analyzing...
            </div>
          )}
          {stats.queueLength > 0 && !stats.isScanning && (
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <Loader2 size={11} className="animate-spin" />
              Vision analysis: {stats.queueLength} remaining
            </div>
          )}

          {stats.lastScanAt && (
            <p className="text-[9px] text-text-dim">
              Last scan: {new Date(stats.lastScanAt).toLocaleString()}
            </p>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || stats.isScanning}
            className="w-full flex items-center justify-center gap-2 bg-surface-active/60 hover:bg-surface-active rounded-lg px-4 py-2 text-xs font-medium text-text-muted hover:text-text transition-colors duration-150 disabled:opacity-40"
          >
            {scanning || stats.isScanning ? 'Scanning...' : 'Re-scan now'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleSetFolder}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-150"
        >
          <FolderOpen size={13} />
          Choose folder
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-accent">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  )
}

function ClientsSection() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [cloudinaryFolders, setCloudinaryFolders] = useState<{ name: string; path: string }[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<ClientData | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [clientList, status] = await Promise.all([
        listClients(),
        checkCloudinaryStatus(),
      ])
      setClients(clientList)
      setCloudReady(status.configured)

      if (status.configured) {
        const folders = await listCloudinaryFolders('clients')
        setCloudinaryFolders(folders)
      }
    } catch {}
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createClient({ name: newName.trim() })
      setNewName('')
      setShowCreate(false)
      await refresh()
    } catch {}
    setCreating(false)
  }

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedData(null)
      return
    }
    setExpandedId(id)
    try {
      const data = await getClient(id)
      setExpandedData(data)
    } catch {
      setExpandedData(null)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteClient(id)
    setExpandedId(null)
    setExpandedData(null)
    await refresh()
  }

  const linkedFolders = new Set(
    clients.map((c) => {
      const safeName = c.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
      return `clients/${safeName}`
    })
  )
  const orphanedFolders = cloudinaryFolders.filter((f) => !linkedFolders.has(f.path))

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-text-dim leading-relaxed">
        Manage clients and their Cloudinary galleries. New clients automatically
        get a gallery folder created.
      </p>

      {/* Client list */}
      {clients.length > 0 && (
        <div className="space-y-1.5">
          {clients.map((client) => {
            const isExpanded = expandedId === client.id
            return (
              <div key={client.id} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => handleExpand(client.id)}
                  className={`w-full text-left p-3 transition-colors duration-150 ${
                    isExpanded ? 'bg-surface-active/60' : 'bg-surface-active/30 hover:bg-surface-active/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-6 rounded-md bg-accent-dim flex items-center justify-center">
                        <span className="text-[10px] font-bold text-accent">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-text">{client.name}</span>
                    </div>
                    {cloudReady && (
                      <Cloud size={11} className="text-green" />
                    )}
                  </div>
                </button>

                {isExpanded && expandedData && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-surface-active/20 px-3 pb-3 space-y-2.5"
                  >
                    {expandedData.cloudinaryFolder && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-dim font-medium uppercase tracking-wider">Gallery folder</span>
                        <div className="flex items-center gap-2">
                          <Link2 size={10} className="text-text-dim shrink-0" />
                          <span className="text-[11px] text-text font-mono truncate">
                            {expandedData.cloudinaryFolder}
                          </span>
                        </div>
                      </div>
                    )}

                    {expandedData.profile.contactName && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-text-dim font-medium uppercase tracking-wider">Contact</span>
                        <p className="text-[11px] text-text-muted">{expandedData.profile.contactName}</p>
                      </div>
                    )}

                    {expandedData.profile.email && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-text-dim font-medium uppercase tracking-wider">Email</span>
                        <p className="text-[11px] text-text-muted">{expandedData.profile.email}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[9px] text-text-dim">
                        {expandedData.projectIds.length} project{expandedData.projectIds.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[9px] text-text-dim/40">|</span>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-[9px] text-text-dim hover:text-accent transition-colors duration-150"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Orphaned Cloudinary folders */}
      {orphanedFolders.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] text-text-dim font-medium uppercase tracking-wider">
            Cloudinary folders (no linked client)
          </span>
          {orphanedFolders.map((folder) => (
            <div
              key={folder.path}
              className="flex items-center justify-between bg-surface-active/20 rounded-lg p-2.5"
            >
              <div className="flex items-center gap-2">
                <Cloud size={11} className="text-text-dim" />
                <span className="text-[11px] text-text-muted font-mono">{folder.path}</span>
              </div>
              <ExternalLink size={10} className="text-text-dim" />
            </div>
          ))}
        </div>
      )}

      {/* Create new client */}
      {showCreate ? (
        <div className="space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Client name"
            autoFocus
            className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="flex-1 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-150 disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName('') }}
              className="px-3 py-1.5 rounded-lg text-[11px] text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
          {cloudReady && (
            <p className="text-[9px] text-text-dim">
              A Cloudinary gallery folder will be created automatically.
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-active/60 hover:bg-surface-active rounded-lg px-4 py-2 text-xs font-medium text-text-muted hover:text-text transition-colors duration-150"
        >
          <Plus size={13} />
          Add client
        </button>
      )}

      {clients.length === 0 && !showCreate && (
        <p className="text-[10px] text-text-dim text-center py-2">
          No clients yet. Add one to get started.
        </p>
      )}
    </div>
  )
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('anthropic')

  useEffect(() => {
    if (open) {
      getSettings()
        .then((status) => {
          setConfigured(status)
          const masked: Record<string, string> = {}
          for (const [key, isSet] of Object.entries(status)) {
            if (isSet) masked[key] = '••••••••••••'
          }
          setValues(masked)
        })
        .catch(() => {})
    }
  }, [open])

  const handleSave = useCallback(async () => {
    const updates: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      if (value && !value.includes('••••')) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) return

    setSaving(true)
    setError('')

    try {
      const result = await saveSettings(updates)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        const newConfigured = { ...configured }
        for (const key of Object.keys(updates)) {
          newConfigured[key] = true
        }
        setConfigured(newConfigured)
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [values, configured])

  if (!open) return null

  const section = SECTIONS.find((s) => s.id === activeSection)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-bg/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg floating-panel rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4">
          <h2 className="font-display font-bold text-sm text-text tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="px-8 pb-4">
          <div className="flex gap-1">
            {SECTIONS.map((s) => {
              const isActive = activeSection === s.id
              const Icon = s.icon
              const allConfigured = s.fields.length > 0 && s.fields.every((f) => configured[f.key])
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setError('') }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-surface-active/60 text-text'
                      : 'text-text-dim hover:text-text-muted hover:bg-surface-hover/50'
                  }`}
                >
                  <Icon size={12} />
                  {s.title}
                  {allConfigured && <Check size={9} className="text-green" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section content */}
        <div className="px-8 pb-6 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {section.id === 'clients' ? (
                <ClientsSection />
              ) : section.id === 'library' ? (
                <MediaLibrarySection />
              ) : (
                <>
                  <p className="text-[10px] text-text-dim leading-relaxed">
                    {section.description}
                  </p>
                  {section.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-[10px] text-text-dim font-medium">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={values[field.key] || ''}
                        onChange={(e) => {
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          setSaved(false)
                        }}
                        onFocus={() => {
                          if (values[field.key]?.includes('••••')) {
                            setValues((prev) => ({ ...prev, [field.key]: '' }))
                          }
                        }}
                        placeholder={field.placeholder}
                        className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150"
                      />
                    </div>
                  ))}

                  {error && (
                    <div className="flex items-center gap-2 text-[11px] text-accent">
                      <AlertCircle size={12} />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 disabled:opacity-40"
                  >
                    {saved ? (
                      <>
                        <Check size={13} />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        {saving ? 'Saving...' : 'Save'}
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
