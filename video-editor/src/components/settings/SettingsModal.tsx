import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { X, Key, Save, Check, AlertCircle } from 'lucide-react'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data.apiKeySet) setApiKey('sk-ant-•••••••••••••••••')
        })
        .catch(() => {})
    }
  }, [open])

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || apiKey.includes('•')) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [apiKey])

  if (!open) return null

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
        className="relative w-full max-w-md floating-panel rounded-2xl p-8 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-text tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-surface-hover transition-colors duration-150"
          >
            <X size={14} />
          </button>
        </div>

        {/* API Key section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] text-text-dim">
              <Key size={11} />
              Anthropic API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
              placeholder="sk-ant-..."
              className="w-full bg-surface-active/50 rounded-lg px-3 py-2 text-xs text-text font-mono placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-border-active transition-colors duration-150"
            />
            <p className="text-[10px] text-text-dim leading-relaxed">
              Required for chat, grading commands, and clip analysis descriptions.
              Your key stays on your machine.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-accent">
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim() || apiKey.includes('•')}
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
