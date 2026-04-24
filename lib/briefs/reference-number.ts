import { like, desc } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";

export async function nextReferenceNumber(
  dbInstance = defaultDb,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BRF-${year}-`;

  const latest = await dbInstance
    .select({ reference_number: briefs.reference_number })
    .from(briefs)
    .where(like(briefs.reference_number, `${prefix}%`))
    .orderBy(desc(briefs.reference_number))
    .limit(1)
    .get();

  let seq = 1;
  if (latest) {
    const tail = latest.reference_number.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}
