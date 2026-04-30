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
import { Play, Pause, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { sendToResolve } from '../../lib/api'
import StoryboardClipCard from './StoryboardClipCard'

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

function TransitionIndicator() {
  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0">
      <div className="w-px h-8 bg-border" />
      <div className="w-5 h-5 rounded-full bg-surface-active border border-border flex items-center justify-center">
        <Plus size={10} className="text-text-dim" />
      </div>
      <div className="w-px h-8 bg-border" />
    </div>
  )
}

function WaveformBar({ height }: { height: number }) {
  return (
    <div
      className="w-0.5 bg-accent/40 rounded-full shrink-0"
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
    <div className="h-8 bg-surface-active rounded flex items-center gap-px px-1 overflow-hidden">
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
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <h2 className="text-2xl font-semibold text-text">Build your story</h2>
        <p className="text-text-muted text-sm text-center max-w-sm">
          Add clips from the media browser or ask Claude to build a rough cut
        </p>
        {!selectedTrack && (
          <button
            onClick={() => setRightPanelTab('music')}
            className="flex items-center gap-1.5 text-accent text-sm font-medium mt-2 hover:underline"
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
      <div className="h-20 shrink-0 px-4 pt-3 pb-2 flex flex-col gap-1.5">
        {selectedTrack ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text">
                  {selectedTrack.title}
                </span>
                <span className="text-xs text-text-muted">
                  {selectedTrack.artist}
                </span>
                <span className="font-mono text-xs text-text-dim">
                  {selectedTrack.bpm} BPM
                </span>
              </div>
              <button
                onClick={() => setSelectedTrack(null)}
                className="text-text-dim text-xs hover:text-text-muted transition-colors"
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
              className="text-accent text-xs font-medium hover:underline"
            >
              Browse music
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden border-y border-border">
        <div className="flex items-center gap-0 px-4 py-4 min-h-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={clipIds} strategy={horizontalListSortingStrategy}>
              {storyboardClips.map((clip, index) => (
                <div key={clip.id} className="flex items-center">
                  {index > 0 && <TransitionIndicator />}
                  <StoryboardClipCard storyboardClip={clip} index={index} />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          <div className="ml-2 w-32 min-w-32 h-28 border-2 border-dashed border-border rounded-lg flex items-center justify-center shrink-0 hover:border-border-active transition-colors cursor-pointer">
            <Plus size={20} className="text-text-dim" />
          </div>
        </div>
      </div>

      <div className="h-12 shrink-0 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-surface-active flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            {isPlaying ? (
              <Pause size={14} className="text-text" />
            ) : (
              <Play size={14} className="text-text ml-0.5" />
            )}
          </button>
          <span className="font-mono text-xs text-text-dim">
            {formatTotalDuration(totalDuration)}
          </span>
        </div>

        <button
          onClick={handleSendToResolve}
          disabled={sending || !resolveConnected}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {sending ? 'Sending...' : resolveConnected ? 'Send to Resolve' : 'Connect Resolve first'}
        </button>
      </div>
    </div>
  )
}
