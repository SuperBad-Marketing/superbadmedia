import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { getCredential } from "@/lib/integrations/getCredential";

let configured = false;

async function ensureConfigured(): Promise<void> {
  if (configured) return;
  const plaintext = await getCredential("cloudinary");

  if (plaintext) {
    try {
      const parsed = JSON.parse(plaintext);
      if (parsed && typeof parsed === "object" && parsed.cloudName) {
        cloudinary.config({
          cloud_name: parsed.cloudName,
          api_key: parsed.apiKey,
          api_secret: parsed.apiSecret,
          secure: true,
        });
        configured = true;
        return;
      }
    } catch {}
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials not found — run the setup wizard or set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET env vars.");
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

export function resetCloudinaryConfig(): void {
  configured = false;
}

export async function uploadToCloudinary(
  filePath: string,
  folder: string,
  options?: { resourceType?: "image" | "video" | "raw" },
): Promise<UploadApiResponse> {
  await ensureConfigured();
  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: options?.resourceType ?? "auto",
  });
}

export type CloudinaryResource = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  created_at: string;
};

export async function listFolder(
  folder: string,
  options?: { maxResults?: number; nextCursor?: string; resourceType?: string },
): Promise<{ resources: CloudinaryResource[]; nextCursor?: string }> {
  await ensureConfigured();
  const result = await cloudinary.api.resources({
    type: "upload",
    prefix: folder,
    resource_type: options?.resourceType ?? "image",
    max_results: options?.maxResults ?? 100,
    next_cursor: options?.nextCursor,
  });
  return {
    resources: result.resources as CloudinaryResource[],
    nextCursor: result.next_cursor as string | undefined,
  };
}

export async function listFolderAll(
  folder: string,
  options?: { maxResults?: number },
): Promise<{ resources: CloudinaryResource[]; hasMore: boolean }> {
  await ensureConfigured();
  const perType = options?.maxResults ?? 100;
  const [images, videos] = await Promise.all([
    cloudinary.api.resources({
      type: "upload",
      prefix: folder,
      resource_type: "image",
      max_results: perType,
    }),
    cloudinary.api.resources({
      type: "upload",
      prefix: folder,
      resource_type: "video",
      max_results: perType,
    }),
  ]);
  const all = [
    ...(images.resources as CloudinaryResource[]),
    ...(videos.resources as CloudinaryResource[]),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const hasMore = !!images.next_cursor || !!videos.next_cursor;
  return { resources: all, hasMore };
}

export function transformUrl(
  publicId: string,
  transforms: { width?: number; height?: number; crop?: string; quality?: string | number; format?: string },
): string {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: transforms.width,
        height: transforms.height,
        crop: transforms.crop ?? "fill",
        quality: transforms.quality ?? "auto",
        fetch_format: transforms.format ?? "auto",
      },
    ],
    secure: true,
  });
}

export async function createFolder(folderPath: string): Promise<void> {
  await ensureConfigured();
  await cloudinary.api.create_folder(folderPath);
}

export async function generateArchiveUrl(
  folder: string,
  resourceType: "image" | "video" = "image",
): Promise<string> {
  await ensureConfigured();
  const result = await cloudinary.utils.download_zip_url({
    prefixes: [folder],
    resource_type: resourceType,
  });
  return result as unknown as string;
}

export async function testConnection(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    await cloudinary.api.ping();
    configured = false;
    return { ok: true };
  } catch (err) {
    configured = false;
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
    return {
      ok: false,
      reason: `Cloudinary credential check failed: ${msg}`,
    };
  }
}
