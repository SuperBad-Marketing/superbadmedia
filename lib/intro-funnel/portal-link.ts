/**
 * Generate a fresh OTT magic-link URL for an intro funnel email.
 *
 * Every customer-facing email from the intro funnel embeds a fresh magic link
 * so prospects can return to their portal without hunting for the original.
 * The OTT URL routes through /lite/portal/r/[token] which sets a session
 * cookie and redirects to the intro portal.
 *
 * Owner: IF-4.
 */
import { issueMagicLink } from "@/lib/portal/issue-magic-link";

export async function generateIntroPortalLink(opts: {
  contactId: string;
  submissionId: string;
  introToken: string;
  issuedFor: string;
}): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const callbackUrl = `/lite/intro/${opts.introToken}`;

  const { url } = await issueMagicLink({
    contactId: opts.contactId,
    submissionId: opts.submissionId,
    issuedFor: opts.issuedFor,
  });

  // Append callbackUrl so after redeem the user lands on their intro portal
  return `${url}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
