interface TemplateParams {
  text: string
  subtext?: string
  duration?: number
  fps?: number
  font?: string
  fontStyle?: string
  color?: { r: number; g: number; b: number }
  position?: 'center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

interface TemplatePreset {
  id: string
  name: string
  type: 'title' | 'lower-third' | 'end-card' | 'chapter' | 'quote' | 'location' | 'stat' | 'reveal' | 'kinetic-text' | 'cta' | 'social-bug' | 'animated-counter'
  description: string
  category: 'documentary' | 'editorial' | 'minimal' | 'cinematic' | 'social' | 'motion'
  generate: (params: TemplateParams) => string
}

function fadeSpline(name: string, fps: number, holdFrames: number, fadeIn = 12, fadeOut = 15): string {
  const fi = Math.round(fadeIn * fps / 24)
  const fo = Math.round(fadeOut * fps / 24)
  const holdEnd = fi + holdFrames
  const end = holdEnd + fo
  return `${name} = BezierSpline {
			SplineColor = { Red = 0, Green = 0.6, Blue = 0 },
			KeyFrames = {
				[0] = { 0, RH = { ${Math.round(fi * 0.33)}, 0.35 }, Flags = { Linear = false } },
				[${fi}] = { 1, LH = { ${Math.round(fi * 0.67)}, 0.65 }, RH = { ${fi + Math.round(holdFrames * 0.1)}, 1 } },
				[${holdEnd}] = { 1, LH = { ${holdEnd - Math.round(holdFrames * 0.1)}, 1 }, RH = { ${holdEnd + Math.round(fo * 0.33)}, 0.65 } },
				[${end}] = { 0, LH = { ${end - Math.round(fo * 0.33)}, 0.35 }, Flags = { Linear = false } },
			}
		}`
}

function driftSpline(name: string, fps: number, holdFrames: number, startY: number, endY: number, fadeIn = 12): string {
  const fi = Math.round(fadeIn * fps / 24)
  const holdEnd = fi + holdFrames
  return `${name} = PolyPath {
			DrawMode = "CatmullRomSpline",
			CtrlWZoom = false,
			Points = {
				[0] = { Linear = false, X = 0.5, Y = ${startY}, LX = 0.5, LY = ${startY}, RX = 0.5, RY = ${startY + (endY - startY) * 0.33} },
				[${fi}] = { Linear = false, X = 0.5, Y = ${endY}, LX = 0.5, LY = ${endY - (endY - startY) * 0.33}, RX = 0.5, RY = ${endY} },
				[${holdEnd}] = { Linear = true, X = 0.5, Y = ${endY} },
			}
		}`
}

function lineDrawSpline(name: string, fps: number, holdFrames: number, delay = 0): string {
  const delayF = Math.round(delay * fps / 24)
  const drawDuration = Math.round(18 * fps / 24)
  const drawEnd = delayF + drawDuration
  const holdEnd = Math.round(12 * fps / 24) + holdFrames
  const eraseEnd = holdEnd + drawDuration
  return `${name} = BezierSpline {
			SplineColor = { Red = 0.8, Green = 0.8, Blue = 0 },
			KeyFrames = {
				[${delayF}] = { 0, RH = { ${delayF + Math.round(drawDuration * 0.33)}, 0.3 } },
				[${drawEnd}] = { 1, LH = { ${drawEnd - Math.round(drawDuration * 0.33)}, 0.7 }, RH = { ${drawEnd + 10}, 1 } },
				[${holdEnd}] = { 1, LH = { ${holdEnd - 10}, 1 }, RH = { ${holdEnd + Math.round(drawDuration * 0.33)}, 0.7 } },
				[${eraseEnd}] = { 0, LH = { ${eraseEnd - Math.round(drawDuration * 0.33)}, 0.3 } },
			}
		}`
}

function staggeredFadeSpline(name: string, fps: number, holdFrames: number, delayFrames: number): string {
  const fi = Math.round(14 * fps / 24)
  const fo = Math.round(15 * fps / 24)
  const start = delayFrames
  const fadeInEnd = start + fi
  const holdEnd = fadeInEnd + holdFrames - delayFrames
  const end = holdEnd + fo
  return `${name} = BezierSpline {
			SplineColor = { Red = 0, Green = 0.4, Blue = 0.6 },
			KeyFrames = {
				[0] = { 0, Flags = { Linear = true } },
				[${start}] = { 0, RH = { ${start + Math.round(fi * 0.33)}, 0.3 } },
				[${fadeInEnd}] = { 1, LH = { ${fadeInEnd - Math.round(fi * 0.33)}, 0.7 }, RH = { ${fadeInEnd + 5}, 1 } },
				[${holdEnd}] = { 1, LH = { ${holdEnd - 5}, 1 }, RH = { ${holdEnd + Math.round(fo * 0.33)}, 0.65 } },
				[${end}] = { 0, LH = { ${end - Math.round(fo * 0.33)}, 0.35 } },
			}
		}`
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function positionCoords(position: string): { x: number; y: number } {
  switch (position) {
    case 'bottom-left': return { x: 0.18, y: 0.14 }
    case 'bottom-right': return { x: 0.82, y: 0.14 }
    case 'top-left': return { x: 0.18, y: 0.88 }
    case 'top-right': return { x: 0.82, y: 0.88 }
    default: return { x: 0.5, y: 0.5 }
  }
}

// ── Template generators ──

function docMainTitle(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 4
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Futura'
  const style = p.fontStyle || 'Medium'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const hasSubtext = !!p.subtext

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		Title = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text.toUpperCase())}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "${style}" },
				Size = Input { Value = 0.065 },
				Tracking = Input { Value = 0.18 },
				Center = Input {
					SourceOp = "TitleDrift",
					Source = "Value",
				},
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "TitleFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('TitleFade', fps, holdFrames)},
		${driftSpline('TitleDrift', fps, holdFrames, 0.485, 0.5)},
		${hasSubtext ? `Subtitle = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.subtext!)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.028 },
				Tracking = Input { Value = 0.12 },
				Center = Input { Value = { 0.5, 0.42 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "SubFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('SubFade', fps, holdFrames, Math.round(8 * fps / 24))},
		MergeSub = Merge {
			Inputs = {
				Foreground = Input { Source = "Subtitle" },
				Background = Input { Source = "Title" },
			},
		},` : ''}
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "${hasSubtext ? 'MergeSub' : 'Title'}" },
				Background = Input { Source = "BG" },
			},
		},
	},
}`
}

function docChapter(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 4
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const chapterLabel = p.subtext || 'CHAPTER ONE'

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		ChapterLabel = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(chapterLabel.toUpperCase())}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.022 },
				Tracking = Input { Value = 0.25 },
				Center = Input { Value = { 0.5, 0.56 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "LabelFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('LabelFade', fps, holdFrames, Math.round(4 * fps / 24))},
		ChapterTitle = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Medium" },
				Size = Input { Value = 0.055 },
				Tracking = Input { Value = 0.06 },
				Center = Input { Value = { 0.5, 0.47 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "TitleFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('TitleFade', fps, holdFrames, Math.round(10 * fps / 24))},
		Line = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 1 },
			},
		},
		LineMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "LineWidth",
					Source = "Value",
				},
				Height = Input { Value = 0.001 },
				Center = Input { Value = { 0.5, 0.515 } },
			},
		},
		${lineDrawSpline('LineWidth', fps, holdFrames)},
		LineMerge = Merge {
			EffectMask = Input { Source = "LineMask" },
			Inputs = {
				Foreground = Input { Source = "Line" },
				Background = Input { Source = "BG" },
			},
		},
		MergeLabel = Merge {
			Inputs = {
				Foreground = Input { Source = "ChapterLabel" },
				Background = Input { Source = "LineMerge" },
			},
		},
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "ChapterTitle" },
				Background = Input { Source = "MergeLabel" },
			},
		},
	},
}`
}

