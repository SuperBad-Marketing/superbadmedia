const EARLY: string[] = [
  "You're doing great. We have no way of knowing that. But statistically, probably.",
  "No wrong answers. Just revealing ones.",
  "We're watching. Not in a weird way.",
  "First impressions are forming. Yours, not ours.",
];

const MID: string[] = [
  "Still here. That's already more commitment than most marketing strategies.",
  "Halfway. The questions only get more personal from here.",
  "Your answers are starting to form a pattern. We're not going to tell you what it is yet.",
  "Most people speed up around here. The ones who slow down tend to get better results.",
  "Every answer narrows the picture. You'd be surprised how sharp it's getting.",
  "This is the part where people start second-guessing their earlier answers. Don't.",
];

const LATE: string[] = [
  "Nearly there. The last section is the one that usually surprises people.",
  "You've answered more questions about yourself than most brands answer in a year.",
  "The portrait is already taking shape. You just can't see it yet.",
  "You're in the home stretch. We're in the weirdest part.",
];

const FINAL: string[] = [
  "Last few. Then we show you what we found.",
  "Almost done. You clearly don't need the encouragement, but here it is anyway.",
  "Final stretch. Worth it.",
];

function poolForPosition(index: number): string[] {
  if (index < 20) return EARLY;
  if (index < 60) return MID;
  if (index < 90) return LATE;
  return FINAL;
}

const NUDGE_MAP = buildNudgeMap();

function buildNudgeMap(): Map<number, string> {
  const map = new Map<number, string>();
  let lastPick: string | null = null;

  for (let i = 3; i < 102; i++) {
    const hash = ((i * 2654435761) >>> 0) % 100;
    if (hash >= 18) continue;

    const pool = poolForPosition(i);
    let pick = ((i * 48271) >>> 0) % pool.length;

    if (pool[pick] === lastPick) {
      pick = (pick + 1) % pool.length;
    }

    lastPick = pool[pick];
    map.set(i, pool[pick]);
  }

  return map;
}

export function getNudge(
  section: number,
  questionIndex: number,
): string | null {
  const SECTION_OFFSETS = [0, 19, 43, 63, 82, 102];
  const overallIndex = SECTION_OFFSETS[section - 1] + questionIndex;
  return NUDGE_MAP.get(overallIndex) ?? null;
}
