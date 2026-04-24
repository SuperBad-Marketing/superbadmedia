import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { uploadToCloudinary } from "@/lib/cloudinary";

export interface UploadResult {
  publicId: string;
  url: string;
}

export async function uploadRenderBuffer(
  buffer: Buffer,
  postId: string,
  ratio: string,
): Promise<UploadResult> {
  const tmpPath = join(tmpdir(), `cs-${postId}-${ratio}-${Date.now()}.png`);
  try {
    await writeFile(tmpPath, buffer);
    const result = await uploadToCloudinary(
      tmpPath,
      `superbad/content-studio/${postId}`,
      { resourceType: "image" },
    );
    return {
      publicId: result.public_id,
      url: result.secure_url,
    };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