function docLowerThirdClean(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 5
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const role = p.subtext || ''

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		AccentLine = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.85 },
			},
		},
		AccentMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "AccentWidth",
					Source = "Value",
				},
				Height = Input { Value = 0.0015 },
				Center = Input { Value = { 0.18, 0.155 } },
			},
		},
		${lineDrawSpline('AccentWidth', fps, holdFrames)},
		NameText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Medium" },
				Size = Input { Value = 0.035 },
				Tracking = Input { Value = 0.04 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.18, 0.13 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "NameFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('NameFade', fps, holdFrames, Math.round(6 * fps / 24))},
		${role ? `RoleText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(role)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.022 },
				Tracking = Input { Value = 0.08 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.18, 0.098 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "RoleFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('RoleFade', fps, holdFrames, Math.round(12 * fps / 24))},
		MergeRole = Merge {
			Inputs = {
				Foreground = Input { Source = "RoleText" },
				Background = Input { Source = "NameText" },
			},
		},` : ''}
		MergeLine = Merge {
			EffectMask = Input { Source = "AccentMask" },
			Inputs = {
				Foreground = Input { Source = "AccentLine" },
				Background = Input { Source = "BG" },
			},
		},
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "${role ? 'MergeRole' : 'NameText'}" },
				Background = Input { Source = "MergeLine" },
			},
		},
	},
}`
}

function docLowerThirdBox(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 5
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const role = p.subtext || ''
  const boxHeight = role ? 0.075 : 0.05

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		Box = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = 0.08 },
				TopLeftGreen = Input { Value = 0.08 },
				TopLeftBlue = Input { Value = 0.08 },
				TopLeftAlpha = Input { Value = 0.75 },
			},
		},
		BoxMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "BoxWidth",
					Source = "Value",
				},
				Height = Input { Value = ${boxHeight} },
				Center = Input { Value = { 0.18, 0.12 } },
				SoftEdge = Input { Value = 0.002 },
			},
		},
		${lineDrawSpline('BoxWidth', fps, holdFrames)},
		NameText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Bold" },
				Size = Input { Value = 0.030 },
				Tracking = Input { Value = 0.03 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.18, ${role ? 0.135 : 0.12} } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "NameFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('NameFade', fps, holdFrames, Math.round(8 * fps / 24))},
		${role ? `RoleText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(role)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.020 },
				Tracking = Input { Value = 0.06 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.18, 0.103 } },
				Red1 = Input { Value = ${r * 0.85} },
				Green1 = Input { Value = ${g * 0.85} },
				Blue1 = Input { Value = ${b * 0.85} },
				Opacity1 = Input {
					SourceOp = "RoleFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('RoleFade', fps, holdFrames, Math.round(12 * fps / 24))},` : ''}
		MergeBox = Merge {
			EffectMask = Input { Source = "BoxMask" },
			Inputs = {
				Foreground = Input { Source = "Box" },
				Background = Input { Source = "BG" },
			},
		},
		MergeName = Merge {
			Inputs = {
				Foreground = Input { Source = "NameText" },
				Background = Input { Source = "MergeBox" },
			},
		},
		${role ? `MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "RoleText" },
				Background = Input { Source = "MergeName" },
			},
		},` : ''}
	},
}`
}

function docLocation(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 3.5
  const holdFrames = Math.round((dur - 1.2) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		LocationText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text.toUpperCase())}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.020 },
				Tracking = Input { Value = 0.22 },
				HorizontalJustificationNew = Input { Value = 2 },
				Center = Input {
					SourceOp = "LocDrift",
					Source = "Value",
				},
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "LocFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('LocFade', fps, holdFrames, 10, 12)},
		${driftSpline('LocDrift', fps, holdFrames, 0.095, 0.105)},
		${p.subtext ? `DetailText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.subtext)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.016 },
				Tracking = Input { Value = 0.15 },
				HorizontalJustificationNew = Input { Value = 2 },
				Center = Input { Value = { 0.82, 0.075 } },
				Red1 = Input { Value = ${r * 0.7} },
				Green1 = Input { Value = ${g * 0.7} },
				Blue1 = Input { Value = ${b * 0.7} },
				Opacity1 = Input {
					SourceOp = "DetailFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('DetailFade', fps, holdFrames, Math.round(6 * fps / 24))},
		MergeDetail = Merge {
			Inputs = {
				Foreground = Input { Source = "DetailText" },
				Background = Input { Source = "LocationText" },
			},
		},` : ''}
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "${p.subtext ? 'MergeDetail' : 'LocationText'}" },
				Background = Input { Source = "BG" },
			},
		},
	},
}`
}

