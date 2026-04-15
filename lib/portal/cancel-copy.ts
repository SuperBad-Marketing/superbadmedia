/**
 * SB-11 — portal cancel-flow copy constants.
 *
 * Per `feedback_no_content_authoring`, subscriber-facing copy that
 * needs the SuperBad dry-voice treatment is authored in dedicated
 * content mini-sessions (loaded `superbad-brand-voice` skill). This
 * module ships a working-placeholder + `COPY_OWED` sentinel so the
 * copy wave has a clear landing pad.
 *
 * Grepping for `COPY_OWED:` surfaces every outstanding string the
 * cancel flow is still waiting on. Do NOT compose final copy in build
 * sessions.
 */

export const CANCEL_COPY = {
  /**
   * COPY_OWED: cancel.motivational_reality_check
   *
   * Displayed at the top of every pre-term and post-term cancel branch
   * (spec §6.1). Honest acknowledgement that running a business is
   * hard. No guilt, no begging, no discounts. Authored by a content
   * mini-session with `superbad-brand-voice` loaded.
   */
  motivationalRealityCheck:
    "Running a business is hard. The frustration you're feeling right now is the job — it doesn't mean you're doing it wrong. If the tool's the wrong fit, leave. If it's a rough week, breathe.",

  /** COPY_OWED: cancel.product_switch_heading */
  productSwitchHeading:
    "Before you go — would a different product suit you better?",

  /** COPY_OWED: cancel.paused_heading */
  pausedHeading: "You're on pause.",

  /** COPY_OWED: cancel.post_term_cancel_confirm_heading */
  postTermCancelConfirmHeading: "Here's what you'd be losing.",

  /** Locked (not brand-voice-sensitive): bartender link label. */
  talkToUsLabel: "Talk to us",

  /** Locked: kill-switch fallback copy. */
  killSwitchFallback:
    "Cancellation is temporarily paused while we work on something. Reach out and we'll handle it.",

  /** Locked: card-not-on-file banner. */
  cardNotOnFileNote:
    "We don't have a card on file right now. Paid exits need one — talk to us and we'll sort it.",
} as const;

export type CancelCopyKey = keyof typeof CANCEL_COPY;
