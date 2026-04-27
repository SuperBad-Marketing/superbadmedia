export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { uploadToCloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/webm",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 413 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported format. Use WAV, MP3, OGG, or WebM audio." },
      { status: 415 },
    );
  }

  const ext = file.name.split(".").pop() ?? "wav";
  const tmpPath = join(
    tmpdir(),
    `sfx-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);

    const result = await uploadToCloudinary(
      tmpPath,
      "superbad/content-studio/sfx",
      { resourceType: "video" },
    );

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error("[sfx-upload] failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