function docQuote(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 5
  const holdFrames = Math.round((dur - 1.8) * fps)
  const font = p.font || 'Georgia'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const attribution = p.subtext || ''

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		QuoteMark = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "\\xe2\\x80\\x9c" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Italic" },
				Size = Input { Value = 0.2 },
				Center = Input { Value = { 0.5, 0.62 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "MarkFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('MarkFade', fps, holdFrames, 0)},
		QuoteText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Italic" },
				Size = Input { Value = 0.038 },
				Tracking = Input { Value = 0.02 },
				LineSpacingNew = Input { Value = 1.6 },
				Center = Input { Value = { 0.5, 0.5 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "QuoteFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('QuoteFade', fps, holdFrames, Math.round(6 * fps / 24))},
		${attribution ? `Attribution = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "\\xe2\\x80\\x94 ${esc(attribution.toUpperCase())}" },
				Font = Input { Value = "Futura" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.018 },
				Tracking = Input { Value = 0.2 },
				Center = Input { Value = { 0.5, 0.4 } },
				Red1 = Input { Value = ${r * 0.7} },
				Green1 = Input { Value = ${g * 0.7} },
				Blue1 = Input { Value = ${b * 0.7} },
				Opacity1 = Input {
					SourceOp = "AttrFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('AttrFade', fps, holdFrames, Math.round(14 * fps / 24))},` : ''}
		MergeQuote = Merge {
			Inputs = {
				Foreground = Input { Source = "QuoteText" },
				Background = Input { Source = "QuoteMark" },
			},
		},
		${attribution ? `MergeAttr = Merge {
			Inputs = {
				Foreground = Input { Source = "Attribution" },
				Background = Input { Source = "MergeQuote" },
			},
		},` : ''}
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "${attribution ? 'MergeAttr' : 'MergeQuote'}" },
				Background = Input { Source = "BG" },
			},
		},
	},
}`
}

function docStat(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 4
  const holdFrames = Math.round((dur - 1.4) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const label = p.subtext || ''

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		StatNumber = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Bold" },
				Size = Input { Value = 0.12 },
				Tracking = Input { Value = -0.02 },
				Center = Input { Value = { 0.5, 0.53 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "StatFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('StatFade', fps, holdFrames, 8, 12)},
		${label ? `StatLabel = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(label.toUpperCase())}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.020 },
				Tracking = Input { Value = 0.2 },
				Center = Input { Value = { 0.5, 0.435 } },
				Red1 = Input { Value = ${r * 0.8} },
				Green1 = Input { Value = ${g * 0.8} },
				Blue1 = Input { Value = ${b * 0.8} },
				Opacity1 = Input {
					SourceOp = "LabelFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('LabelFade', fps, holdFrames, Math.round(6 * fps / 24))},` : ''}
		Line = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.4 },
			},
		},
		LineMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "DividerWidth",
					Source = "Value",
				},
				Height = Input { Value = 0.001 },
				Center = Input { Value = { 0.5, 0.465 } },
			},
		},
		${lineDrawSpline('DividerWidth', fps, holdFrames, 4)},
		MergeLine = Merge {
			EffectMask = Input { Source = "LineMask" },
			Inputs = {
				Foreground = Input { Source = "Line" },
				Background = Input { Source = "BG" },
			},
		},
		MergeStat = Merge {
			Inputs = {
				Foreground = Input { Source = "StatNumber" },
				Background = Input { Source = "MergeLine" },
			},
		},
		${label ? `MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "StatLabel" },
				Background = Input { Source = "MergeStat" },
			},
		},` : ''}
	},
}`
}

function docEndCard(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 6
  const holdFrames = Math.round((dur - 2.5) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const credits = p.subtext || ''

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = 0.03 },
				TopLeftGreen = Input { Value = 0.03 },
				TopLeftBlue = Input { Value = 0.03 },
				TopLeftAlpha = Input { Value = 1 },
			},
		},
		BgFade = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		BgMerge = Merge {
			Inputs = {
				Foreground = Input { Source = "BG" },
				Background = Input { Source = "BgFade" },
				Blend = Input {
					SourceOp = "BgBlend",
					Source = "Value",
				},
			},
		},
		${fadeSpline('BgBlend', fps, holdFrames, 18, 24)},
		TopLine = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.3 },
			},
		},
		TopLineMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "TopLineW",
					Source = "Value",
				},
				Height = Input { Value = 0.001 },
				Center = Input { Value = { 0.5, 0.58 } },
			},
		},
		${lineDrawSpline('TopLineW', fps, holdFrames, 6)},
		BottomLine = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.3 },
			},
		},
		BottomLineMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "BtmLineW",
					Source = "Value",
				},
				Height = Input { Value = 0.001 },
				Center = Input { Value = { 0.5, 0.42 } },
			},
		},
		${lineDrawSpline('BtmLineW', fps, holdFrames, 6)},
		TitleText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text.toUpperCase())}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Medium" },
				Size = Input { Value = 0.045 },
				Tracking = Input { Value = 0.15 },
				Center = Input { Value = { 0.5, 0.5 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "EndTitleFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('EndTitleFade', fps, holdFrames, Math.round(12 * fps / 24))},
		${credits ? `CreditsText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(credits)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.018 },
				Tracking = Input { Value = 0.08 },
				LineSpacingNew = Input { Value = 1.8 },
				Center = Input { Value = { 0.5, 0.35 } },
				Red1 = Input { Value = ${r * 0.6} },
				Green1 = Input { Value = ${g * 0.6} },
				Blue1 = Input { Value = ${b * 0.6} },
				Opacity1 = Input {
					SourceOp = "CreditsFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('CreditsFade', fps, holdFrames, Math.round(18 * fps / 24))},` : ''}
		MergeTopLine = Merge {
			EffectMask = Input { Source = "TopLineMask" },
			Inputs = {
				Foreground = Input { Source = "TopLine" },
				Background = Input { Source = "BgMerge" },
			},
		},
		MergeBtmLine = Merge {
			EffectMask = Input { Source = "BottomLineMask" },
			Inputs = {
				Foreground = Input { Source = "BottomLine" },
				Background = Input { Source = "MergeTopLine" },
			},
		},
		MergeTitle = Merge {
			Inputs = {
				Foreground = Input { Source = "TitleText" },
				Background = Input { Source = "MergeBtmLine" },
			},
		},
		${credits ? `MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "CreditsText" },
				Background = Input { Source = "MergeTitle" },
			},
		},` : ''}
	},
}`
}

function docTextReveal(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 3
  const holdFrames = Math.round((dur - 1.2) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const pos = positionCoords(p.position || 'center')

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		RevealText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Medium" },
				Size = Input { Value = 0.042 },
				Tracking = Input { Value = 0.06 },
				Center = Input { Value = { ${pos.x}, ${pos.y} } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "RevealFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('RevealFade', fps, holdFrames, 10, 12)},
		RevealMask = RectangleMask {
			Inputs = {
				Width = Input { Value = 0.6 },
				Height = Input { Value = 0.08 },
				Center = Input { Value = { ${pos.x}, ${pos.y} } },
				SoftEdge = Input { Value = 0.008 },
			},
		},
		MergeFinal = Merge {
			EffectMask = Input { Source = "RevealMask" },
			Inputs = {
				Foreground = Input { Source = "RevealText" },
				Background = Input { Source = "BG" },
			},
		},
	},
}`
}

