interface ClipAnalysis {
  cameraMovement?: string
  shotType?: string
  editUtility?: string[]
  hasFaces?: boolean
  environment?: string
  sceneType?: string
  composition?: string
}

interface StoryboardEntry {
  clipId: string
  startTime: number
  endTime: number
  position: number
  analysis?: ClipAnalysis
}

export interface ZoomPlan {
  clipIndex: number
  type: 'push-in' | 'pull-out' | 'drift'
  variant: 'subtle' | 'standard' | 'dramatic'
  scaleStart: number
  scaleEnd: number
  reason: string
}

export function planZooms(
  storyboardClips: StoryboardEntry[],
  moodAxes?: { intensity?: number; intimacy?: number; chaos?: number },
): ZoomPlan[] {
  const plans: ZoomPlan[] = []
  const intensity = moodAxes?.intensity ?? 50
  const maxZooms = Math.max(2, Math.floor(storyboardClips.length * 0.3))

  for (let i = 0; i < storyboardClips.length; i++) {
    if (plans.length >= maxZooms) break
    const sc = storyboardClips[i]
    const a = sc.analysis
    if (!a) continue

    const isStatic = a.cameraMovement === 'static' || a.cameraMovement === 'locked'
    const clipDur = sc.endTime - sc.startTime
    if (!isStatic || clipDur < 1.5) continue

    const isEstablishing = a.editUtility?.includes('establishing') || a.shotType === 'wide'
    const isHero = a.editUtility?.includes('hero-shot')
    const isAerial = a.shotType === 'drone-aerial' || a.shotType === 'aerial'
    const isTalkingHead = a.hasFaces && (a.shotType === 'medium' || a.shotType === 'close-up')

    if (isEstablishing || isAerial) {
      const variant = intensity > 70 ? 'dramatic' : intensity > 40 ? 'standard' : 'subtle'
      const scale = variant === 'dramatic' ? 0.2 : variant === 'standard' ? 0.12 : 0.06
      plans.push({
        clipIndex: i,
        type: isAerial ? 'pull-out' : 'push-in',
        variant,
        scaleStart: isAerial ? 1.0 + scale : 1.0,
        scaleEnd: isAerial ? 1.0 : 1.0 + scale,
        reason: isAerial ? 'Aerial/drone static shot — pull-out adds scale' : 'Establishing shot — push-in draws the viewer in',
      })
    } else if (isHero) {
      plans.push({
        clipIndex: i,
        type: 'push-in',
        variant: 'standard',
        scaleStart: 1.0,
        scaleEnd: 1.15,
        reason: 'Hero shot — slow push-in for emphasis',
      })
    } else if (isTalkingHead && clipDur > 2.5) {
      plans.push({
        clipIndex: i,
        type: 'push-in',
        variant: 'subtle',
        scaleStart: 1.0,
        scaleEnd: 1.05,
        reason: 'Face on static camera — subtle push-in adds life',
      })
    }
  }

  return plans
}

export function zoomToFusionScript(zoom: ZoomPlan, clipDurationFrames: number, fps: number): string {
  const startScale = zoom.scaleStart
  const endScale = zoom.scaleEnd
  const midFrame = Math.floor(clipDurationFrames / 2)

  return `{
    Tools = ordered() {
      Transform1 = Transform {
        Inputs = {
          Center = Input { Value = FuID { "Center" }, },
          Size = Input {
            SourceOp = "SizeAnim",
            Source = "Value",
          },
        },
        ViewInfo = OperatorInfo { Pos = { 0, 0 } },
      },
      SizeAnim = BezierSpline {
        SplineColor = { Red = 255, Green = 0, Blue = 0 },
        KeyFrames = {
          [0] = { ${startScale}, RH = { ${midFrame / 3}, ${startScale + (endScale - startScale) * 0.33} }, Flags = { Linear = true } },
          [${clipDurationFrames}] = { ${endScale}, LH = { ${clipDurationFrames - midFrame / 3}, ${startScale + (endScale - startScale) * 0.67} }, Flags = { Linear = true } },
        }
      },
    },
  }`
}
