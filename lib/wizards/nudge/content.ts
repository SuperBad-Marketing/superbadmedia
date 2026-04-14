/**
 * Wizard nudge + expiry email copy. Canonical source:
 * `docs/content/setup-wizards/nudge-emails.md`. Keep in sync.
 *
 * Voice: dry, observational, slow burn (`superbad-brand-voice`).
 * Classification: transactional (user-initiated flow continuation).
 */

export const RESUME_NUDGE_SUBJECTS: readonly string[] = [
  "Your setup is still there. Exactly where you left it.",
  "The setup tab is waiting. Patiently. Ish.",
  "You paused halfway through. No judgement. Just a nudge.",
  "Half a wizard, still alive.",
];

export const EXPIRY_WARN_SUBJECTS: readonly string[] = [
  "Your half-finished setup expires tomorrow.",
  "One day left on that paused wizard.",
  "Tomorrow this setup disappears. Last call.",
];

export function pickSubject(
  pool: readonly string[],
  seed: string,
): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % pool.length;
  return pool[idx];
}

export function resumeNudgeBody(params: {
  wizardName: string;
  resumeUrl: string;
}): string {
  return [
    `<p>Hey — you started <strong>${escapeHtml(params.wizardName)}</strong> yesterday and then life happened.</p>`,
    `<p>It's still there. Same spot. No need to start again.</p>`,
    `<p><a href="${params.resumeUrl}">Pick up where you left off →</a></p>`,
    `<p>— SuperBad</p>`,
  ].join("\n");
}

export function expiryWarnBody(params: {
  wizardName: string;
  resumeUrl: string;
}): string {
  return [
    `<p>One day left on your <strong>${escapeHtml(params.wizardName)}</strong> setup. After tomorrow the in-progress state gets cleared and you'd start from step one.</p>`,
    `<p>Takes about two minutes to finish.</p>`,
    `<p><a href="${params.resumeUrl}">Finish the setup →</a></p>`,
    `<p>— SuperBad</p>`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
