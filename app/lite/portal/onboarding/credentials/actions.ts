"use server";

/**
 * Server actions for onboarding credential creation.
 *
 * Portal-session-gated. Creates a user record + sends magic link email
 * so the client can transition from token-based portal access to Auth.js
 * session-based login.
 *
 * Spec: onboarding-and-segmentation.md §6.
 * Owner: OS-3.
 */
import { z } from "zod";
import { getPortalSession } from "@/lib/portal/guard";
import { createOnboardingCredentials } from "@/lib/onboarding/create-credentials";

const SendCredentialEmailSchema = z.object({
  contactId: z.string().min(1),
  companyId: z.string().min(1),
});

export type SendCredentialEmailResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Initiate credential creation: create user record + send magic link email.
 * Portal-session-gated — the contactId must match the active session.
 */
export async function sendCredentialEmail(
  input: z.infer<typeof SendCredentialEmailSchema>,
): Promise<SendCredentialEmailResult> {
  const session = await getPortalSession();
  if (!session) return { ok: false, error: "No portal session" };

  const parsed = SendCredentialEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  // Verify the contactId matches the portal session
  if (parsed.data.contactId !== session.contactId) {
    return { ok: false, error: "Contact mismatch" };
  }

  const result = await createOnboardingCredentials({
    contactId: parsed.data.contactId,
    companyId: parsed.data.companyId,
  });

  if (!result.ok) {
    if (result.reason === "already_verified") {
      return { ok: false, error: "Email already verified — try logging in at /lite/portal" };
    }
    return { ok: false, error: "Could not send credential email" };
  }

  return { ok: true };
}
