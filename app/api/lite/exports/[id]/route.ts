import { NextResponse } from "next/server";
import { readExportZip } from "@/lib/export/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await readExportZip(id);

  if (!result) {
    return NextResponse.json(
      { error: "Export not found or expired" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.meta.filename}"`,
      "Content-Length": String(result.meta.sizeBytes),
    },
  });
}
