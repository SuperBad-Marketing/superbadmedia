import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Camera, Image } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function PreviewView() {
  const clips = useAppStore((s) => s.clips)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showGrade, setShowGrade] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const previewClips = storyboardClips.length > 0
    ? storyboardClips.map((sc) => sc.clip)
    : clips

  const currentClip = previewClips[currentClipIndex]

  useEffect(() => {
    setCurrentTime(0)
    setIsPlaying(false)
  }, [currentClipIndex])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration)
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const time = Number(e.target.value)
    video.currentTime = time
    setCurrentTime(time)
  }, [])

  const handlePrev = useCallback(() => {
    setCurrentClipIndex((i) => Math.max(0, i - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentClipIndex((i) => Math.min(previewClips.length - 1, i + 1))
  }, [previewClips.length])

  const handleGrabFrame = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const link = document.createElement('a')
    link.download = `frame-${currentClip?.fileName || 'grab'}-${formatTime(currentTime)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [currentClip, currentTime])

  if (previewClips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="size-20 rounded-2xl bg-surface-active flex items-center justify-center">
          <Play size={32} className="text-text-dim ml-1" />
        </div>
        <h2 className="font-display text-3xl font-bold text-text">Preview</h2>
        <p className="text-text-muted text-base text-pretty text-center max-w-sm">Import footage or build a storyboard to preview clips here</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
        {currentClip?.filePath ? (
          <video
            ref={videoRef}
            src={`file://${currentClip.filePath}`}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="text-text-dim text-sm">No preview available</div>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={() => setShowGrade(!showGrade)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors duration-150 ${
              showGrade ? 'bg-accent text-white' : 'bg-surface/80 text-text-muted hover:text-text'
            }`}
          >
            {showGrade ? 'Graded' : 'Original'}
          </button>
          <button
            onClick={handleGrabFrame}
            className="p-1.5 bg-surface/80 rounded hover:bg-surface transition-colors duration-150"
            title="Grab frame"
            aria-label="Grab frame"
          >
            <Camera size={13} className="text-text-muted" />
          </button>
        </div>

        {currentClip && (
          <div className="absolute bottom-3 left-3 bg-surface/80 rounded px-2 py-1">
            <span className="text-[11px] text-text font-mono">
              {currentClip.fileName}
            </span>
          </div>
        )}
      </div>

      <div className="px-8 py-2">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 appearance-none bg-surface-active rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
      </div>

      <div className="h-14 shrink-0 px-8 flex items-center justify-between border-t border-border">
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="p-1.5 text-text-dim hover:text-text transition-colors duration-150">
            <SkipBack size={15} />
          </button>
          <button
            onClick={togglePlay}
            className="size-8 rounded-full bg-accent-dim flex items-center justify-center hover:bg-accent/30 transition-colors duration-150"
          >
            {isPlaying ? <Pause size={13} className="text-accent" /> : <Play size={13} className="text-accent ml-0.5" />}
          </button>
          <button onClick={handleNext} className="p-1.5 text-text-dim hover:text-text transition-colors duration-150">
            <SkipForward size={15} />
          </button>

          <span className="font-mono text-[11px] text-text-dim tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted font-mono tabular-nums">
            {currentClipIndex + 1}/{previewClips.length}
          </span>

          <div className="flex gap-1 overflow-x-auto max-w-[300px]">
            {previewClips.map((clip, i) => (
              <button
                key={clip.id}
                onClick={() => setCurrentClipIndex(i)}
                className={`w-12 h-8 rounded border shrink-0 overflow-hidden transition-colors duration-150 ${
                  i === currentClipIndex
                    ? 'border-accent ring-1 ring-accent/30'
                    : 'border-border hover:border-border-active'
                }`}
              >
                {clip.thumbnailPath ? (
                  <img src={clip.thumbnailPath} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-bg flex items-center justify-center">
                    <Image size={9} className="text-text-dim" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
