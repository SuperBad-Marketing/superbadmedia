import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { eq, isNotNull } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";

export interface BundleHubState {
  showHub: boolean;
  hasGallery: boolean;
  hasPlan: boolean;
  galleryTeaser: string | null;
  planTeaser: string | null;
}

/**
 * Determine whether the bundled first-visit hub should render for this contact.
 *
 * Trigger: portal visited for first time after bundled deliverables_ready
 * transition. Detected via `contacts.bundled_hub_seen_at_ms` (null = not shown).
 *
 * Currently, the bundle gate (`intro_funnel_submissions.deliverables_ready_at`)
 * doesn't exist (Wave 14). Until IF-1 lands, we check for the presence of a
 * Cloudinary gallery folder on the contact's deal as a proxy signal that
 * deliverables are ready. The six-week plan table doesn't exist yet either,
 * so `hasPlan` is always false for now.
 *
 * Owner: CM-7.
 */
export async function getBundleHubState(
  contactId: string,
): Promise<BundleHubState> {
  const NOT_SHOWN: BundleHubState = {
    showHub: false,
    hasGallery: false,
    hasPlan: false,
    galleryTeaser: null,
    planTeaser: null,
  };

  const [contact] = await db
    .select({
      company_id: contacts.company_id,
      bundled_hub_seen_at_ms: contacts.bundled_hub_seen_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) return NOT_SHOWN;
  if (contact.bundled_hub_seen_at_ms !== null) return NOT_SHOWN;

  const [company] = await db
    .select({
      cloudinary_gallery_folder: companies.cloudinary_gallery_folder,
    })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .limit(1);

  const hasGallery = !!company?.cloudinary_gallery_folder;
  if (!hasGallery) return NOT_SHOWN;

  // Six-week plan check — table doesn't exist yet (Wave 15 SWP-1).
  // When it does, query six_week_plans where company_id matches and status = 'released'.
  const hasPlan = false;

  return {
    showHub: true,
    hasGallery,
    hasPlan,
    galleryTeaser: null,
    planTeaser: null,
  };
}

/**
 * Mark the bundle hub as dismissed for this contact. One-shot — never re-shows.
 */
export async function dismissBundleHub(
  contactId: string,
  dismissedTo: "gallery" | "plan",
): Promise<void> {
  const now = Date.now();

  await db
    .update(contacts)
    .set({
      bundled_hub_seen_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(contacts.id, contactId));

  await logActivity({
    kind: "bundled_hub_dismissed",
    contactId,
    body: JSON.stringify({ dismissed_to: dismissedTo }),
  });
}
