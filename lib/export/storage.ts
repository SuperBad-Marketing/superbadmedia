/**
 * Export ZIP storage — filesystem-based with TTL expiry.
 *
 * v1 stores to `data/exports/` and serves via API route at
 * `/api/lite/exports/[id]`. Same pattern as content-assets.
 * Owner: CM-9. Consumer: client-data-export handler, portal UI.
 */
import { mkdir, writeFile, readFile, stat, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import settings from "@/lib/settings";

const EXPORT_ROOT = path.join(process.cwd(), "data", "exports");

export interface StoredExport {
  id: string;
  filename: string;
  createdAtMs: number;
  expiresAtMs: number;
  sizeBytes: number;
}

function metaPath(id: string): string {
  return path.join(EXPORT_ROOT, `${id}.meta.json`);
}

function zipPath(id: string): string {
  return path.join(EXPORT_ROOT, `${id}.zip`);
}

export async function storeExportZip(
  id: string,
  buffer: Buffer,
  filename: string,
): Promise<StoredExport> {
  await mkdir(EXPORT_ROOT, { recursive: true });
  const ttlDays = await settings.get("portal.data_export_zip_ttl_days");
  const now = Date.now();
  const meta: StoredExport = {
    id,
    filename,
    createdAtMs: now,
    expiresAtMs: now + ttlDays * 24 * 60 * 60 * 1000,
    sizeBytes: buffer.length,
  };
  await writeFile(zipPath(id), buffer);
  await writeFile(metaPath(id), JSON.stringify(meta));
  return meta;
}

export async function readExportZip(
  id: string,
): Promise<{ buffer: Buffer; meta: StoredExport } | null> {
  try {
    const raw = await readFile(metaPath(id), "utf-8");
    const meta: StoredExport = JSON.parse(raw);
    if (Date.now() > meta.expiresAtMs) {
      await deleteExport(id);
      return null;
    }
    const buffer = await readFile(zipPath(id));
    return { buffer, meta };
  } catch {
    return null;
  }
}

export async function getExportMeta(id: string): Promise<StoredExport | null> {
  try {
    const raw = await readFile(metaPath(id), "utf-8");
    const meta: StoredExport = JSON.parse(raw);
    if (Date.now() > meta.expiresAtMs) {
      await deleteExport(id);
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

async function deleteExport(id: string): Promise<void> {
  await unlink(zipPath(id)).catch(() => {});
  await unlink(metaPath(id)).catch(() => {});
}

export async function sweepExpiredExports(): Promise<number> {
  let swept = 0;
  try {
    const files = await readdir(EXPORT_ROOT);
    const metaFiles = files.filter((f) => f.endsWith(".meta.json"));
    for (const file of metaFiles) {
      const raw = await readFile(path.join(EXPORT_ROOT, file), "utf-8");
      const meta: StoredExport = JSON.parse(raw);
      if (Date.now() > meta.expiresAtMs) {
        await deleteExport(meta.id);
        swept++;
      }
    }
  } catch {
    // directory doesn't exist yet — nothing to sweep
  }
  return swept;
}
