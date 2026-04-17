/**
 * Content Engine — visual asset storage (CE-5).
 *
 * v1 stores generated images to `data/content-assets/` on the local
 * filesystem and serves them via an API route at `/api/content-assets/`.
 * Future: swap to Cloudflare R2 for production durability.
 *
 * Owner: CE-5. Consumer: social template renderer, AI image generator.
 */
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ASSET_ROOT = path.join(process.cwd(), "data", "content-assets");

/**
 * Store a binary asset and return the public URL path.
 *
 * @param key - Hierarchical key, e.g. `"<postId>/instagram-1.png"`
 * @param buffer - Image data
 * @returns URL path like `/api/content-assets/<postId>/instagram-1.png`
 */
export async function storeContentAsset(
  key: string,
  buffer: Buffer,
): Promise<string> {
  const filePath = path.join(ASSET_ROOT, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return `/api/content-assets/${key}`;
}

/**
 * Read a stored asset by its key. Returns null if not found.
 */
export async function readContentAsset(
  key: string,
): Promise<Buffer | null> {
  const filePath = path.join(ASSET_ROOT, key);
  try {
    await stat(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Build the filesystem path for an asset key (for direct access).
 */
export function assetPath(key: string): string {
  return path.join(ASSET_ROOT, key);
}
