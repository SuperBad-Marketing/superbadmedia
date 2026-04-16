import type { ThreadRow } from "@/lib/db/schema/messages";

/**
 * Client-safe — no `@/lib/db` imports, no side effects. The UI-9
 * Conversation view needs this heuristic from inside the client bundle
 * (per-thread default collapse state), which means it can't live in
 * `list-conversation.ts` (that module transitively pulls better-sqlite3).
 *
 * Spec §4.2 default collapse rule: expanded if the thread has any
 * unread inbound messages; collapsed if fully read. Mirrors the
 * `isThreadUnread` heuristic in `list-threads.ts`.
 */
export function isConversationThreadUnread(thread: ThreadRow): boolean {
  if (thread.last_inbound_at_ms === null) return false;
  if (thread.last_outbound_at_ms === null) return true;
  return thread.last_inbound_at_ms > thread.last_outbound_at_ms;
}
