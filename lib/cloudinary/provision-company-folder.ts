import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createFolder } from "@/lib/cloudinary";
import { logActivity } from "@/lib/activity-log";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function provisionCompanyGalleryFolder(
  companyId: string,
  companyName: string,
): Promise<string | null> {
  const skipExternal = process.env.NODE_ENV !== "production";
  const folderPath = `superbad/clients/${slugify(companyName)}-${companyId.slice(0, 8)}`;

  if (skipExternal) {
    db.update(companies)
      .set({
        cloudinary_gallery_folder: folderPath,
        updated_at_ms: Date.now(),
      })
      .where(eq(companies.id, companyId))
      .run();
    return folderPath;
  }

  try {
    await createFolder(folderPath);

    db.update(companies)
      .set({
        cloudinary_gallery_folder: folderPath,
        updated_at_ms: Date.now(),
      })
      .where(eq(companies.id, companyId))
      .run();

    await logActivity({
      companyId,
      kind: "gallery_folder_provisioned",
      body: `Cloudinary gallery folder created: ${folderPath}`,
      meta: { folderPath },
    });

    return folderPath;
  } catch (err) {
    console.error(
      `Failed to provision Cloudinary folder for company ${companyId}:`,
      err,
    );
    return null;
  }
}
