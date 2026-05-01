import { motion } from 'motion/react'
import { Type, LayoutGrid } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export default function TextTitlesView() {
  const storyboardClips = useAppStore((s) => s.storyboardClips)

  return (
    <div className="flex-1 flex flex-col items-center justify-center select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center max-w-sm"
      >
        <div className="size-16 rounded-2xl bg-surface-active/40 flex items-center justify-center mb-8">
          <Type size={28} className="text-text-dim/40" />
        </div>
        <h2 className="font-display font-bold text-xl tracking-tight text-text mb-3">
          Text & Titles
        </h2>
        <p className="text-text-dim text-sm text-center text-pretty mb-6">
          Add title cards, lower thirds, and text overlays to your edit. Use the Text dock panel
          to browse presets and place them on your timeline.
        </p>

        <div className="w-full space-y-2">
          <button
            onClick={() => useAppStore.getState().toggleDockPanel('text')}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-surface-active/40 hover:bg-surface-active/60 text-text-muted hover:text-text text-[11px] font-medium transition-all duration-200 cursor-pointer"
          >
            <LayoutGrid size={13} />
            Open Title Card presets
          </button>
        </div>

        {storyboardClips.length > 0 && (
          <p className="text-[10px] text-text-dim mt-6 text-center">
            Title cards will be applied to your {storyboardClips.length}-clip assembly when exported via Resolve.
          </p>
        )}
      </motion.div>
    </div>
  )
}
