import { useState, useEffect, useCallback } from 'react'
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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Settings</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text">
              <Key size={14} />
              Anthropic API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
              placeholder="sk-ant-..."
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text font-mono placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-text-dim">
              Required for chat, grading commands, and clip analysis descriptions.
              Your key stays on your machine.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-accent">
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim() || apiKey.includes('•')}
            className="w-full flex items-center justify-center gap-2 bg-accent rounded-lg py-2.5 px-4 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {saved ? (
              <>
                <Check size={14} />
                Saved
              </>
            ) : (
              <>
                <Save size={14} />
                {saving ? 'Saving...' : 'Save'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
