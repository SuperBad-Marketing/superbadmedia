import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies";

export const GALLERY_APPROVAL_STATUSES = [
  "new",
  "approved",
  "revision_requested",
] as const;

export type GalleryApprovalStatus =
  (typeof GALLERY_APPROVAL_STATUSES)[number];

export const gallery_assets = sqliteTable(
  "gallery_assets",
  {
    id: text("id").primaryKey(),
    company_id: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    cloudinary_public_id: text("cloudinary_public_id").notNull(),
    resource_type: text("resource_type", {
      enum: ["image", "video", "raw"],
    }).notNull(),
    approval_status: text("approval_status", {
      enum: GALLERY_APPROVAL_STATUSES,
    })
      .notNull()
      .default("new"),
    status_changed_by: text("status_changed_by"),
    status_note: text("status_note"),
    status_changed_at_ms: integer("status_changed_at_ms"),
    cloudinary_created_at: text("cloudinary_created_at"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_company: index("gallery_assets_company_idx").on(
      t.company_id,
      t.approval_status,
    ),
    by_public_id: index("gallery_assets_public_id_idx").on(
      t.cloudinary_public_id,
    ),
  }),
);

export type GalleryAssetRow = typeof gallery_assets.$inferSelect;
export type GalleryAssetInsert = typeof gallery_assets.$inferInsert;
