import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { Play, Pause, SkipBack, SkipForward, Camera, Volume2, VolumeX, Film } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { thumbUrl } from '../../lib/thumbUrl'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function PreviewView() {
  const clips = useAppStore((s) => s.clips)
  const storyboardClips = useAppStore((s) => s.storyboardClips)
  const selectedTrack = useAppStore((s) => s.selectedTrack)

  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [musicMuted, setMusicMuted] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.7)
  const [activeBuffer, setActiveBuffer] = useState<'a' | 'b'>('a')

  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playingRef = useRef(false)
  const preloadedIndexRef = useRef<number>(-1)
  const pendingSwapRef = useRef(false)

  const hasStoryboard = storyboardClips.length > 0

  const timeline = useMemo(() => {
    if (!hasStoryboard) return []
    let offset = 0
    return storyboardClips.map((sc) => {
      const clipDuration = sc.endTime - sc.startTime
      const entry = {
        storyboardClip: sc,
        editStart: offset,
        editEnd: offset + clipDuration,
        clipDuration,
      }
      offset += clipDuration
      return entry
    })
  }, [storyboardClips, hasStoryboard])

  const totalDuration = useMemo(
    () => timeline.length > 0 ? timeline[timeline.length - 1].editEnd : 0,
    [timeline],
  )

  const currentEntry = timeline[currentClipIndex]
  const previewClips = hasStoryboard ? storyboardClips.map((sc) => sc.clip) : clips
  const currentClip = hasStoryboard ? currentEntry?.storyboardClip.clip : previewClips[currentClipIndex]

  const activeVideo = activeBuffer === 'a' ? videoRefA.current : videoRefB.current
  const standbyVideo = activeBuffer === 'a' ? videoRefB.current : videoRefA.current

  const globalTime = useMemo(() => {
    if (!hasStoryboard || !currentEntry) return currentTime
    return currentEntry.editStart + (currentTime - currentEntry.storyboardClip.startTime)
  }, [hasStoryboard, currentEntry, currentTime])

  const preloadNextClip = useCallback((nextIndex: number) => {
    if (!hasStoryboard || nextIndex >= timeline.length || nextIndex < 0) return
    if (preloadedIndexRef.current === nextIndex) return

    const nextEntry = timeline[nextIndex]
    if (!nextEntry) return

    const video = standbyVideo
    if (!video) return

    const nextClip = nextEntry.storyboardClip.clip
    const src = `/media/stream?path=${encodeURIComponent(nextClip.filePath)}`

    if (video.src !== new URL(src, window.location.origin).href) {
      video.src = src
    }

    const onReady = () => {
      video.currentTime = nextEntry.storyboardClip.startTime
      preloadedIndexRef.current = nextIndex
      video.removeEventListener('loadedmetadata', onReady)
    }

    if (video.readyState >= 1) {
      video.currentTime = nextEntry.storyboardClip.startTime
      preloadedIndexRef.current = nextIndex
    } else {
      video.addEventListener('loadedmetadata', onReady)
      video.load()
    }
  }, [hasStoryboard, timeline, standbyVideo])

  const swapToNextClip = useCallback(() => {
    const video = standbyVideo
    if (!video || pendingSwapRef.current) return

    pendingSwapRef.current = true

    if (activeVideo) {
      activeVideo.pause()
    }

    if (playingRef.current) {
      video.play().then(() => {
        pendingSwapRef.current = false
      }).catch(() => {
        pendingSwapRef.current = false
      })
    } else {
      pendingSwapRef.current = false
    }

    setActiveBuffer(prev => prev === 'a' ? 'b' : 'a')
  }, [activeVideo, standbyVideo])

  // Initial clip load (non-storyboard or first clip)
  useEffect(() => {
    const video = activeVideo
    if (!video || !currentClip) return

    const src = `/media/stream?path=${encodeURIComponent(currentClip.filePath)}`
    if (video.src === new URL(src, window.location.origin).href) {
      if (hasStoryboard && currentEntry) {
        video.currentTime = currentEntry.storyboardClip.startTime
      }
      if (playingRef.current) video.play().catch(() => {})
      return
    }

    video.src = src

    const onLoaded = () => {
      if (hasStoryboard && currentEntry) {
        video.currentTime = currentEntry.storyboardClip.startTime
      } else {
        video.currentTime = 0
      }
      if (playingRef.current) {
        video.play().catch(() => {})
      }
    }

    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [currentClipIndex, currentClip, hasStoryboard, currentEntry, activeBuffer])

  // Preload next clip when current clip starts playing
  useEffect(() => {
    if (hasStoryboard && currentClipIndex < timeline.length - 1) {
      preloadNextClip(currentClipIndex + 1)
    }
  }, [currentClipIndex, hasStoryboard, timeline.length, preloadNextClip])

  const handleTimeUpdate = useCallback(() => {
    const video = activeVideo
    if (!video) return
    setCurrentTime(video.currentTime)

    if (hasStoryboard && currentEntry) {
      if (video.currentTime >= currentEntry.storyboardClip.endTime - 0.05) {
        if (currentClipIndex < timeline.length - 1) {
          const nextIndex = currentClipIndex + 1
          if (preloadedIndexRef.current === nextIndex) {
            setCurrentClipIndex(nextIndex)
            swapToNextClip()
            preloadedIndexRef.current = -1
          } else {
            setCurrentClipIndex(nextIndex)
          }
        } else {
          video.pause()
          playingRef.current = false
          setIsPlaying(false)
          if (audioRef.current) audioRef.current.pause()
        }
      }
    }
  }, [hasStoryboard, currentEntry, currentClipIndex, timeline.length, activeVideo, swapToNextClip])

  const togglePlay = useCallback(() => {
    const video = activeVideo
    if (!video) return

    if (isPlaying) {
      video.pause()
      playingRef.current = false
      if (audioRef.current) audioRef.current.pause()
    } else {
      video.play().catch(() => {})
      playingRef.current = true
      if (audioRef.current && !musicMuted) {
        audioRef.current.currentTime = globalTime
        audioRef.current.play().catch(() => {})
      }
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, musicMuted, globalTime, activeVideo])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = musicMuted ? 0 : musicVolume
  }, [musicMuted, musicVolume])

  const handleSeekGlobal = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value)

    if (!hasStoryboard) {
      const video = activeVideo
      if (video) {
        video.currentTime = seekTime
        setCurrentTime(seekTime)
      }
      return
    }

    const targetEntry = timeline.findIndex((t) => seekTime >= t.editStart && seekTime < t.editEnd)
    const idx = targetEntry >= 0 ? targetEntry : timeline.length - 1
    const entry = timeline[idx]
    if (!entry) return

    const clipTime = entry.storyboardClip.startTime + (seekTime - entry.editStart)

    if (idx !== currentClipIndex) {
      setCurrentClipIndex(idx)
      preloadedIndexRef.current = -1
      setTimeout(() => {
        const video = activeVideo
        if (video) {
          video.currentTime = clipTime
          setCurrentTime(clipTime)
        }
      }, 100)
    } else {
      const video = activeVideo
      if (video) {
        video.currentTime = clipTime
        setCurrentTime(clipTime)
      }
    }

    if (audioRef.current) {
      audioRef.current.currentTime = seekTime
    }
  }, [hasStoryboard, timeline, currentClipIndex, activeVideo])

  const handlePrev = useCallback(() => {
    preloadedIndexRef.current = -1
    setCurrentClipIndex((i) => Math.max(0, i - 1))
  }, [])

  const handleNext = useCallback(() => {
    preloadedIndexRef.current = -1
    const max = hasStoryboard ? storyboardClips.length - 1 : previewClips.length - 1
    setCurrentClipIndex((i) => Math.min(max, i + 1))
  }, [hasStoryboard, storyboardClips.length, previewClips.length])

  const handleEnded = useCallback(() => {
    if (!hasStoryboard) {
      setIsPlaying(false)
      playingRef.current = false
    }
  }, [hasStoryboard])

  const handleGrabFrame = useCallback(() => {
    const video = activeVideo
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
  }, [currentClip, currentTime, activeVideo])

  const clipCount = hasStoryboard ? storyboardClips.length : previewClips.length
  const scrubMax = hasStoryboard ? totalDuration : (activeVideo?.duration || 0)
  const scrubValue = hasStoryboard ? globalTime : currentTime

  if (clipCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="size-16 rounded-2xl bg-surface-active/40 flex items-center justify-center mb-8">
            <Film size={28} className="text-text-dim/40" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
            Preview
          </h2>
          <p className="text-text-dim text-sm text-center text-pretty max-w-xs">
            Build a storyboard first, then come here to watch it back.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Video canvas — double-buffered */}
      <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
        <video
          ref={videoRefA}
          className={`max-w-full max-h-full absolute inset-0 m-auto ${activeBuffer === 'a' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}
          onTimeUpdate={activeBuffer === 'a' ? handleTimeUpdate : undefined}
          onEnded={activeBuffer === 'a' ? handleEnded : undefined}
          preload="auto"
        />
        <video
          ref={videoRefB}
          className={`max-w-full max-h-full absolute inset-0 m-auto ${activeBuffer === 'b' ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}
          onTimeUpdate={activeBuffer === 'b' ? handleTimeUpdate : undefined}
          onEnded={activeBuffer === 'b' ? handleEnded : undefined}
          preload="auto"
        />

        {!currentClip?.filePath && (
          <div className="text-text-dim text-[11px] z-20">No preview available</div>
        )}

        {/* Music audio element */}
        {selectedTrack?.previewUrl && (
          <audio ref={audioRef} src={selectedTrack.previewUrl} loop preload="auto" />
        )}

        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          <button
            onClick={handleGrabFrame}
            className="p-1.5 bg-surface-active/80 rounded-lg hover:bg-surface-raised transition-colors duration-150"
            title="Grab frame"
            aria-label="Grab frame"
          >
            <Camera size={13} className="text-text-muted" />
          </button>
        </div>

        {currentClip && (
          <div className="absolute bottom-3 left-3 bg-surface-active/80 rounded-lg px-2.5 py-1 z-20">
            <span className="text-[10px] text-text font-mono tabular-nums">
              {currentClip.fileName}
            </span>
          </div>
        )}
      </div>

      {/* Timeline strip for storyboard mode */}
      {hasStoryboard && totalDuration > 0 && (
        <div className="px-5 pt-2 pb-0">
          <div className="flex h-6 rounded-md overflow-hidden">
            {timeline.map((entry, i) => {
              const widthPercent = (entry.clipDuration / totalDuration) * 100
              return (
                <button
                  key={entry.storyboardClip.id}
                  onClick={() => {
                    preloadedIndexRef.current = -1
                    setCurrentClipIndex(i)
                  }}
                  className={`h-full overflow-hidden relative transition-opacity duration-150 ${
                    i === currentClipIndex ? 'ring-1 ring-text ring-inset' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ width: `${widthPercent}%` }}
                  title={`${entry.storyboardClip.clip.fileName} (${entry.clipDuration.toFixed(1)}s)`}
                >
                  {entry.storyboardClip.clip.thumbnailPath ? (
                    <img
                      src={thumbUrl(entry.storyboardClip.clip.thumbnailPath)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-active" />
                  )}
                  {entry.clipDuration >= 1 && (
                    <span className="absolute bottom-0 left-0.5 text-[7px] text-white/70 font-mono tabular-nums">
                      {entry.clipDuration.toFixed(1)}s
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Scrubber */}
      <div className="px-5 py-2">
        <input
          type="range"
          min={0}
          max={scrubMax || 1}
          step={0.01}
          value={scrubValue}
          onChange={handleSeekGlobal}
          className="w-full h-1 appearance-none bg-surface-active rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text"
        />
      </div>

      {/* Transport controls */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="p-1.5 text-text-dim hover:text-text transition-colors duration-150 rounded-lg hover:bg-surface-hover">
            <SkipBack size={14} />
          </button>
          <button
            onClick={togglePlay}
            className="size-7 rounded-full bg-surface-active flex items-center justify-center hover:bg-surface-raised transition-colors duration-150"
          >
            {isPlaying ? <Pause size={12} className="text-text" /> : <Play size={12} className="text-text ml-0.5" />}
          </button>
          <button onClick={handleNext} className="p-1.5 text-text-dim hover:text-text transition-colors duration-150 rounded-lg hover:bg-surface-hover">
            <SkipForward size={14} />
          </button>

          <span className="font-mono text-[10px] text-text-dim tabular-nums">
            {formatTime(hasStoryboard ? globalTime : currentTime)} / {formatTime(hasStoryboard ? totalDuration : (activeVideo?.duration || 0))}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Music controls */}
          {selectedTrack && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMusicMuted(!musicMuted)}
                className="p-1 text-text-dim hover:text-text transition-colors duration-150"
                aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
              >
                {musicMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={musicMuted ? 0 : musicVolume}
                onChange={(e) => {
                  setMusicVolume(Number(e.target.value))
                  setMusicMuted(false)
                }}
                className="w-14 h-0.5 appearance-none bg-surface-active rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-muted"
              />
              <span className="text-[9px] text-text-dim truncate max-w-[80px]">{selectedTrack.title}</span>
            </div>
          )}

          <span className="text-[11px] text-text-dim font-mono tabular-nums">
            {currentClipIndex + 1}/{clipCount}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
