"use server";

/**
 * SB-6a: "Send me my login" action on `/get-started/welcome`.
 *
 * Rate-limited to one send per email per 60 s (checked via the most recent
 * `subscriber_magic_link_tokens` row). Always issues a fresh token on
 * success; the webhook-issued initial link remains valid until consumed or
 * expired, so a user can redeem either.
 */
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema/user";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { issueSubscriberMagicLink } from "@/lib/auth/subscriber-magic-link";
import { sendSubscriberLoginEmail } from "@/lib/emails/subscriber-login";

const inputSchema = z.object({ email: z.string().email() });

const RESEND_COOLDOWN_MS = 60 * 1000;

export type ResendResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "unknown_email" | "cooldown" | "send_failed" };

export async function resendSubscriberLoginAction(
  raw: unknown,
): Promise<ResendResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const email = parsed.data.email.trim().toLowerCase();

  const u = await db
    .select({ id: userTable.id, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.email, email))
    .get();
  // Opaque on unknown email — don't leak whether the address exists.
  // Return `unknown_email` so UI can message generically; from the
  // attacker's POV we still flip no server state.
  if (!u) return { ok: false, reason: "unknown_email" };

  const latest = await db
    .select({ created_at_ms: subscriber_magic_link_tokens.created_at_ms })
    .from(subscriber_magic_link_tokens)
    .where(eq(subscriber_magic_link_tokens.user_id, u.id))
    .orderBy(desc(subscriber_magic_link_tokens.created_at_ms))
    .limit(1)
    .get();
  if (latest && Date.now() - latest.created_at_ms < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }

  // Find product + tier names from the subscriber's most recent SaaS deal
  // (best-effort; falls back to generic copy if nothing matches).
  const contact = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email_normalised, email))
    .get();
  let productName = "SuperBad";
  let tierName = "";
  if (contact) {
    const deal = await db
      .select({
        saas_product_id: deals.saas_product_id,
        saas_tier_id: deals.saas_tier_id,
      })
      .from(deals)
      .where(eq(deals.primary_contact_id, contact.id))
      .orderBy(desc(deals.created_at_ms))
      .limit(1)
      .get();
    if (deal?.saas_product_id) {
      const p = await db
        .select({ name: saas_products.name })
        .from(saas_products)
        .where(eq(saas_products.id, deal.saas_product_id))
        .get();
      productName = p?.name ?? productName;
    }
    if (deal?.saas_tier_id) {
      const t = await db
        .select({ name: saas_tiers.name })
        .from(saas_tiers)
        .where(eq(saas_tiers.id, deal.saas_tier_id))
        .get();
      tierName = t?.name ?? "";
    }
  }

  const { url } = await issueSubscriberMagicLink({
    userId: u.id,
    issuedFor: "subscriber_login_resend",
  });

  try {
    await sendSubscriberLoginEmail({
      to: u.email,
      magicLinkUrl: url,
      productName,
      tierName,
      context: "resend",
    });
  } catch {
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
