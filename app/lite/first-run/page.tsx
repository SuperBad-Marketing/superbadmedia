/**
 * `/lite/first-run` — critical-flight sequencer route.
 *
 * Middleware (proxy.ts gate 2) routes authenticated admins here whenever
 * `session.user.critical_flight_complete` is false. This Server Component
 * then:
 *
 *   - Redirects to `/lite/setup/critical-flight/[nextWizardKey]` if any
 *     critical-flight wizard still lacks a completion row for the user
 *     (spec §8.1). Those routes land in SW-5+.
 *   - Renders the capstone screen when every wizard is complete
 *     (spec §8.3). Placeholder copy until the content mini-session
 *     calibrates it.
 *
 * Kill-switch: when `setup_wizards_enabled` is false,
 * `hasCompletedCriticalFlight` short-circuits to true upstream, so gate 2
 * never lands here. The route still guards against direct navigation in
 * that state by rendering the capstone (which is harmless) rather than
 * redirecting into nonexistent wizard routes.
 *
 * Owner: SW-4.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { nextCriticalWizardKey } from "@/lib/wizards/critical-flight";
import { killSwitches } from "@/lib/kill-switches";
import { Capstone } from "./capstone";

// Placeholder copy per spec §8.3 — content mini-session calibrates later.
const CAPSTONE_LINE = "SuperBad is open for business.";

export default async function FirstRunPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/lite/login");

  const key = killSwitches.setup_wizards_enabled
    ? await nextCriticalWizardKey(session.user.id)
    : null;

  if (key) {
    redirect(`/lite/setup/critical-flight/${key}`);
  }

  return (
    <Capstone
      line={CAPSTONE_LINE}
      continueHref="/lite/admin"
      continueLabel="Head to cockpit"
    />
  );
}
