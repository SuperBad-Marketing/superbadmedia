import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { getCredential } from "@/lib/integrations/getCredential";

let configured = false;

async function ensureConfigured(): Promise<void> {
  if (configured) return;
  const plaintext = await getCredential("cloudinary");
  if (!plaintext) throw new Error("Cloudinary credentials not found — run the setup wizard first.");
  const parsed: { cloudName: string; apiKey: string; apiSecret: string } =
    JSON.parse(plaintext);
  cloudinary.config({
    cloud_name: parsed.cloudName,
    api_key: parsed.apiKey,
    api_secret: parsed.apiSecret,
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
  options?: { maxResults?: number; nextCursor?: string },
): Promise<{ resources: CloudinaryResource[]; nextCursor?: string }> {
  await ensureConfigured();
  const result = await cloudinary.api.resources({
    type: "upload",
    prefix: folder,
    max_results: options?.maxResults ?? 100,
    next_cursor: options?.nextCursor,
  });
  return {
    resources: result.resources as CloudinaryResource[],
    nextCursor: result.next_cursor as string | undefined,
  };
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

export async function generateArchiveUrl(folder: string): Promise<string> {
  await ensureConfigured();
  const result = await cloudinary.utils.download_zip_url({
    prefixes: [folder],
    resource_type: "image",
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
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Cloudinary rejected those credentials: ${err.message}`
          : "Cloudinary credential check failed.",
    };
  }
}
