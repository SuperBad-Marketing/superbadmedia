"use server";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { eq, and, inArray } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";
import {
  listFolderAll,
  transformUrl,
  generateArchiveUrl,
  type CloudinaryResource,
} from "@/lib/cloudinary";
import { logActivity } from "@/lib/activity-log";

export type GalleryItem = {
  publicId: string;
  thumbUrl: string;
  fullUrl: string;
  downloadUrl: string;
  resourceType: "image" | "video";
  format: string;
  width: number;
  height: number;
  bytes: number;
};

export type GalleryArchive = {
  label: string;
  url: string;
};

async function getGalleryFolder(): Promise<{
  folder: string | null;
  contactId: string;
  companyId: string | null;
  dealId: string | null;
}> {
  const session = await getPortalSession();
  if (!session) throw new Error("No portal session");

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contact?.company_id) {
    return { folder: null, contactId: session.contactId, companyId: null, dealId: null };
  }

  const dealRows = await db
    .select({
      id: deals.id,
      cloudinary_gallery_folder: deals.cloudinary_gallery_folder,
    })
    .from(deals)
    .where(
      and(
        eq(deals.company_id, contact.company_id),
        inArray(deals.stage, ["won", "trial_shoot", "quoted", "negotiating"]),
      ),
    )
    .limit(5);

  const withFolder = dealRows.find((d) => d.cloudinary_gallery_folder);

  return {
    folder: withFolder?.cloudinary_gallery_folder ?? null,
    contactId: session.contactId,
    companyId: contact.company_id,
    dealId: withFolder?.id ?? dealRows[0]?.id ?? null,
  };
}

export async function fetchGalleryItems(): Promise<{
  items: GalleryItem[];
  archives: GalleryArchive[];
  hasMore: boolean;
}> {
  const { folder, contactId, companyId, dealId } = await getGalleryFolder();

  if (!folder) {
    return { items: [], archives: [], hasMore: false };
  }

  const { resources, hasMore } = await listFolderAll(folder, { maxResults: 100 });

  const items: GalleryItem[] = resources
    .filter(
      (r): r is CloudinaryResource & { width: number; height: number } =>
        (r.resource_type === "image" || r.resource_type === "video") &&
        r.width != null &&
        r.height != null,
    )
    .map((r) => ({
      publicId: r.public_id,
      thumbUrl:
        r.resource_type === "video"
          ? transformUrl(r.public_id.replace(/\.[^.]+$/, "") + ".jpg", {
              width: 600,
              height: undefined,
              crop: "scale",
              quality: "auto",
              format: "auto",
            })
          : transformUrl(r.public_id, {
              width: 600,
              height: undefined,
              crop: "scale",
              quality: "auto",
              format: "auto",
            }),
      fullUrl: r.secure_url,
      downloadUrl: `${r.secure_url}?fl_attachment`,
      resourceType: r.resource_type as "image" | "video",
      format: r.format,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
    }));

  const hasImages = items.some((i) => i.resourceType === "image");
  const hasVideos = items.some((i) => i.resourceType === "video");

  const archives: GalleryArchive[] = [];
  if (items.length > 0) {
    const archivePromises: Promise<void>[] = [];

    if (hasImages) {
      archivePromises.push(
        generateArchiveUrl(folder, "image")
          .then((url) => {
            archives.push({
              label: hasVideos ? "download photos" : "download all",
              url,
            });
          })
          .catch(() => {}),
      );
    }

    if (hasVideos) {
      archivePromises.push(
        generateArchiveUrl(folder, "video")
          .then((url) => {
            archives.push({
              label: hasImages ? "download videos" : "download all",
              url,
            });
          })
          .catch(() => {}),
      );
    }

    await Promise.all(archivePromises);
  }

  void logActivity({
    contactId,
    companyId,
    dealId,
    kind: "deliverables_viewed",
    body: `Gallery viewed (${items.length} items)`,
  });

  return { items, archives, hasMore };
}
