import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft, Plus, Upload, FolderOpen, Trash2, X,
  User, Palette, FileText, Film, Loader2, ExternalLink,
  Type, Volume2, Image, Layers,
} from 'lucide-react'
import {
  listClients, getClient, createClient, updateClient, deleteClient,
  uploadClientLogo, addClientInstruction, removeClientInstruction,
  addReferenceReel, listReferenceReels, removeReferenceReel,
  openClientFolder, setClientFootagePath,
  updateClientTypography, updateClientLogoUsage,
  updateClientAudioDefaults, updateClientBrandColors,
  setClientDefaultPlatform,
  addEditStyle, updateEditStyle, removeEditStyle,
} from '../../lib/api'
import type {
  ClientProfile, ClientData, ClientInstructions, ReferenceReel,
  ClientTypography, LogoUsage, AudioDefaults, EditStyle, CaptionStyle,
} from '../../lib/api'

type Tab = 'profile' | 'brand' | 'instructions' | 'styles' | 'reels'

interface Props {
  onBack: () => void
}

export default function ClientsPage({ onBack }: Props) {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const refreshClients = useCallback(async () => {
    const list = await listClients()
    setClients(list)
  }, [])

  useEffect(() => {
    refreshClients().finally(() => setLoading(false))
  }, [refreshClients])

  const selectClient = useCallback(async (id: string) => {
    setSelectedId(id)
    setActiveTab('profile')
    const data = await getClient(id)
    setClientData(data)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    const data = await createClient({ name: newName.trim() })
    setNewName('')
    setCreating(false)
    await refreshClients()
    selectClient(data.profile.id)
  }, [newName, refreshClients, selectClient])

  const handleDelete = useCallback(async (id: string) => {
    await deleteClient(id)
    if (selectedId === id) { setSelectedId(null); setClientData(null) }
    refreshClients()
  }, [selectedId, refreshClients])

  const TABS = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'brand' as const, label: 'Brand', icon: Palette },
    { id: 'instructions' as const, label: 'Instructions', icon: FileText },
    { id: 'styles' as const, label: 'Edit Styles', icon: Layers },
    { id: 'reels' as const, label: 'Reference Reels', icon: Film },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button onClick={onBack} className="size-8 rounded-lg flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display font-bold text-lg tracking-tight text-text">Clients</h1>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-56 border-r border-border flex flex-col">
          <div className="p-3">
            {creating ? (
              <div className="flex gap-1.5">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Client name" className="flex-1 bg-surface-active/60 rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-dim/50 focus:outline-none border border-border focus:border-border-active" />
                <button onClick={handleCreate} className="px-2 py-1.5 rounded-lg bg-accent text-white text-[10px] font-semibold cursor-pointer">Add</button>
                <button onClick={() => setCreating(false)} className="px-1.5 py-1.5 rounded-lg text-text-dim hover:text-text cursor-pointer"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
                <Plus size={12} /> New client
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-text-dim" /></div>
            ) : clients.length === 0 ? (
              <p className="text-[10px] text-text-dim text-center py-8">No clients yet.</p>
            ) : clients.map((c) => (
              <button key={c.id} onClick={() => selectClient(c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer mb-0.5 ${selectedId === c.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-surface-hover hover:text-text'}`}>
                <span className="block truncate">{c.name}</span>
                {c.contactName && <span className="block text-[10px] text-text-dim truncate mt-0.5">{c.contactName}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-sm text-text-dim">Select a client or create a new one.</p></div>
          ) : !clientData ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-text-dim" /></div>
          ) : (
            <>
              <div className="flex items-center gap-1 px-6 pt-4 pb-2">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${activeTab === id ? 'bg-surface-active text-text' : 'text-text-dim hover:text-text-muted hover:bg-surface-hover'}`}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={() => openClientFolder(clientData.profile.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] text-text-dim hover:text-text-muted hover:bg-surface-hover transition-colors cursor-pointer">
                  <FolderOpen size={11} /> Open folder
                </button>
                <button onClick={() => handleDelete(clientData.profile.id)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] text-text-dim hover:text-red hover:bg-red/5 transition-colors cursor-pointer">
                  <Trash2 size={11} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'profile' && <ProfileTab key="profile" data={clientData} onUpdate={(d) => { setClientData(d); refreshClients() }} />}
                  {activeTab === 'brand' && <BrandTab key="brand" data={clientData} onUpdate={setClientData} />}
                  {activeTab === 'instructions' && <InstructionsTab key="instructions" data={clientData} onUpdate={setClientData} />}
                  {activeTab === 'styles' && <EditStylesTab key="styles" data={clientData} onUpdate={setClientData} />}
                  {activeTab === 'reels' && <ReelsTab key="reels" data={clientData} onUpdate={setClientData} />}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Profile Tab ────────────────────────────────────────

function ProfileTab({ data, onUpdate }: { data: ClientData; onUpdate: (d: ClientData) => void }) {
  const [name, setName] = useState(data.profile.name)
  const [contactName, setContactName] = useState(data.profile.contactName)
  const [email, setEmail] = useState(data.profile.email)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setName(data.profile.name); setContactName(data.profile.contactName); setEmail(data.profile.email) }, [data.profile])

  const handleSave = async () => { setSaving(true); const u = await updateClient(data.profile.id, { name, contactName, email }); onUpdate(u); setSaving(false) }
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { onUpdate(await uploadClientLogo(data.profile.id, f)) } catch {} setUploading(false) }
  const hasChanges = name !== data.profile.name || contactName !== data.profile.contactName || email !== data.profile.email

  return (
    <TabWrapper>
      <div>
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-xl bg-surface-active/60 border border-border flex items-center justify-center overflow-hidden">
            {data.profile.logoPath ? <img src={`/api/clients/${data.profile.id}/logo`} alt="" className="size-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <User size={20} className="text-text-dim/30" />}
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleLogoUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover border border-border transition-colors cursor-pointer disabled:opacity-50">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {data.profile.logoPath ? 'Replace' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
      <Field label="Name" value={name} onChange={setName} />
      <Field label="Contact name" value={contactName} onChange={setContactName} />
      <Field label="Email" value={email} onChange={setEmail} type="email" />
      <div>
        <Label>Footage library</Label>
        <FootagePathField clientId={data.profile.id} currentPath={data.footageLibraryPath} onUpdate={onUpdate} />
      </div>
      {hasChanges && <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60">{saving ? <Loader2 size={12} className="animate-spin" /> : 'Save changes'}</button>}
    </TabWrapper>
  )
}

// ─── Brand Tab (Typography, Colors, Logo Usage, Audio, Platform) ────────

function BrandTab({ data, onUpdate }: { data: ClientData; onUpdate: (d: ClientData) => void }) {
  const typo = data.typography || { heading: { family: '', weight: '700' }, subheading: { family: '', weight: '600' }, body: { family: '', weight: '400' } }
  const logo = data.logoUsage || { intro: false, outro: true, watermark: false, watermarkPosition: 'bottom-right' as const, watermarkOpacity: 30, outroDuration: 3 }
  const audio = data.audioDefaults || { musicVolume: 'balanced' as const, preserveOriginalAudio: true }
  const colors = data.brandColors || []
  const platform = data.defaultPlatform || 'instagram-reel'

  const [typoState, setTypoState] = useState(typo)
  const [logoState, setLogoState] = useState(logo)
  const [audioState, setAudioState] = useState(audio)
  const [colorsState, setColorsState] = useState(colors)
  const [platformState, setPlatformState] = useState(platform)
  const [newColor, setNewColor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setTypoState(typo); setLogoState(logo); setAudioState(audio); setColorsState(colors); setPlatformState(platform) }, [data])

  const handleSave = async () => {
    setSaving(true)
    let updated = data
    updated = await updateClientTypography(data.profile.id, typoState)
    updated = await updateClientLogoUsage(data.profile.id, logoState)
    updated = await updateClientAudioDefaults(data.profile.id, audioState)
    updated = await updateClientBrandColors(data.profile.id, colorsState)
    updated = await setClientDefaultPlatform(data.profile.id, platformState)
    onUpdate(updated)
    setSaving(false)
  }

  const PLATFORMS = [
    { id: 'instagram-reel', label: 'IG Reel' },
    { id: 'youtube-short', label: 'YT Short' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'generic', label: 'Other' },
  ]

  const WEIGHTS = ['300', '400', '500', '600', '700', '800', '900']

  return (
    <TabWrapper>
      {/* Typography */}
      <div>
        <SectionHeading icon={Type} label="Typography" />
        <div className="space-y-3 mt-3">
          {(['heading', 'subheading', 'body'] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-3">
              <span className="text-[10px] text-text-dim w-20 capitalize">{tier === 'body' ? 'Body / captions' : tier + 's'}</span>
              <input
                value={typoState[tier].family}
                onChange={(e) => setTypoState({ ...typoState, [tier]: { ...typoState[tier], family: e.target.value } })}
                placeholder="Font family"
                className="flex-1 bg-surface-active/40 rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim/40 focus:outline-none border border-border focus:border-border-active"
              />
              <select
                value={typoState[tier].weight}
                onChange={(e) => setTypoState({ ...typoState, [tier]: { ...typoState[tier], weight: e.target.value } })}
                className="bg-surface-active/40 rounded-lg px-2 py-2 text-xs text-text border border-border focus:outline-none cursor-pointer"
              >
                {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Brand colors */}
      <div>
        <SectionHeading icon={Palette} label="Brand colours" />
        <div className="flex flex-wrap gap-2 mt-3">
          {colorsState.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-active/40 rounded-lg px-2 py-1.5 group">
              <div className="size-4 rounded" style={{ backgroundColor: c }} />
              <span className="text-[10px] text-text-muted font-mono">{c}</span>
              <button onClick={() => setColorsState(colorsState.filter((_, j) => j !== i))} className="text-text-dim/0 group-hover:text-text-dim hover:!text-red cursor-pointer"><X size={10} /></button>
            </div>
          ))}
          <div className="flex gap-1">
            <input value={newColor} onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newColor.trim()) { setColorsState([...colorsState, newColor.trim()]); setNewColor('') } }} placeholder="#hex" className="w-20 bg-surface-active/40 rounded-lg px-2 py-1.5 text-[10px] text-text font-mono placeholder:text-text-dim/40 focus:outline-none border border-border" />
            <button onClick={() => { if (newColor.trim()) { setColorsState([...colorsState, newColor.trim()]); setNewColor('') } }} className="px-2 py-1.5 rounded-lg text-[10px] text-text-dim hover:text-text border border-border cursor-pointer">Add</button>
          </div>
        </div>
      </div>

      {/* Logo usage */}
      <div>
        <SectionHeading icon={Image} label="Logo usage" />
        <div className="space-y-2 mt-3">
          <Toggle label="Show in intro" checked={logoState.intro} onChange={(v) => setLogoState({ ...logoState, intro: v })} />
          <Toggle label="Show in outro" checked={logoState.outro} onChange={(v) => setLogoState({ ...logoState, outro: v })} />
          {logoState.outro && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-[10px] text-text-dim">Duration</span>
              <input type="number" value={logoState.outroDuration} onChange={(e) => setLogoState({ ...logoState, outroDuration: Number(e.target.value) })} className="w-14 bg-surface-active/40 rounded px-2 py-1 text-xs text-text border border-border focus:outline-none text-center" />
              <span className="text-[10px] text-text-dim">s</span>
            </div>
          )}
          <Toggle label="Watermark" checked={logoState.watermark} onChange={(v) => setLogoState({ ...logoState, watermark: v })} />
          {logoState.watermark && (
            <div className="flex items-center gap-3 pl-6">
              <select value={logoState.watermarkPosition} onChange={(e) => setLogoState({ ...logoState, watermarkPosition: e.target.value as LogoUsage['watermarkPosition'] })} className="bg-surface-active/40 rounded-lg px-2 py-1.5 text-[10px] text-text border border-border cursor-pointer">
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
              </select>
              <span className="text-[10px] text-text-dim">Opacity</span>
              <input type="number" min={5} max={100} step={5} value={logoState.watermarkOpacity} onChange={(e) => setLogoState({ ...logoState, watermarkOpacity: Number(e.target.value) })} className="w-14 bg-surface-active/40 rounded px-2 py-1 text-xs text-text border border-border focus:outline-none text-center" />
              <span className="text-[10px] text-text-dim">%</span>
            </div>
          )}
        </div>
      </div>

      {/* Audio defaults */}
      <div>
        <SectionHeading icon={Volume2} label="Audio defaults" />
        <div className="space-y-3 mt-3">
          <div>
            <span className="text-[10px] text-text-dim block mb-1.5">Music level</span>
            <div className="flex gap-1.5">
              {(['background', 'balanced', 'music-forward'] as const).map((v) => (
                <button key={v} onClick={() => setAudioState({ ...audioState, musicVolume: v })} className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${audioState.musicVolume === v ? 'bg-accent/15 text-accent border border-accent/20' : 'bg-surface-active/30 text-text-dim border border-transparent hover:text-text-muted'}`}>
                  {v === 'music-forward' ? 'Music forward' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Preserve original clip audio" checked={audioState.preserveOriginalAudio} onChange={(v) => setAudioState({ ...audioState, preserveOriginalAudio: v })} />
        </div>
      </div>

      {/* Default platform */}
      <div>
        <Label>Default platform</Label>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button key={p.id} onClick={() => setPlatformState(p.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${platformState === p.id ? 'bg-accent/15 text-accent border border-accent/20' : 'bg-surface-active/30 text-text-dim border border-transparent hover:text-text-muted'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60">
        {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save brand settings'}
      </button>
    </TabWrapper>
  )
}

// ─── Edit Styles Tab ────────────────────────────────────

function EditStylesTab({ data, onUpdate }: { data: ClientData; onUpdate: (d: ClientData) => void }) {
  const styles = data.editStyles || []
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const updated = await addEditStyle(data.profile.id, newName.trim())
    onUpdate(updated)
    setNewName('')
    setCreating(false)
    const newStyles = updated.editStyles || []
    if (newStyles.length > 0) setExpandedId(newStyles[newStyles.length - 1].id)
  }

  const handleRemove = async (styleId: string) => {
    const updated = await removeEditStyle(data.profile.id, styleId)
    onUpdate(updated)
    if (expandedId === styleId) setExpandedId(null)
  }

  const handleUpdateStyle = async (styleId: string, updates: Partial<EditStyle>) => {
    const updated = await updateEditStyle(data.profile.id, styleId, updates)
    onUpdate(updated)
  }

  return (
    <TabWrapper>
      <p className="text-[11px] text-text-dim leading-relaxed">
        Different types of videos for {data.profile.name}. Each style carries its own pacing, mood, grading, captions, and instructions.
        Global settings (fonts, logo, colours) apply to all styles.
      </p>

      {styles.map((style) => (
        <div key={style.id} className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === style.id ? null : style.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors cursor-pointer"
          >
            <Layers size={14} className="text-text-dim shrink-0" />
            <span className="flex-1 text-xs font-medium text-text">{style.name}</span>
            {style.isDefault && <span className="text-[9px] text-accent/60 font-medium uppercase tracking-wider">Default</span>}
            <span className="text-[10px] text-text-dim">
              {[style.defaultPacing, style.defaultMood].filter(Boolean).join(' · ') || 'Configure'}
            </span>
          </button>

          {expandedId === style.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border px-4 py-4 space-y-4"
            >
              <Field label="Style name" value={style.name} onChange={(v) => handleUpdateStyle(style.id, { name: v })} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Default pacing</Label>
                  <div className="flex gap-1">
                    {(['fast', 'medium', 'slow'] as const).map((p) => (
                      <button key={p} onClick={() => handleUpdateStyle(style.id, { defaultPacing: p })} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer ${style.defaultPacing === p ? 'bg-accent/15 text-accent border border-accent/20' : 'bg-surface-active/30 text-text-dim border border-transparent'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Default mood" value={style.defaultMood} onChange={(v) => handleUpdateStyle(style.id, { defaultMood: v })} placeholder="e.g. energetic" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Grading look" value={style.gradingLook} onChange={(v) => handleUpdateStyle(style.id, { gradingLook: v })} placeholder="e.g. warm, punchy" />
                <Field label="Music direction" value={style.musicKeywords} onChange={(v) => handleUpdateStyle(style.id, { musicKeywords: v })} placeholder="e.g. electronic, upbeat" />
              </div>

              {/* Caption style */}
              <div>
                <Label>Captions</Label>
                <div className="flex gap-3">
                  <div>
                    <span className="text-[9px] text-text-dim block mb-1">Position</span>
                    <div className="flex gap-1">
                      {(['bottom', 'center', 'top'] as const).map((p) => (
                        <button key={p} onClick={() => handleUpdateStyle(style.id, { captionStyle: { ...style.captionStyle, position: p } })} className={`px-2 py-1 rounded text-[9px] font-medium cursor-pointer ${style.captionStyle.position === p ? 'bg-accent/15 text-accent' : 'bg-surface-active/30 text-text-dim'}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-text-dim block mb-1">Background</span>
                    <div className="flex gap-1">
                      {(['none', 'solid', 'gradient', 'outline'] as const).map((b) => (
                        <button key={b} onClick={() => handleUpdateStyle(style.id, { captionStyle: { ...style.captionStyle, background: b } })} className={`px-2 py-1 rounded text-[9px] font-medium cursor-pointer ${style.captionStyle.background === b ? 'bg-accent/15 text-accent' : 'bg-surface-active/30 text-text-dim'}`}>{b}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-text-dim block mb-1">Size</span>
                    <div className="flex gap-1">
                      {(['subtle', 'standard', 'bold'] as const).map((s) => (
                        <button key={s} onClick={() => handleUpdateStyle(style.id, { captionStyle: { ...style.captionStyle, size: s } })} className={`px-2 py-1 rounded text-[9px] font-medium cursor-pointer ${style.captionStyle.size === s ? 'bg-accent/15 text-accent' : 'bg-surface-active/30 text-text-dim'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Style-specific instructions */}
              <StyleInstructions clientId={data.profile.id} style={style} onUpdate={onUpdate} />

              <div className="flex justify-end pt-2">
                <button onClick={() => handleRemove(style.id)} className="flex items-center gap-1 text-[10px] text-text-dim hover:text-red transition-colors cursor-pointer">
                  <Trash2 size={10} /> Remove style
                </button>
              </div>
            </motion.div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="flex gap-1.5">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="e.g. Montage, Talking Head, Voiceover" className="flex-1 bg-surface-active/40 rounded-lg px-3 py-2.5 text-xs text-text placeholder:text-text-dim/40 focus:outline-none border border-border focus:border-border-active" />
          <button onClick={handleCreate} className="px-4 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">Add</button>
          <button onClick={() => setCreating(false)} className="px-2 py-2.5 text-text-dim hover:text-text cursor-pointer"><X size={14} /></button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-border-active text-text-dim hover:text-text-muted text-xs transition-colors cursor-pointer">
          <Plus size={12} /> Add edit style
        </button>
      )}
    </TabWrapper>
  )
}

function StyleInstructions({ clientId, style, onUpdate }: { clientId: string; style: EditStyle; onUpdate: (d: ClientData) => void }) {
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const categories: { id: keyof ClientInstructions; label: string }[] = [
    { id: 'editing', label: 'Editing rules' },
    { id: 'style', label: 'Style notes' },
    { id: 'avoid', label: 'Avoid' },
    { id: 'general', label: 'General' },
  ]

  const handleAdd = async (category: keyof ClientInstructions) => {
    const v = newValues[category]?.trim()
    if (!v) return
    const updated = { ...style.instructions }
    updated[category] = [...updated[category], v]
    const result = await updateEditStyle(clientId, style.id, { instructions: updated })
    onUpdate(result)
    setNewValues((prev) => ({ ...prev, [category]: '' }))
  }

  const handleRemove = async (category: keyof ClientInstructions, index: number) => {
    const updated = { ...style.instructions }
    updated[category] = updated[category].filter((_, i) => i !== index)
    const result = await updateEditStyle(clientId, style.id, { instructions: updated })
    onUpdate(result)
  }

  return (
    <div className="space-y-3">
      <Label>Style-specific instructions</Label>
      {categories.map(({ id, label }) => (
        <div key={id}>
          <span className="text-[9px] text-text-dim uppercase tracking-wider block mb-1">{label}</span>
          {style.instructions[id].map((inst, i) => (
            <div key={i} className="flex items-start gap-1.5 group">
              <span className="flex-1 text-[10px] text-text-muted leading-relaxed py-0.5">{inst}</span>
              <button onClick={() => handleRemove(id, i)} className="text-text-dim/0 group-hover:text-text-dim hover:!text-red cursor-pointer"><X size={9} /></button>
            </div>
          ))}
          <div className="flex gap-1 mt-1">
            <input value={newValues[id] || ''} onChange={(e) => setNewValues((p) => ({ ...p, [id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAdd(id)} placeholder={`Add ${label.toLowerCase()}`} className="flex-1 bg-surface-active/30 rounded px-2 py-1 text-[10px] text-text placeholder:text-text-dim/30 focus:outline-none border border-border/50" />
            <button onClick={() => handleAdd(id)} disabled={!newValues[id]?.trim()} className="px-2 py-1 rounded text-[9px] text-text-dim hover:text-text border border-border/50 cursor-pointer disabled:opacity-30">+</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Instructions Tab (Global) ──────────────────────────

const INSTRUCTION_CATEGORIES: { id: keyof ClientInstructions; label: string; placeholder: string }[] = [
  { id: 'editing', label: 'Editing rules', placeholder: 'e.g. Keep cuts under 3 seconds' },
  { id: 'style', label: 'Style preferences', placeholder: 'e.g. Warm, natural colour grading' },
  { id: 'avoid', label: 'Things to avoid', placeholder: 'e.g. No text overlays on footage' },
  { id: 'general', label: 'General notes', placeholder: 'e.g. Always include logo in outro' },
]

function InstructionsTab({ data, onUpdate }: { data: ClientData; onUpdate: (d: ClientData) => void }) {
  const [newValues, setNewValues] = useState<Record<string, string>>({})

  const handleAdd = async (category: keyof ClientInstructions) => {
    const v = newValues[category]?.trim()
    if (!v) return
    const updated = await addClientInstruction(data.profile.id, category, v)
    onUpdate(updated)
    setNewValues((prev) => ({ ...prev, [category]: '' }))
  }

  const handleRemove = async (category: keyof ClientInstructions, index: number) => {
    const updated = await removeClientInstruction(data.profile.id, category, index)
    onUpdate(updated)
  }

  return (
    <TabWrapper>
      <p className="text-[11px] text-text-dim leading-relaxed">
        Global instructions for {data.profile.name}. These apply to all edit styles. For style-specific instructions, use the Edit Styles tab.
      </p>
      {INSTRUCTION_CATEGORIES.map(({ id, label, placeholder }) => (
        <div key={id}>
          <Label>{label}</Label>
          {data.instructions[id].length > 0 && (
            <div className="space-y-1 mb-2">
              {data.instructions[id].map((inst, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <span className="flex-1 text-xs text-text-muted leading-relaxed py-1">{inst}</span>
                  <button onClick={() => handleRemove(id, i)} className="mt-1 text-text-dim/0 group-hover:text-text-dim hover:!text-red transition-colors cursor-pointer"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input value={newValues[id] || ''} onChange={(e) => setNewValues((p) => ({ ...p, [id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAdd(id)} placeholder={placeholder} className="flex-1 bg-surface-active/40 rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-dim/40 focus:outline-none border border-border focus:border-border-active transition-colors" />
            <button onClick={() => handleAdd(id)} disabled={!newValues[id]?.trim()} className="px-3 py-2 rounded-lg text-[10px] font-medium text-text-dim hover:text-text hover:bg-surface-hover border border-border transition-colors cursor-pointer disabled:opacity-30">Add</button>
          </div>
        </div>
      ))}
    </TabWrapper>
  )
}

// ─── Reference Reels Tab (Global) ───────────────────────

function ReelsTab({ data, onUpdate }: { data: ClientData; onUpdate: (d: ClientData) => void }) {
  const [reels, setReels] = useState<ReferenceReel[]>(data.referenceReels || [])
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { setReels(data.referenceReels || []) }, [data.referenceReels])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!reels.some((r) => !r.analysis)) return
      const fresh = await listReferenceReels(data.profile.id)
      setReels(fresh)
      if (fresh.every((r: ReferenceReel) => r.analysis)) {
        onUpdate(await getClient(data.profile.id))
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [reels, data.profile.id, onUpdate])

  const handleAdd = async () => {
    if (!newUrl.trim()) return
    setAdding(true)
    try { const r = await addReferenceReel(data.profile.id, newUrl.trim()); setReels((p) => [...p, r.reel]); setNewUrl('') } catch {}
    setAdding(false)
  }

  const handleRemove = async (reelId: string) => {
    await removeReferenceReel(data.profile.id, reelId)
    setReels((p) => p.filter((r) => r.id !== reelId))
  }

  return (
    <TabWrapper>
      <p className="text-[11px] text-text-dim leading-relaxed">
        Global reference reels for {data.profile.name}. For style-specific references, add them inside each Edit Style.
      </p>
      <div className="flex gap-1.5">
        <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Paste Instagram reel URL" className="flex-1 bg-surface-active/40 rounded-lg px-3 py-2.5 text-xs text-text placeholder:text-text-dim/40 focus:outline-none border border-border focus:border-border-active" />
        <button onClick={handleAdd} disabled={!newUrl.trim() || adding} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40">
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
        </button>
      </div>
      {reels.length > 0 && (
        <div className="space-y-2">
          {reels.map((reel) => (
            <div key={reel.id} className="rounded-xl bg-surface border border-border p-3 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <a href={reel.url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-accent truncate flex items-center gap-1">
                  {reel.url.length > 50 ? reel.url.slice(0, 50) + '...' : reel.url} <ExternalLink size={10} />
                </a>
                {reel.analysis ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-dim">
                    <span>{reel.analysis.totalDuration.toFixed(0)}s</span>
                    <span>{reel.analysis.cutCount} cuts</span>
                    <span>avg {reel.analysis.avgCutLength.toFixed(1)}s</span>
                    <span className={reel.analysis.pacing === 'fast' ? 'text-orange' : reel.analysis.pacing === 'slow' ? 'text-blue' : 'text-green'}>{reel.analysis.pacing}</span>
                    {reel.analysis.notes && <span className="w-full mt-1 text-text-muted">{reel.analysis.notes}</span>}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-dim"><Loader2 size={10} className="animate-spin" /> Analyzing...</div>
                )}
              </div>
              <button onClick={() => handleRemove(reel.id)} className="text-text-dim/0 group-hover:text-text-dim hover:!text-red transition-colors cursor-pointer mt-0.5"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </TabWrapper>
  )
}

// ─── Shared Components ──────────────────────────────────

function TabWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="max-w-lg pt-4 space-y-5">
      {children}
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase mb-1.5 block">{children}</label>
}

function SectionHeading({ icon: Icon, label }: { icon: any; label: string }) {
  return <div className="flex items-center gap-1.5"><Icon size={12} className="text-text-dim" /><span className="text-[10px] font-semibold text-text-dim tracking-[0.1em] uppercase">{label}</span></div>
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-surface-active/60 rounded-lg px-3 py-2.5 text-xs text-text focus:outline-none border border-border focus:border-border-active transition-colors" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2.5 cursor-pointer group">
      <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-surface-active'}`}>
        <div className={`size-3 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-xs text-text-muted group-hover:text-text transition-colors">{label}</span>
    </button>
  )
}

function FootagePathField({ clientId, currentPath, onUpdate }: { clientId: string; currentPath?: string; onUpdate: (d: ClientData) => void }) {
  const [editing, setEditing] = useState(false)
  const [path, setPath] = useState(currentPath || '')
  const handleSave = async () => { if (!path.trim()) return; onUpdate(await setClientFootagePath(clientId, path.trim())); setEditing(false) }

  if (!editing && currentPath) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted truncate flex-1 font-mono">{currentPath}</span>
        <button onClick={() => setEditing(true)} className="text-[10px] text-text-dim hover:text-text cursor-pointer">Change</button>
      </div>
    )
  }
  return (
    <div className="flex gap-1.5">
      <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path/to/footage" className="flex-1 bg-surface-active/60 rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim/50 focus:outline-none border border-border focus:border-border-active" />
      <button onClick={handleSave} className="px-3 py-2 rounded-lg bg-accent text-white text-[10px] font-semibold cursor-pointer">Set</button>
      {currentPath && <button onClick={() => setEditing(false)} className="px-2 py-2 text-text-dim hover:text-text cursor-pointer"><X size={12} /></button>}
    </div>
  )
}
