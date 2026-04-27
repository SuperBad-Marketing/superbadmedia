export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth/session";
import { generateBrandPack } from "@/lib/brand-dna/brand-pack/generate";
import { brandPackFilename } from "@/lib/brand-dna/brand-pack/template";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profileId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("unauthorized", { status: 401 });
  }

  const { profileId } = await params;

  const profile = await db
    .select({ subject_display_name: brand_dna_profiles.subject_display_name })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .get();

  if (!profile) {
    return new Response("profile not found", { status: 404 });
  }

  try {
    const buffer = await generateBrandPack(profileId);
    const filename = brandPackFilename(
      profile.subject_display_name ?? "Brand",
    );
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return new Response(message, { status: 500 });
  }
}
