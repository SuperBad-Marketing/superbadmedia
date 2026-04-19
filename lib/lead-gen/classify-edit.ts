import { settingsRegistry } from "@/lib/settings";

export type EditClassification = "clean" | "minor" | "material";

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

export async function classifyEdit(
  original: { subject: string; body_markdown: string },
  submitted: { subject: string; body_markdown: string },
): Promise<EditClassification> {
  if (original.subject !== submitted.subject) return "material";
  if (original.body_markdown === submitted.body_markdown) return "clean";

  const charDiff = levenshteinDistance(
    original.body_markdown,
    submitted.body_markdown,
  );

  const minorThreshold = await settingsRegistry.get(
    "autonomy.minor_edit_char_threshold",
  );
  if (charDiff <= minorThreshold) return "minor";

  const materialRatio = await settingsRegistry.get(
    "autonomy.material_edit_ratio_threshold",
  );
  const changeRatio = charDiff / original.body_markdown.length;
  if (changeRatio > materialRatio) return "material";

  return "minor";
}

export { levenshteinDistance };
