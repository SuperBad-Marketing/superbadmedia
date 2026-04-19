import { redirect } from "next/navigation";
import { getPortalSession, type PortalSession } from "./guard";

/**
 * Read the portal session cookie for intro funnel routes.
 * Redirects to recovery if absent. The `introToken` is passed so the
 * recovery flow can redirect back to the correct portal after re-auth.
 *
 * Owner: IF-4. Consumers: /lite/intro/[token]/* pages.
 */
export async function requireIntroSession(
  introToken: string,
): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    redirect(
      `/lite/portal/recover?returnTo=${encodeURIComponent(`/lite/intro/${introToken}`)}`,
    );
  }
  return session;
}
