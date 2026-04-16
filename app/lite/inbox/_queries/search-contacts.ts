"use server";

import { like, or, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { auth } from "@/lib/auth/session";

export type ContactSearchHit = {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
};

/**
 * SQLite LIKE search on `contacts.name` + `contacts.email`. First 20
 * hits. Proper trigram/rate-limited search API is a PATCHES_OWED
 * candidate — see UI-8 brief §11.5.
 */
export async function searchContacts(query: string): Promise<ContactSearchHit[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const pattern = `%${trimmed.toLowerCase()}%`;

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      email_normalised: contacts.email_normalised,
      company_name: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.company_id))
    .where(
      or(
        like(sql`lower(${contacts.name})`, pattern),
        like(contacts.email_normalised, pattern),
      ),
    )
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    companyName: r.company_name ?? null,
  }));
}
