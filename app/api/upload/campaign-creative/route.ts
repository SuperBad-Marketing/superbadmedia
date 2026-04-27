export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { uploadToCloudinary } from "@/lib/cloudinary";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxBytes = 100 * 1024 * 1024; // 100 MB
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "File too large (max 100 MB)" },
      { status: 413 },
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const tmpPath = join(tmpdir(), `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);

    const isVideo = file.type.startsWith("video/");
    const result = await uploadToCloudinary(
      tmpPath,
      "superbad/campaigns/creatives",
      { resourceType: isVideo ? "video" : "image" },
    );

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error("[campaign-creative-upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
