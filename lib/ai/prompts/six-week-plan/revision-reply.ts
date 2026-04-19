/**
 * Haiku prompt — `six-week-plan-revision-reply`.
 *
 * Drafts Andy's explain-path reply to a prospect's revision note.
 * Populated by content mini-session before SWP-2.
 */

import type { WeeksOutput } from "./weeks";

export type RevisionReplyInput = {
  prospectName: string;
  businessName: string;
  revisionNote: string;
  planJson: WeeksOutput;
};

export type RevisionReplyOutput = {
  reply_text: string;
};

export function buildRevisionReplyPrompt(
  _input: RevisionReplyInput,
): string {
  // Populated by content mini-session
  return "STUB — populated by content mini-session";
}