function docMinimalTitle(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 4
  const holdFrames = Math.round((dur - 1.3) * fps)
  const font = p.font || 'Futura'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		TitleText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.050 },
				Tracking = Input { Value = 0.08 },
				Center = Input {
					SourceOp = "MinDrift",
					Source = "Value",
				},
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "MinFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('MinFade', fps, holdFrames, 14, 16)},
		${driftSpline('MinDrift', fps, holdFrames, 0.49, 0.5)},
		MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "TitleText" },
				Background = Input { Source = "BG" },
			},
		},
	},
}`
}

function docEditorial(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 4
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Georgia'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		TitleText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Regular" },
				Size = Input { Value = 0.058 },
				Tracking = Input { Value = 0.03 },
				Center = Input { Value = { 0.5, 0.52 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "EditFade",
					Source = "Value",
				},
			},
		},
		${fadeSpline('EditFade', fps, holdFrames)},
		Underline = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.6 },
			},
		},
		UnderlineMask = RectangleMask {
			Inputs = {
				Width = Input {
					SourceOp = "ULineW",
					Source = "Value",
				},
				Height = Input { Value = 0.001 },
				Center = Input { Value = { 0.5, 0.475 } },
			},
		},
		${lineDrawSpline('ULineW', fps, holdFrames, 6)},
		${p.subtext ? `SubText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.subtext.toUpperCase())}" },
				Font = Input { Value = "Futura" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.018 },
				Tracking = Input { Value = 0.2 },
				Center = Input { Value = { 0.5, 0.45 } },
				Red1 = Input { Value = ${r * 0.7} },
				Green1 = Input { Value = ${g * 0.7} },
				Blue1 = Input { Value = ${b * 0.7} },
				Opacity1 = Input {
					SourceOp = "SubFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('SubFade', fps, holdFrames, Math.round(10 * fps / 24))},` : ''}
		MergeLine = Merge {
			EffectMask = Input { Source = "UnderlineMask" },
			Inputs = {
				Foreground = Input { Source = "Underline" },
				Background = Input { Source = "BG" },
			},
		},
		MergeTitle = Merge {
			Inputs = {
				Foreground = Input { Source = "TitleText" },
				Background = Input { Source = "MergeLine" },
			},
		},
		${p.subtext ? `MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "SubText" },
				Background = Input { Source = "MergeTitle" },
			},
		},` : ''}
	},
}`
}

function docPullQuote(p: TemplateParams): string {
  const fps = p.fps || 24
  const dur = p.duration || 5
  const holdFrames = Math.round((dur - 1.5) * fps)
  const font = p.font || 'Georgia'
  const { r, g, b } = p.color || { r: 1, g: 1, b: 1 }
  const attribution = p.subtext || ''

  return `{
	Tools = ordered() {
		BG = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftAlpha = Input { Value = 0 },
			},
		},
		LeftBar = Background {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				TopLeftRed = Input { Value = ${r} },
				TopLeftGreen = Input { Value = ${g} },
				TopLeftBlue = Input { Value = ${b} },
				TopLeftAlpha = Input { Value = 0.8 },
			},
		},
		BarMask = RectangleMask {
			Inputs = {
				Width = Input { Value = 0.003 },
				Height = Input {
					SourceOp = "BarHeight",
					Source = "Value",
				},
				Center = Input { Value = { 0.22, 0.5 } },
			},
		},
		${lineDrawSpline('BarHeight', fps, holdFrames, 2)},
		QuoteText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "${esc(p.text)}" },
				Font = Input { Value = "${font}" },
				Style = Input { Value = "Italic" },
				Size = Input { Value = 0.034 },
				Tracking = Input { Value = 0.02 },
				LineSpacingNew = Input { Value = 1.5 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.45, 0.52 } },
				Red1 = Input { Value = ${r} },
				Green1 = Input { Value = ${g} },
				Blue1 = Input { Value = ${b} },
				Opacity1 = Input {
					SourceOp = "PQFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('PQFade', fps, holdFrames, Math.round(6 * fps / 24))},
		${attribution ? `AttrText = TextPlus {
			Inputs = {
				Width = Input { Value = 1920 },
				Height = Input { Value = 1080 },
				StyledText = Input { Value = "\\xe2\\x80\\x94 ${esc(attribution.toUpperCase())}" },
				Font = Input { Value = "Futura" },
				Style = Input { Value = "Light" },
				Size = Input { Value = 0.016 },
				Tracking = Input { Value = 0.18 },
				HorizontalJustificationNew = Input { Value = 0 },
				Center = Input { Value = { 0.45, 0.42 } },
				Red1 = Input { Value = ${r * 0.65} },
				Green1 = Input { Value = ${g * 0.65} },
				Blue1 = Input { Value = ${b * 0.65} },
				Opacity1 = Input {
					SourceOp = "PQAttrFade",
					Source = "Value",
				},
			},
		},
		${staggeredFadeSpline('PQAttrFade', fps, holdFrames, Math.round(14 * fps / 24))},` : ''}
		MergeBar = Merge {
			EffectMask = Input { Source = "BarMask" },
			Inputs = {
				Foreground = Input { Source = "LeftBar" },
				Background = Input { Source = "BG" },
			},
		},
		MergeQuote = Merge {
			Inputs = {
				Foreground = Input { Source = "QuoteText" },
				Background = Input { Source = "MergeBar" },
			},
		},
		${attribution ? `MergeFinal = Merge {
			Inputs = {
				Foreground = Input { Source = "AttrText" },
				Background = Input { Source = "MergeQuote" },
			},
		},` : ''}
	},
}`
}

// ── Preset registry ──

export const FUSION_TEMPLATES: TemplatePreset[] = [
  {
    id: 'doc-main-title',
    name: 'Documentary Title',
    type: 'title',
    description: 'Centred upper-case title with tracked lettering, smooth fade-up and subtle drift. Optional subtitle below.',
    category: 'documentary',
    generate: docMainTitle,
  },
  {
    id: 'doc-chapter',
    name: 'Chapter Break',
    type: 'chapter',
    description: 'Chapter label and title separated by an animated horizontal line. Staggered entrance.',
    category: 'documentary',
    generate: docChapter,
  },
  {
    id: 'doc-lt-clean',
    name: 'Clean Lower Third',
    type: 'lower-third',
    description: 'Name and role with a thin accent line above. Left-aligned, staggered fade-in.',
    category: 'documentary',
    generate: docLowerThirdClean,
  },
  {
    id: 'doc-lt-box',
    name: 'Box Lower Third',
    type: 'lower-third',
    description: 'Name and role inside a semi-transparent dark box. Clean and readable over any footage.',
    category: 'documentary',
    generate: docLowerThirdBox,
  },
  {
    id: 'doc-location',
    name: 'Location Super',
    type: 'location',
    description: 'Small-caps location name in bottom-right corner with subtle upward drift. Optional date line.',
    category: 'minimal',
    generate: docLocation,
  },
  {
    id: 'doc-quote',
    name: 'Quote Card',
    type: 'quote',
    description: 'Centred italic quote with decorative quotation mark and small-caps attribution below.',
    category: 'editorial',
    generate: docQuote,
  },
  {
    id: 'doc-pullquote',
    name: 'Pull Quote',
    type: 'quote',
    description: 'Left-aligned italic quote with vertical accent bar. Documentary interview style.',
    category: 'editorial',
    generate: docPullQuote,
  },
  {
    id: 'doc-stat',
    name: 'Statistic Callout',
    type: 'stat',
    description: 'Large bold number centred with label below and thin divider line. For key data points.',
    category: 'documentary',
    generate: docStat,
  },
  {
    id: 'doc-end-card',
    name: 'End Card',
    type: 'end-card',
    description: 'Company name between two animated lines on a dark background. Optional credits below.',
    category: 'cinematic',
    generate: docEndCard,
  },
  {
    id: 'doc-text-reveal',
    name: 'Text Reveal',
    type: 'reveal',
    description: 'Single line of text with a masked reveal. Clean and impactful for key phrases.',
    category: 'cinematic',
    generate: docTextReveal,
  },
  {
    id: 'doc-minimal',
    name: 'Minimal Title',
    type: 'title',
    description: 'Light-weight centred text with gentle drift animation. Simple and elegant.',
    category: 'minimal',
    generate: docMinimalTitle,
  },
  {
    id: 'doc-editorial',
    name: 'Editorial Title',
    type: 'title',
    description: 'Serif title with animated underline accent. Optional small-caps subtitle below.',
    category: 'editorial',
    generate: docEditorial,
  },
  {
    id: 'kinetic-word-reveal',
    name: 'Kinetic Word Reveal',
    type: 'kinetic-text',
    description: 'Words appear one at a time with scale-bounce animation. High energy, social-first.',
    category: 'motion',
    generate: kineticWordReveal,
  },
  {
    id: 'cta-button',
    name: 'Call to Action',
    type: 'cta',
    description: 'Animated rounded pill button with text. Slides in from bottom with bounce. For end-of-video CTAs.',
    category: 'social',
    generate: ctaButton,
  },
  {
    id: 'social-handle',
    name: 'Social Handle Bug',
    type: 'social-bug',
    description: 'Small persistent @handle badge in corner with subtle fade-in. For brand watermarking.',
    category: 'social',
    generate: socialBug,
  },
  {
    id: 'animated-counter',
    name: 'Animated Counter',
    type: 'animated-counter',
    description: 'Number counts up from 0 to target value with eased animation. For statistics and metrics.',
    category: 'motion',
    generate: animatedCounter,
  },
]

function kineticWordReveal(params: TemplateParams): string {
  const fps = params.fps || 24
  const dur = params.duration || 3
  const totalFrames = Math.round(dur * fps)
  const words = params.text.split(/\s+/)
  const stagger = Math.max(3, Math.floor(totalFrames / (words.length + 4)))
  const r = params.color?.r ?? 1
  const g = params.color?.g ?? 1
  const b = params.color?.b ?? 1

  const wordTools = words.map((word, i) => {
    const startFrame = i * stagger
    const peakFrame = startFrame + Math.round(stagger * 0.4)
    const x = 0.5
    const y = 0.5 - (words.length - 1) * 0.03 + i * 0.06
    return `Text${i + 1} = TextPlus {
      Inputs = {
        Width = Input { Value = 1920 },
        Height = Input { Value = 1080 },
        StyledText = Input { Value = "${word}" },
        Font = Input { Value = "${params.font || 'Arial Black'}" },
        Size = Input { Value = 0.08 },
        Center = Input { Value = { ${x}, ${y} } },
        Red1 = Input { Value = ${r} },
        Green1 = Input { Value = ${g} },
        Blue1 = Input { Value = ${b} },
        Opacity = Input { SourceOp = "Text${i + 1}Opacity", Source = "Value" },
      },
    },
    Text${i + 1}Opacity = BezierSpline {
      KeyFrames = {
        [${startFrame}] = { 0, Flags = { Linear = true } },
        [${peakFrame}] = { 1, Flags = { Linear = true } },
        [${totalFrames - Math.round(fps * 0.3)}] = { 1, Flags = { Linear = true } },
        [${totalFrames}] = { 0, Flags = { Linear = true } },
      }
    },`
  }).join('\n    ')

  return `{ Tools = ordered() { ${wordTools} } }`
}

function ctaButton(params: TemplateParams): string {
  const fps = params.fps || 24
  const dur = params.duration || 2.5
  const totalFrames = Math.round(dur * fps)
  const slideIn = Math.round(fps * 0.5)
  const slideOut = Math.round(fps * 0.4)
  const r = params.color?.r ?? 0.2
  const g = params.color?.g ?? 0.6
  const b = params.color?.b ?? 1

  return `{
    Tools = ordered() {
      BG = Background {
        Inputs = {
          Width = Input { Value = 1920 },
          Height = Input { Value = 1080 },
          UseFrameFormatSettings = Input { Value = 1 },
          TopLeftRed = Input { Value = ${r} },
          TopLeftGreen = Input { Value = ${g} },
          TopLeftBlue = Input { Value = ${b} },
          TopLeftAlpha = Input { Value = 0.9 },
          Type = Input { Value = FuID { "Corner" } },
          EffectMask = Input { SourceOp = "Pill" },
        },
      },
      Pill = RectangleMask {
        Inputs = {
          Width = Input { Value = 0.18 },
          Height = Input { Value = 0.055 },
          CornerRadius = Input { Value = 0.5 },
          Center = Input { Value = { 0.5, 0.12 } },
          SoftEdge = Input { Value = 0.002 },
        },
      },
      CTAText = TextPlus {
        Inputs = {
          Width = Input { Value = 1920 },
          Height = Input { Value = 1080 },
          StyledText = Input { Value = "${params.text}" },
          Font = Input { Value = "${params.font || 'Arial'}" },
          Style = Input { Value = "Bold" },
          Size = Input { Value = 0.028 },
          Center = Input { Value = { 0.5, 0.12 } },
          Red1 = Input { Value = 1 },
          Green1 = Input { Value = 1 },
          Blue1 = Input { Value = 1 },
          Opacity = Input { SourceOp = "CTAFade", Source = "Value" },
        },
      },
      CTAFade = BezierSpline {
        KeyFrames = {
          [0] = { 0, Flags = { Linear = true } },
          [${slideIn}] = { 1, Flags = { Linear = true } },
          [${totalFrames - slideOut}] = { 1, Flags = { Linear = true } },
          [${totalFrames}] = { 0, Flags = { Linear = true } },
        }
      },
    },
  }`
}

function socialBug(params: TemplateParams): string {
  const fps = params.fps || 24
  const dur = params.duration || 5
  const totalFrames = Math.round(dur * fps)
  const fadeIn = Math.round(fps * 0.8)
  const fadeOut = Math.round(fps * 0.5)
  const pos = params.position || 'bottom-right'
  const x = pos.includes('right') ? 0.88 : 0.12
  const y = pos.includes('top') ? 0.92 : 0.08

  return `{
    Tools = ordered() {
      Handle = TextPlus {
        Inputs = {
          Width = Input { Value = 1920 },
          Height = Input { Value = 1080 },
          StyledText = Input { Value = "${params.text}" },
          Font = Input { Value = "${params.font || 'Arial'}" },
          Size = Input { Value = 0.022 },
          Center = Input { Value = { ${x}, ${y} } },
          HorizontalJustificationNew = Input { Value = 3 },
          Red1 = Input { Value = 1 },
          Green1 = Input { Value = 1 },
          Blue1 = Input { Value = 1 },
          Opacity = Input { SourceOp = "HandleFade", Source = "Value" },
        },
      },
      HandleFade = BezierSpline {
        KeyFrames = {
          [0] = { 0, Flags = { Linear = true } },
          [${fadeIn}] = { 0.7, Flags = { Linear = true } },
          [${totalFrames - fadeOut}] = { 0.7, Flags = { Linear = true } },
          [${totalFrames}] = { 0, Flags = { Linear = true } },
        }
      },
    },
  }`
}

function animatedCounter(params: TemplateParams): string {
  const fps = params.fps || 24
  const dur = params.duration || 3
  const totalFrames = Math.round(dur * fps)
  const countDur = Math.round(totalFrames * 0.6)
  const targetValue = parseInt(params.text) || 100
  const label = params.subtext || ''
  const r = params.color?.r ?? 1
  const g = params.color?.g ?? 1
  const b = params.color?.b ?? 1

  const keyframes = Array.from({ length: 10 }, (_, i) => {
    const frame = Math.round((i / 9) * countDur)
    const progress = Math.pow(i / 9, 0.5)
    const value = Math.round(targetValue * progress)
    return `[${frame}] = { 0, Flags = { Linear = true } }`
  }).join(',\n          ')

  return `{
    Tools = ordered() {
      Counter = TextPlus {
        Inputs = {
          Width = Input { Value = 1920 },
          Height = Input { Value = 1080 },
          StyledText = Input { Value = "${targetValue}" },
          Font = Input { Value = "${params.font || 'Arial Black'}" },
          Size = Input { Value = 0.12 },
          Center = Input { Value = { 0.5, 0.55 } },
          Red1 = Input { Value = ${r} },
          Green1 = Input { Value = ${g} },
          Blue1 = Input { Value = ${b} },
          Opacity = Input { SourceOp = "CounterFade", Source = "Value" },
        },
      },
      CounterFade = BezierSpline {
        KeyFrames = {
          [0] = { 0, Flags = { Linear = true } },
          [${Math.round(fps * 0.3)}] = { 1, Flags = { Linear = true } },
          [${totalFrames - Math.round(fps * 0.3)}] = { 1, Flags = { Linear = true } },
          [${totalFrames}] = { 0, Flags = { Linear = true } },
        }
      },
      ${label ? `Label = TextPlus {
        Inputs = {
          Width = Input { Value = 1920 },
          Height = Input { Value = 1080 },
          StyledText = Input { Value = "${label}" },
          Font = Input { Value = "${params.font || 'Arial'}" },
          Size = Input { Value = 0.03 },
          Center = Input { Value = { 0.5, 0.44 } },
          Red1 = Input { Value = ${r * 0.7} },
          Green1 = Input { Value = ${g * 0.7} },
          Blue1 = Input { Value = ${b * 0.7} },
          Opacity = Input { SourceOp = "CounterFade", Source = "Value" },
        },
      },` : ''}
    },
  }`
}

export function getTemplateById(id: string): TemplatePreset | undefined {
  return FUSION_TEMPLATES.find(t => t.id === id)
}

export function getTemplatesByType(type: string): TemplatePreset[] {
  return FUSION_TEMPLATES.filter(t => t.type === type)
}

export function generateFusionScript(templateId: string, params: TemplateParams): string | null {
  const template = getTemplateById(templateId)
  if (!template) return null
  return template.generate(params)
}
