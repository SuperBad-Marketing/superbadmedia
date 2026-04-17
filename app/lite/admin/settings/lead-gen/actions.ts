"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dncEmails, dncDomains } from "@/lib/db/schema/dnc";
import { addDncEmail, addDncDomain } from "@/lib/lead-gen/dnc";

export type AddResult = {
  ok: boolean;
  added: number;
  skipped: number;
  errors: string[];
};
export type RemoveResult = { ok: boolean };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user;
}

function revalidate() {
  revalidatePath("/lite/admin/settings/lead-gen");
}

export async function addDncEmails(emails: string[]): Promise<AddResult> {
  const user = await requireAdmin();
  if (!user) {
    return { ok: false, added: 0, skipped: 0, errors: ["Not authorised."] };
  }

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    if (!email) continue;
    if (!email.includes("@") || email.indexOf("@") === 0) {
      errors.push(`"${raw}": invalid email`);
      continue;
    }
    try {
      const ok = await addDncEmail(email, "manual", { addedBy: user.id });
      if (ok) added++;
      else skipped++;
    } catch {
      errors.push(`"${raw}": failed to add`);
    }
  }

  revalidate();
  return { ok: true, added, skipped, errors };
}

export async function removeDncEmailById(id: string): Promise<RemoveResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false };

  await db.delete(dncEmails).where(eq(dncEmails.id, id));
  revalidate();
  return { ok: true };
}

export async function addDncDomains(domains: string[]): Promise<AddResult> {
  const user = await requireAdmin();
  if (!user) {
    return { ok: false, added: 0, skipped: 0, errors: ["Not authorised."] };
  }

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of domains) {
    const domain = raw.toLowerCase().trim().replace(/^@/, "").replace(/^https?:\/\//, "").split("/")[0];
    if (!domain) continue;
    if (!domain.includes(".")) {
      errors.push(`"${raw}": invalid domain`);
      continue;
    }
    try {
      const ok = await addDncDomain(domain, user.id, {});
      if (ok) added++;
      else skipped++;
    } catch {
      errors.push(`"${raw}": failed to add`);
    }
  }

  revalidate();
  return { ok: true, added, skipped, errors };
}

export async function removeDncDomainById(id: string): Promise<RemoveResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false };

  await db.delete(dncDomains).where(eq(dncDomains.id, id));
  revalidate();
  return { ok: true };
}
