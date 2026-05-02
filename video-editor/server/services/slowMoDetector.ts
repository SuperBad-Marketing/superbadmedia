interface ClipAnalysis {
  hasAction?: boolean
  emotionalTone?: string
  humanContent?: string[]
  editUtility?: string[]
  rankedMoments?: { timestamp: number; score: number; reason: string }[]
  cameraMovement?: string
  movementLevel?: string
}

interface StoryboardEntry {
  clipId: string
  startTime: number
  endTime: number
  position: number
  analysis?: ClipAnalysis
}

export interface SlowMoPlan {
  clipIndex: number
  speed: 25 | 50 | 75
  useOpticalFlow: boolean
  momentTimestamp?: number
  reason: string
}

export function detectSlowMoCandidates(
  storyboardClips: StoryboardEntry[],
  moodAxes?: { intensity?: number },
): SlowMoPlan[] {
  const plans: SlowMoPlan[] = []
  const intensity = moodAxes?.intensity ?? 50
  const totalDuration = storyboardClips.reduce((s, c) => s + (c.endTime - c.startTime), 0)
  const maxSlowMo = Math.max(1, Math.floor(totalDuration / 15))

  const candidates: { index: number; score: number; plan: SlowMoPlan }[] = []

  for (let i = 0; i < storyboardClips.length; i++) {
    const sc = storyboardClips[i]
    const a = sc.analysis
    if (!a) continue

    const clipDur = sc.endTime - sc.startTime
    if (clipDur < 1.0) continue

    let score = 0
    let reason = ''
    let momentTs: number | undefined

    const topMoment = a.rankedMoments?.find(m => m.score >= 80)
    if (topMoment && a.hasAction) {
      score += topMoment.score
      reason = `Peak moment (${topMoment.reason})`
      momentTs = topMoment.timestamp
    }

    if (a.emotionalTone === 'dramatic' || a.emotionalTone === 'intense') {
      score += 30
      reason = reason || 'Dramatic emotional tone'
    }

    const hasCandidMoment = a.humanContent?.some(h =>
      h.includes('emotion-surprise') || h.includes('candid-moment') || h.includes('emotion-joy')
    )
    if (hasCandidMoment) {
      score += 25
      reason = reason || 'Candid emotional moment'
    }

    if (a.editUtility?.includes('hero-shot')) {
      score += 35
      reason = reason || 'Hero shot'
    }

    const isHighMovement = a.cameraMovement === 'dynamic' || a.movementLevel === 'high'
    if (isHighMovement && a.hasAction) {
      score += 20
      reason = reason || 'High movement action'
    }

    if (score >= 40) {
      const speed = intensity > 70 ? 25 : intensity > 40 ? 50 : 75
      candidates.push({
        index: i,
        score,
        plan: {
          clipIndex: i,
          speed,
          useOpticalFlow: true,
          momentTimestamp: momentTs,
          reason,
        },
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  for (const c of candidates.slice(0, maxSlowMo)) {
    plans.push(c.plan)
  }

  return plans
}
