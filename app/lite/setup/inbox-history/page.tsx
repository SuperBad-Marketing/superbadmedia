/**
 * `/lite/setup/inbox-history` — History import wizard step.
 *
 * Three-phase flow after Graph API connection:
 *   1. Import progress (12-month backfill with live progress bar)
 *   2. Contact routing review (re-route auto-created contacts)
 *   3. Noise cleanup (optional soft-delete of old noise)
 *
 * Server Component — auth guard, initial state fetch.
 * Client Component below handles polling + transitions.
 *
 * Owner: UI-12. Spec: unified-inbox.md §13 Steps 3–5.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { getGraphStateForImport, getImportProgress } from "@/lib/graph/history-import";
import { HistoryImportClient } from "./history-import-client";

export default async function InboxHistoryPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const state = await getGraphStateForImport();
  const progress = state ? await getImportProgress(state.id) : null;

  return (
    <HistoryImportClient
      initialState={state}
      initialProgress={progress}
    />
  );
}
