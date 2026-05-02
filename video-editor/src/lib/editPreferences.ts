import type { EditPreferences } from '../types'

export const DEFAULT_PREFERENCES: EditPreferences = {
  zoom: { enabled: true, intensity: 'standard', frequency: 'some' },
  slowMo: { enabled: true, speed: 50, autoDetect: true },
  stabilisation: { enabled: true, mode: 'perspective', applyTo: 'shaky-only' },
  grading: { enabled: true, look: 'natural', consistency: 'match-cameras' },
  transitions: { enabled: true, style: 'subtle', density: 'moderate' },
  sfx: { enabled: true, density: 'accent', categories: ['impact', 'whoosh', 'riser'] },
  musicSync: { enabled: true, tightness: 'on-beat' },
  titles: { enabled: true, usage: 'minimal', templates: [] },
  motionGraphics: { enabled: false, templates: [] },
  source: 'manual',
}

export function preferencesToPromptContext(prefs: EditPreferences): string {
  const lines: string[] = ['## EDIT PREFERENCES (user-configured)\n']

  if (prefs.zoom.enabled) {
    lines.push(`- **Ken Burns / Dynamic Zoom**: ON — ${prefs.zoom.intensity} intensity, apply to ${prefs.zoom.frequency === 'few' ? '~15%' : prefs.zoom.frequency === 'some' ? '~30%' : '~50%'} of static shots`)
  } else {
    lines.push('- **Ken Burns / Dynamic Zoom**: OFF — do not add any zoom movement')
  }

  if (prefs.slowMo.enabled) {
    lines.push(`- **Slow Motion**: ON — ${prefs.slowMo.speed}% speed, ${prefs.slowMo.autoDetect ? 'auto-detect peak moments' : 'user will specify clips'}`)
  } else {
    lines.push('- **Slow Motion**: OFF — keep all clips at normal speed')
  }

  if (prefs.stabilisation.enabled) {
    lines.push(`- **Stabilisation**: ON — ${prefs.stabilisation.mode} mode, apply to ${prefs.stabilisation.applyTo === 'shaky-only' ? 'shaky clips only' : 'all clips'}`)
  } else {
    lines.push('- **Stabilisation**: OFF — keep original camera movement')
  }

  if (prefs.grading.enabled) {
    lines.push(`- **Colour Grading**: ON — ${prefs.grading.look} look, ${prefs.grading.consistency === 'match-cameras' ? 'match all cameras to a consistent look' : 'embrace the natural variety between cameras'}`)
  } else {
    lines.push('- **Colour Grading**: OFF — leave colour as-is')
  }

  if (prefs.transitions.enabled) {
    lines.push(`- **Transitions**: ${prefs.transitions.style} style, ${prefs.transitions.density} density`)
    if (prefs.transitions.style === 'cuts-only') lines.push('  Use only hard cuts, no dissolves or effects transitions')
  } else {
    lines.push('- **Transitions**: OFF — hard cuts only')
  }

  if (prefs.sfx.enabled) {
    lines.push(`- **Sound Effects**: ${prefs.sfx.density} density — categories: ${prefs.sfx.categories.join(', ')}`)
  } else {
    lines.push('- **Sound Effects**: OFF — no SFX layering')
  }

  if (prefs.musicSync.enabled) {
    const desc = prefs.musicSync.tightness === 'tight' ? 'every cut on a beat or subdivision'
      : prefs.musicSync.tightness === 'on-beat' ? 'major cuts on beats, minor cuts can float'
      : 'music-aware but cuts prioritize content over rhythm'
    lines.push(`- **Music Sync**: ${desc}`)
  } else {
    lines.push('- **Music Sync**: OFF — cut for content, ignore beat grid')
  }

  if (prefs.titles.enabled) {
    lines.push(`- **Titles**: ${prefs.titles.usage} — ${prefs.titles.usage === 'minimal' ? 'opening title + optional end card only' : prefs.titles.usage === 'throughout' ? 'opening, lower thirds, location supers, end card' : 'no titles'}`)
  } else {
    lines.push('- **Titles**: OFF — no text overlays')
  }

  if (prefs.motionGraphics.enabled) {
    lines.push('- **Motion Graphics**: ON — kinetic text, CTAs, counters available')
  }

  lines.push('\nRespect these preferences strictly. Do not apply disabled features.')
  return lines.join('\n')
}
