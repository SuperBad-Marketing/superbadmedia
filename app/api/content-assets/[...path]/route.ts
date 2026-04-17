/**
 * Content Engine — serves visual assets from `data/content-assets/`.
 *
 * Public route (blog OG images + social assets need unauthenticated access).
 * Path segments map directly to the filesystem key used by `storeContentAsset`.
 *
 * Owner: CE-5.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readContentAsset } from "@/lib/content-engine/asset-storage";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  if (!segments || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Prevent path traversal
  const key = segments.join("/");
  if (key.includes("..") || key.startsWith("/")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const buffer = await readContentAsset(key);
  if (!buffer) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = key.substring(key.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
