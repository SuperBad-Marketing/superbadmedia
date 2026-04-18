import { redirect } from "next/navigation";
import { getPortalSession, type PortalSession } from "./guard";

/**
 * Read the portal session cookie and redirect to recovery if absent.
 * Use in Server Components and server actions inside `/lite/portal/*`.
 *
 * Owner: CM-1. Consumers: CM-2..CM-12 portal pages.
 */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }
  return session;
}
