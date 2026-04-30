export interface TransitionPreset {
  id: string
  name: string
  category: 'impact' | 'dissolve' | 'wipe' | 'zoom' | 'film' | 'glitch'
  description: string
  duration: number
  hasSfx: boolean
}

const PRESETS: TransitionPreset[] = [
  { id: 'impact-shake', name: 'Camera Shake Impact', category: 'impact', description: 'Hard camera shake with bass hit', duration: 0.5, hasSfx: true },
  { id: 'impact-punch', name: 'Punch In', category: 'impact', description: 'Quick zoom punch with whoosh', duration: 0.4, hasSfx: true },
  { id: 'impact-flash', name: 'Flash Impact', category: 'impact', description: 'White flash with boom', duration: 0.3, hasSfx: true },
  { id: 'dissolve-soft', name: 'Soft Dissolve', category: 'dissolve', description: 'Gentle crossfade', duration: 1.0, hasSfx: false },
  { id: 'dissolve-light-leak', name: 'Light Leak Dissolve', category: 'dissolve', description: 'Warm light leak crossfade', duration: 1.2, hasSfx: false },
  { id: 'dissolve-film-burn', name: 'Film Burn Dissolve', category: 'dissolve', description: 'Analog film burn transition', duration: 1.0, hasSfx: true },
  { id: 'dissolve-additive', name: 'Additive Dissolve', category: 'dissolve', description: 'Brightens as it crossfades', duration: 0.8, hasSfx: false },
  { id: 'wipe-horizontal', name: 'Horizontal Wipe', category: 'wipe', description: 'Clean horizontal wipe', duration: 0.6, hasSfx: true },
  { id: 'wipe-vertical', name: 'Vertical Wipe', category: 'wipe', description: 'Vertical wipe with soft edge', duration: 0.6, hasSfx: true },
  { id: 'wipe-diagonal', name: 'Diagonal Wipe', category: 'wipe', description: 'Diagonal reveal', duration: 0.7, hasSfx: true },
  { id: 'wipe-whip', name: 'Whip Pan', category: 'wipe', description: 'Fast whip pan with motion blur', duration: 0.4, hasSfx: true },
  { id: 'zoom-blur-in', name: 'Zoom Blur In', category: 'zoom', description: 'Radial zoom blur into next shot', duration: 0.5, hasSfx: true },
  { id: 'zoom-blur-out', name: 'Zoom Blur Out', category: 'zoom', description: 'Zoom out blur transition', duration: 0.5, hasSfx: true },
  { id: 'zoom-push', name: 'Push Zoom', category: 'zoom', description: 'Smooth push zoom through', duration: 0.6, hasSfx: false },
  { id: 'film-grain', name: 'Film Grain Flash', category: 'film', description: 'Grain overlay flash cut', duration: 0.3, hasSfx: true },
  { id: 'film-vhs', name: 'VHS Glitch', category: 'film', description: 'VHS tracking lines transition', duration: 0.5, hasSfx: true },
  { id: 'film-flicker', name: 'Film Flicker', category: 'film', description: 'Old projector flicker', duration: 0.6, hasSfx: true },
  { id: 'film-sprocket', name: 'Sprocket Hole', category: 'film', description: 'Film strip sprocket pass', duration: 0.8, hasSfx: true },
  { id: 'glitch-digital', name: 'Digital Glitch', category: 'glitch', description: 'Pixel corruption glitch', duration: 0.4, hasSfx: true },
  { id: 'glitch-rgb', name: 'RGB Split', category: 'glitch', description: 'RGB channel split and recombine', duration: 0.5, hasSfx: true },
  { id: 'glitch-data-mosh', name: 'Data Mosh', category: 'glitch', description: 'Frame blending datamosh effect', duration: 0.6, hasSfx: true },
  { id: 'glitch-scanline', name: 'Scanline Wipe', category: 'glitch', description: 'CRT scanline reveal', duration: 0.5, hasSfx: true },
]

export class TransitionService {
  getPresets(): TransitionPreset[] {
    return PRESETS
  }

  getPresetsByCategory(category: string): TransitionPreset[] {
    return PRESETS.filter((p) => p.category === category)
  }

  getPreset(id: string): TransitionPreset | undefined {
    return PRESETS.find((p) => p.id === id)
  }

  generateFusionScript(preset: TransitionPreset, clipAEnd: number, clipBStart: number): string {
    return `-- Fusion Transition: ${preset.name}
-- Duration: ${preset.duration}s
-- Category: ${preset.category}
-- Applied at: ${clipAEnd}s → ${clipBStart}s
{
  Tools = ordered() {
    TransitionMerge = Merge {
      Inputs = {
        Foreground = Input { Source = "ClipB" },
        Background = Input { Source = "ClipA" },
        PerformDepthMerge = Input { Value = 0 },
        Blend = Input {
          Value = 1,
          Expression = "iif(time < ${clipAEnd}, 0, iif(time > ${clipBStart}, 1, (time - ${clipAEnd}) / ${preset.duration}))"
        },
      },
    },
  }
}`
  }
}
