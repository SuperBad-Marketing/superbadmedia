"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { gallery_assets, type GalleryApprovalStatus } from "@/lib/db/schema/gallery-assets";
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
  createdAt: string;
  approvalStatus: GalleryApprovalStatus;
};

export type GalleryArchive = {
  label: string;
  url: string;
};

async function getGalleryContext(): Promise<{
  folder: string | null;
  contactId: string;
  companyId: string | null;
}> {
  const session = await getPortalSession();
  if (!session) throw new Error("No portal session");

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contact?.company_id) {
    return { folder: null, contactId: session.contactId, companyId: null };
  }

  const [company] = await db
    .select({ cloudinary_gallery_folder: companies.cloudinary_gallery_folder })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .limit(1);

  return {
    folder: company?.cloudinary_gallery_folder ?? null,
    contactId: session.contactId,
    companyId: contact.company_id,
  };
}

async function syncAssets(
  companyId: string,
  resources: CloudinaryResource[],
): Promise<Map<string, GalleryApprovalStatus>> {
  const existing = await db
    .select({
      cloudinary_public_id: gallery_assets.cloudinary_public_id,
      approval_status: gallery_assets.approval_status,
    })
    .from(gallery_assets)
    .where(eq(gallery_assets.company_id, companyId));

  const statusMap = new Map<string, GalleryApprovalStatus>();
  for (const row of existing) {
    statusMap.set(row.cloudinary_public_id, row.approval_status as GalleryApprovalStatus);
  }

  const newResources = resources.filter(
    (r) => !statusMap.has(r.public_id),
  );

  if (newResources.length > 0) {
    const nowMs = Date.now();
    const inserts = newResources.map((r) => ({
      id: randomUUID(),
      company_id: companyId,
      cloudinary_public_id: r.public_id,
      resource_type: r.resource_type as "image" | "video" | "raw",
      approval_status: "new" as const,
      cloudinary_created_at: r.created_at,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    }));
    await db.insert(gallery_assets).values(inserts);
    for (const r of newResources) {
      statusMap.set(r.public_id, "new");
    }
  }

  return statusMap;
}

export async function fetchGalleryItems(): Promise<{
  items: GalleryItem[];
  archives: GalleryArchive[];
  hasMore: boolean;
}> {
  const { folder, contactId, companyId } = await getGalleryContext();

  if (!folder || !companyId) {
    return { items: [], archives: [], hasMore: false };
  }

  const { resources, hasMore } = await listFolderAll(folder, {
    maxResults: 100,
  });

  const statusMap = await syncAssets(companyId, resources);

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
      createdAt: r.created_at,
      approvalStatus: statusMap.get(r.public_id) ?? "new",
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
    kind: "deliverables_viewed",
    body: `Gallery viewed (${items.length} items)`,
  });

  return { items, archives, hasMore };
}

export async function updateGalleryAssetStatus(
  publicId: string,
  status: GalleryApprovalStatus,
  note?: string,
): Promise<{ ok: boolean }> {
  const { contactId, companyId } = await getGalleryContext();
  if (!companyId) return { ok: false };

  const nowMs = Date.now();
  const [existing] = await db
    .select({ id: gallery_assets.id })
    .from(gallery_assets)
    .where(
      and(
        eq(gallery_assets.company_id, companyId),
        eq(gallery_assets.cloudinary_public_id, publicId),
      ),
    )
    .limit(1);

  if (!existing) return { ok: false };

  await db
    .update(gallery_assets)
    .set({
      approval_status: status,
      status_changed_by: contactId,
      status_note: note ?? null,
      status_changed_at_ms: nowMs,
      updated_at_ms: nowMs,
    })
    .where(eq(gallery_assets.id, existing.id));

  const kind =
    status === "approved"
      ? "gallery_asset_approved"
      : status === "revision_requested"
        ? "gallery_asset_revision_requested"
        : "gallery_asset_status_changed";

  void logActivity({
    contactId,
    companyId,
    kind,
    body: `Asset ${status}: ${publicId}`,
    meta: { publicId, status, note: note ?? null },
  });

  return { ok: true };
}
