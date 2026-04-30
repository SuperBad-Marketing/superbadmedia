import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { toE164 } from "@/lib/crm/normalise";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ id: contacts.id, phone: contacts.phone, phone_normalised: contacts.phone_normalised })
    .from(contacts);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.phone) {
      skipped++;
      continue;
    }

    const e164 = toE164(row.phone);
    if (e164 === row.phone_normalised) {
      skipped++;
      continue;
    }

    await db
      .update(contacts)
      .set({ phone_normalised: e164 })
      .where(eq(contacts.id, row.id));

    console.log(`  ${row.phone} → ${e164}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Total: ${rows.length}`);
}

main().catch(console.error);
