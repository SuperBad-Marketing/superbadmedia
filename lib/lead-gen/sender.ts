/**
 * Single sender identity for all Lead Gen outreach (spec §10.3, Q13).
 * §12.P — no inline from-strings anywhere; all send paths import this.
 */

export const SUPERBAD_SENDER = {
  display_name: "Andy Robinson",
  local_part: "hi",
  domain: "contact.superbadmedia.com.au",
  reply_to: "hi@contact.superbadmedia.com.au",
} as const;

export const SUPERBAD_FROM_STRING =
  `${SUPERBAD_SENDER.display_name} <${SUPERBAD_SENDER.local_part}@${SUPERBAD_SENDER.domain}>` as const;
