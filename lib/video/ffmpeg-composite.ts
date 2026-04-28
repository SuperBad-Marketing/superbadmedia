import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { uploadToCloudinary } from "@/lib/cloudinary";

export interface CompositeResult {
  publicId: string;
  url: string;
}

export async function compositeWithFfmpeg(
  footageUrl: string,
  overlayUrl: string,
  jobId: string,
): Promise<CompositeResult> {
  const footagePath = join(tmpdir(), `composite-footage-${jobId}.mp4`);
  const overlayPath = join(tmpdir(), `composite-overlay-${jobId}.webm`);
  const outputPath = join(tmpdir(), `composite-output-${jobId}.mp4`);

  try {
    await Promise.all([
      downloadFile(footageUrl, footagePath),
      downloadFile(overlayUrl, overlayPath),
    ]);

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    await execFileAsync("ffmpeg", [
      "-i", footagePath,
      "-i", overlayPath,
      "-filter_complex", "[1:v]format=rgba[overlay];[0:v][overlay]overlay=0:0:shortest=1",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "copy",
      "-y", outputPath,
    ]);

    const upload = await uploadToCloudinary(
      outputPath,
      `superbad/content-studio/${jobId}/composite`,
      { resourceType: "video" },
    );

    return { publicId: upload.public_id, url: upload.secure_url };
  } finally {
    await Promise.all([
      unlink(footagePath).catch(() => {}),
      unlink(overlayPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
}
