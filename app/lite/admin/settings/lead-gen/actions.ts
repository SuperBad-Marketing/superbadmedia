"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dncEmails, dncDomains } from "@/lib/db/schema/dnc";
import {
  addDncEmail,
  addDncDomain,
  removeDncEmail,
  removeDncDomain,
} from "@/lib/lead-gen/dnc";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.id;
}

export type BulkAddResult = {
  ok: boolean;
  added: number;
  skipped: number;
  errors: string[];
};

export async function addDncEmails(emails: string[]): Promise<BulkAddResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, added: 0, skipped: 0, errors: ["Unauthorised"] };

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    if (!email) continue;
    if (!email.includes("@")) {
      errors.push(`"${raw}" is not a valid email`);
      continue;
    }
    try {
      const inserted = await addDncEmail(email, "manual", { addedBy: userId });
      if (inserted) {
        added++;
      } else {
        skipped++;
      }
    } catch {
      errors.push(`Failed to add "${email}"`);
    }
  }

  revalidatePath("/lite/admin/settings/lead-gen");
  return { ok: true, added, skipped, errors };
}

export async function removeDncEmailById(id: string): Promise<{ ok: boolean }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false };

  const row = await db
    .select({ email: dncEmails.email })
    .from(dncEmails)
    .where(eq(dncEmails.id, id))
    .get();

  if (!row) return { ok: false };

  await removeDncEmail(row.email);
  revalidatePath("/lite/admin/settings/lead-gen");
  return { ok: true };
}

export async function addDncDomains(domains: string[]): Promise<BulkAddResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, added: 0, skipped: 0, errors: ["Unauthorised"] };

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of domains) {
    const domain = raw.toLowerCase().trim().replace(/^@/, "");
    if (!domain) continue;
    if (!domain.includes(".")) {
      errors.push(`"${raw}" doesn't look like a domain`);
      continue;
    }
    try {
      const inserted = await addDncDomain(domain, userId);
      if (inserted) {
        added++;
      } else {
        skipped++;
      }
    } catch {
      errors.push(`Failed to add "${domain}"`);
    }
  }

  revalidatePath("/lite/admin/settings/lead-gen");
  return { ok: true, added, skipped, errors };
}

export async function removeDncDomainById(id: string): Promise<{ ok: boolean }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false };

  const row = await db
    .select({ domain: dncDomains.domain })
    .from(dncDomains)
    .where(eq(dncDomains.id, id))
    .get();

  if (!row) return { ok: false };

  await removeDncDomain(row.domain);
  revalidatePath("/lite/admin/settings/lead-gen");
  return { ok: true };
}
