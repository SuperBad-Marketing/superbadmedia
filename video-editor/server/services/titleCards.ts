export interface TitleCardPreset {
  id: string
  name: string
  type: 'title' | 'lower-third' | 'end-card' | 'chapter' | 'quote'
  description: string
  hasAnimation: boolean
}

export interface TitleCardRequest {
  presetId: string
  text: string
  subtext?: string
  duration: number
  position?: 'center' | 'bottom-left' | 'bottom-center' | 'top-left' | 'custom'
  font?: string
  insertAt: number
}

const PRESETS: TitleCardPreset[] = [
  { id: 'title-cinematic', name: 'Cinematic Title', type: 'title', description: 'Centered title with subtle fade-up', hasAnimation: true },
  { id: 'title-bold', name: 'Bold Title', type: 'title', description: 'Large bold title with slam entrance', hasAnimation: true },
  { id: 'title-minimal', name: 'Minimal Title', type: 'title', description: 'Clean thin-weight centered title', hasAnimation: true },
  { id: 'title-editorial', name: 'Editorial Title', type: 'title', description: 'Serif font with line accent', hasAnimation: true },
  { id: 'lt-standard', name: 'Standard Lower Third', type: 'lower-third', description: 'Name and title with accent bar', hasAnimation: true },
  { id: 'lt-minimal', name: 'Minimal Lower Third', type: 'lower-third', description: 'Simple text, no background', hasAnimation: true },
  { id: 'lt-box', name: 'Box Lower Third', type: 'lower-third', description: 'Text in solid accent box', hasAnimation: true },
  { id: 'lt-split', name: 'Split Lower Third', type: 'lower-third', description: 'Two-tone split bar design', hasAnimation: true },
  { id: 'end-simple', name: 'Simple End Card', type: 'end-card', description: 'Logo and text fade in', hasAnimation: true },
  { id: 'end-cta', name: 'CTA End Card', type: 'end-card', description: 'Call-to-action with URL', hasAnimation: true },
  { id: 'chapter-line', name: 'Chapter Break', type: 'chapter', description: 'Number and title with horizontal line', hasAnimation: true },
  { id: 'chapter-full', name: 'Full Chapter Card', type: 'chapter', description: 'Full-screen chapter title', hasAnimation: true },
  { id: 'quote-serif', name: 'Quote Card', type: 'quote', description: 'Serif quote with attribution', hasAnimation: true },
  { id: 'quote-bold', name: 'Bold Quote', type: 'quote', description: 'Large bold quote, dramatic', hasAnimation: true },
]

export class TitleCardService {
  getPresets(): TitleCardPreset[] {
    return PRESETS
  }

  getPresetsByType(type: string): TitleCardPreset[] {
    return PRESETS.filter((p) => p.type === type)
  }

  generateFusionScript(request: TitleCardRequest): string {
    const preset = PRESETS.find((p) => p.id === request.presetId)
    const name = preset?.name || 'Custom'

    return `-- Fusion Title Card: ${name}
-- Text: "${request.text}"
-- Duration: ${request.duration}s
-- Insert at: ${request.insertAt}s
{
  Tools = ordered() {
    Background = Background {
      Inputs = {
        Width = Input { Value = 1920 },
        Height = Input { Value = 1080 },
        TopLeftAlpha = Input { Value = 0 },
      },
    },
    TitleText = TextPlus {
      Inputs = {
        StyledText = Input { Value = "${request.text.replace(/"/g, '\\"')}" },
        Font = Input { Value = "${request.font || 'Open Sans'}" },
        Size = Input { Value = ${request.presetId.startsWith('lt-') ? 0.04 : 0.08} },
        Center = Input { Value = { ${
          request.position === 'bottom-left' ? '0.15, 0.12' :
          request.position === 'bottom-center' ? '0.5, 0.12' :
          request.position === 'top-left' ? '0.15, 0.88' :
          '0.5, 0.5'
        } } },
      },
    },
    ${request.subtext ? `SubText = TextPlus {
      Inputs = {
        StyledText = Input { Value = "${request.subtext.replace(/"/g, '\\"')}" },
        Font = Input { Value = "${request.font || 'Open Sans'}" },
        Size = Input { Value = 0.03 },
      },
    },` : ''}
    Merge = Merge {
      Inputs = {
        Foreground = Input { Source = "TitleText" },
        Background = Input { Source = "Background" },
      },
    },
  }
}`
  }
}
