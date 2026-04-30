import { useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Play, Pause, Plus, ArrowRight, Loader2, X, Zap } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve } from '../../lib/api'
import StoryboardClipCard from './StoryboardClipCard'

const TRANSITION_PRESETS = [
  { id: 'cut', name: 'Cut' },
  { id: 'dissolve-soft', name: 'Dissolve' },
  { id: 'impact-shake', name: 'Impact' },
  { id: 'wipe-whip', name: 'Whip Pan' },
  { id: 'zoom-blur-in', name: 'Zoom Blur' },
  { id: 'dissolve-light-leak', name: 'Light Leak' },
  { id: 'glitch-digital', name: 'Glitch' },
  { id: 'film-grain', name: 'Film Grain' },
] as const

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function formatTotalDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s2 = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s2.toString().padStart(2, '0')}.${ms}`
}

function TransitionIndicator({ index }: { index: number }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const selectedPreset = selected ? TRANSITION_PRESETS.find((p) => p.id === selected) : null

  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0 relative">
      <div className="w-px h-8 bg-border" />
      <button
        onClick={() => setOpen(!open)}
        className={`size-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-150 ${
          selectedPreset
            ? 'bg-accent-dim border border-accent text-accent'
            : 'bg-surface-active border border-border text-text-dim hover:border-border-active hover:text-text-muted'
        }`}
        title={selectedPreset ? selectedPreset.name : 'Add transition'}
      >
        {selectedPreset ? (
          <span className="text-[9px] font-display font-bold">{selectedPreset.name.charAt(0)}</span>
        ) : (
          <Zap size={9} />
        )}
      </button>
      <div className="w-px h-8 bg-border" />

      {open && (
        <div className="absolute top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg p-1.5 min-w-[130px]">
          {TRANSITION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setSelected(preset.id === selected ? null : preset.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                preset.id === selected
                  ? 'bg-accent-dim text-accent font-medium'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WaveformBar({ height }: { height: number }) {
  return (
    <div
      className="w-0.5 bg-pink/40 rounded-full shrink-0"
      style={{ height: `${height}%` }}
    />
  )
}

function Waveform() {
  const rand = useMemo(() => seededRandom(42), [])
  const bars = useMemo(() => {
    return Array.from({ length: 90 }, () => 15 + rand() * 85)
  }, [rand])

  return (
    <div className="h-8 bg-bg rounded flex items-center gap-px px-1 overflow-hidden">
      {bars.map((h, i) => (
        <WaveformBar key={i} height={h} />
      ))}
    </div>
  )
}

export default function StoryboardView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const reorderStoryboardClip = useAppStore((s) => s.reorderStoryboardClip)
  const selectedTrack = useAppStore((s) => s.selectedTrack)
  const setSelectedTrack = useAppStore((s) => s.setSelectedTrack)
  const isPlaying = useAppStore((s) => s.isPlaying)
  const setIsPlaying = useAppStore((s) => s.setIsPlaying)
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab)
  const resolveConnected = useAppStore((s) => s.resolveConnected)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const [sending, setSending] = useState(false)

  const handleSendToResolve = useCallback(async () => {
    if (sending) return
    setSending(true)
    try {
      const filePaths = storyboardClips.map((c) => c.clip.filePath)
      const importResult = await sendToResolve('import_media', { file_paths: filePaths })

      if (importResult.error) {
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Failed to send to Resolve: ${importResult.error}`,
          timestamp: new Date().toISOString(),
        })
      } else {
        const clipIndices = filePaths.map((_, i) => i)
        await sendToResolve('create_timeline', { name: 'SuperEdits Assembly' })
        await sendToResolve('add_clips', { clip_indices: clipIndices })

        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Sent ${filePaths.length} clips to Resolve. Timeline "SuperEdits Assembly" created.`,
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Could not reach Resolve. Make sure it is running and connected.',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }, [sending, storyboardClips, addChatMessage])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const clipIds = useMemo(
    () => storyboardClips.map((c) => c.id),
    [storyboardClips]
  )

  const totalDuration = useMemo(
    () => storyboardClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0),
    [storyboardClips]
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = storyboardClips.findIndex((c) => c.id === active.id)
    const toIndex = storyboardClips.findIndex((c) => c.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderStoryboardClip(fromIndex, toIndex)
    }
  }

  if (storyboardClips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <h2 className="font-display text-3xl font-bold text-text">Build your story</h2>
        <p className="text-text-muted text-base text-center text-pretty max-w-sm">
          Add clips from the media browser or ask Claude to build a rough cut
        </p>
        {!selectedTrack && (
          <button
            onClick={() => setRightPanelTab('music')}
            className="flex items-center gap-1.5 text-pink text-base font-medium mt-2 hover:opacity-80 transition-opacity duration-150"
          >
            Choose your music first
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-20 shrink-0 px-5 pt-3.5 pb-2.5 flex flex-col gap-2">
        {selectedTrack ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-display font-semibold text-text">
                  {selectedTrack.title}
                </span>
                <span className="text-xs text-text-muted">
                  {selectedTrack.artist}
                </span>
                <span className="font-mono text-[10px] text-text-dim tabular-nums">
                  {selectedTrack.bpm} BPM
                </span>
              </div>
              <button
                onClick={() => setSelectedTrack(null)}
                className="text-text-dim text-[11px] hover:text-text-muted transition-colors duration-150"
              >
                Change track
              </button>
            </div>
            <Waveform />
          </>
        ) : (
          <div className="flex items-center justify-between h-full">
            <span className="text-sm text-text-dim">No music selected</span>
            <button
              onClick={() => setRightPanelTab('music')}
              className="text-pink text-[11px] font-medium hover:opacity-80 transition-opacity duration-150"
            >
              Browse music
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden border-y border-border">
        <div className="flex items-center gap-0 px-5 py-5 min-h-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
              {storyboardClips.map((clip, index) => (
                <div key={clip.id} className="flex items-center">
                  {index > 0 && <TransitionIndicator index={index} />}
                  <StoryboardClipCard storyboardClip={clip} index={index} />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          <div className="ml-2 w-32 min-w-32 h-28 border-2 border-dashed border-border rounded-lg flex items-center justify-center shrink-0 hover:border-border-active transition-colors duration-150 cursor-pointer">
            <Plus size={18} className="text-text-dim" />
          </div>
        </div>
      </div>

      <div className="h-14 shrink-0 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="size-8 rounded-full bg-accent-dim flex items-center justify-center hover:bg-accent/30 transition-colors duration-150"
          >
            {isPlaying ? (
              <Pause size={13} className="text-accent" />
            ) : (
              <Play size={13} className="text-accent ml-0.5" />
            )}
          </button>
          <span className="font-mono text-[11px] text-text-dim tabular-nums">
            {formatTotalDuration(totalDuration)}
          </span>
        </div>

        <button
          onClick={handleSendToResolve}
          disabled={sending || !resolveConnected}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-[13px] font-display font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {sending ? 'Sending...' : resolveConnected ? 'Send to Resolve' : 'Connect Resolve first'}
        </button>
      </div>
    </div>
  )
}
