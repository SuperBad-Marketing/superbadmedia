import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Key, Save, Check, AlertCircle, Cloud, Volume2, Monitor } from 'lucide-react'
import { getSettings, saveSettings } from '../../lib/api'

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
]

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
              const allConfigured = s.fields.every((f) => configured[f.key])
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
          <p className="text-[10px] text-text-dim leading-relaxed">
            {section.description}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
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
            </motion.div>
          </AnimatePresence>

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
        </div>
      </motion.div>
    </div>
  )
}
