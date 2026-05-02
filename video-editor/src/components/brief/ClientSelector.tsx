import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, User, ArrowRight, ArrowLeft, X, Loader2, Film } from 'lucide-react'
import { listClients, createClient, getClient } from '../../lib/api'
import type { ClientProfile, EditStyle } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

type Step = 'client' | 'style'

export default function ClientSelector() {
  const [step, setStep] = useState<Step>('client')
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [pickedClientId, setPickedClientId] = useState<string | null>(null)
  const [pickedClientName, setPickedClientName] = useState('')
  const [editStyles, setEditStyles] = useState<EditStyle[]>([])
  const [loadingStyles, setLoadingStyles] = useState(false)

  const setSelectedClientId = useAppStore((s) => s.setSelectedClientId)
  const setSelectedEditStyleId = useAppStore((s) => s.setSelectedEditStyleId)
  const setBriefPhase = useAppStore((s) => s.setBriefPhase)

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelectClient = useCallback(async (id: string, name: string) => {
    setPickedClientId(id)
    setPickedClientName(name)
    setLoadingStyles(true)
    try {
      const data = await getClient(id)
      const styles = data.editStyles || []
      if (styles.length === 0) {
        setSelectedClientId(id)
        setSelectedEditStyleId(null)
        setBriefPhase('braindump')
      } else if (styles.length === 1) {
        setSelectedClientId(id)
        setSelectedEditStyleId(styles[0].id)
        setBriefPhase('braindump')
      } else {
        setEditStyles(styles)
        setStep('style')
      }
    } catch {
      setSelectedClientId(id)
      setSelectedEditStyleId(null)
      setBriefPhase('braindump')
    }
    setLoadingStyles(false)
  }, [setSelectedClientId, setSelectedEditStyleId, setBriefPhase])

  const handleSelectStyle = useCallback((styleId: string) => {
    setSelectedClientId(pickedClientId)
    setSelectedEditStyleId(styleId)
    setBriefPhase('braindump')
  }, [pickedClientId, setSelectedClientId, setSelectedEditStyleId, setBriefPhase])

  const handleSkip = useCallback(() => {
    setSelectedClientId(null)
    setSelectedEditStyleId(null)
    setBriefPhase('braindump')
  }, [setSelectedClientId, setSelectedEditStyleId, setBriefPhase])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    const data = await createClient({ name: newName.trim() })
    setNewName('')
    setCreating(false)
    handleSelectClient(data.profile.id, data.profile.name)
  }, [newName, handleSelectClient])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-dim" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <AnimatePresence mode="wait">
        {step === 'client' && (
          <motion.div
            key="client"
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display font-bold text-xl tracking-tight text-text text-center mb-2">
              Who's this for?
            </h1>
            <p className="text-text-dim text-xs text-center mb-8">
              Pick a client so SuperEdits can match their style and preferences.
            </p>

            <div className="space-y-1.5 mb-6">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client.id, client.name)}
                  disabled={loadingStyles}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-left transition-all duration-200 cursor-pointer group disabled:opacity-60"
                >
                  <div className="size-8 rounded-lg bg-surface-active/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {client.logoPath ? (
                      <img
                        src={`/api/clients/${client.id}/logo`}
                        alt=""
                        className="size-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : null}
                    <User size={14} className={`text-text-dim/40 ${client.logoPath ? 'hidden' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-text-muted group-hover:text-text block truncate">
                      {client.name}
                    </span>
                    {client.contactName && (
                      <span className="text-[10px] text-text-dim block truncate">{client.contactName}</span>
                    )}
                  </div>
                  {loadingStyles && pickedClientId === client.id ? (
                    <Loader2 size={14} className="animate-spin text-text-dim" />
                  ) : (
                    <ArrowRight size={14} className="text-text-dim/0 group-hover:text-text-dim transition-colors" />
                  )}
                </button>
              ))}
            </div>

            {creating ? (
              <div className="flex gap-1.5 mb-4">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Client name"
                  className="flex-1 bg-surface-active/60 rounded-xl px-4 py-2.5 text-xs text-text placeholder:text-text-dim/50 focus:outline-none border border-border focus:border-border-active"
                />
                <button onClick={handleCreate} className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold cursor-pointer">Add</button>
                <button onClick={() => setCreating(false)} className="px-2 py-2.5 rounded-xl text-text-dim hover:text-text cursor-pointer"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-border-active text-text-dim hover:text-text-muted text-xs transition-colors cursor-pointer mb-4"
              >
                <Plus size={12} />
                New client
              </button>
            )}

            <button
              onClick={handleSkip}
              className="w-full text-center text-[11px] text-text-dim/50 hover:text-text-dim transition-colors cursor-pointer py-2"
            >
              Skip — no specific client
            </button>
          </motion.div>
        )}

        {step === 'style' && (
          <motion.div
            key="style"
            className="w-full max-w-md"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <button
              onClick={() => { setStep('client'); setPickedClientId(null) }}
              className="flex items-center gap-1 text-[10px] text-text-dim hover:text-text-muted transition-colors cursor-pointer mb-4"
            >
              <ArrowLeft size={10} />
              Back
            </button>

            <h1 className="font-display font-bold text-xl tracking-tight text-text text-center mb-2">
              What style of edit?
            </h1>
            <p className="text-text-dim text-xs text-center mb-8">
              {pickedClientName} has {editStyles.length} edit styles. Pick the one for this project.
            </p>

            <div className="space-y-1.5 mb-6">
              {editStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleSelectStyle(style.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-border-active hover:bg-surface-hover text-left transition-all duration-200 cursor-pointer group"
                >
                  <div className="size-8 rounded-lg bg-surface-active/60 flex items-center justify-center shrink-0">
                    <Film size={14} className="text-text-dim/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-text-muted group-hover:text-text block truncate">
                      {style.name}
                    </span>
                    <span className="text-[10px] text-text-dim block truncate">
                      {[style.defaultPacing, style.defaultMood, style.gradingLook].filter(Boolean).join(' · ') || 'Default settings'}
                    </span>
                  </div>
                  {style.isDefault && (
                    <span className="text-[9px] text-accent/60 font-medium uppercase tracking-wider">Default</span>
                  )}
                  <ArrowRight size={14} className="text-text-dim/0 group-hover:text-text-dim transition-colors" />
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setSelectedClientId(pickedClientId)
                setSelectedEditStyleId(null)
                setBriefPhase('braindump')
              }}
              className="w-full text-center text-[11px] text-text-dim/50 hover:text-text-dim transition-colors cursor-pointer py-2"
            >
              Skip — use global client settings only
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
